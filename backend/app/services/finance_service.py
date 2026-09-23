import json
import os
from decimal import Decimal, ROUND_HALF_UP, getcontext
from typing import Optional, Tuple, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import select, desc
from app.models.scheme import Scheme, SchemeRule
from app.models.business import Business
from app.models.business_assumption import BusinessAssumption
from app.models.finance_assessment import FinanceAssessment
from app.models.location import Location
from app.schemas.finance_assessment import FinanceAssessmentRequest
from app.services.finance_calculator import calculate_financial_assessment, compute_input_hash
from app.services.legacy_adapters import normalize_legacy_business_assumption
from app.services.scheme_matcher import evaluate_scheme_compatibility, select_best_rule
from datetime import date

getcontext().prec = 28
TWO_PLACES = Decimal("0.01")

def round_currency(value: Decimal) -> Decimal:
    if value is None:
        return None
    return value.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)

def assess_business_finance(
    business_id: str, request: FinanceAssessmentRequest, db: Session
) -> FinanceAssessment:
    # 1. Gather all raw inputs
    inputs = {
        "monthly_units_sold": request.monthly_units_sold,
        "selling_price_per_unit": request.selling_price_per_unit,
        "variable_cost_per_unit": request.variable_cost_per_unit,
        "monthly_labour_cost": request.monthly_labour_cost,
        "monthly_rent": request.monthly_rent,
        "monthly_transport_cost": request.monthly_transport_cost,
        "monthly_other_fixed_cost": request.monthly_other_fixed_cost,
        "requested_loan_amount": request.requested_loan_amount,
        "project_cost": request.project_cost,
        "working_capital_required": request.working_capital_required,
        "monthly_household_nonbusiness_income": request.monthly_household_nonbusiness_income,
        "monthly_household_essential_expenses": request.monthly_household_essential_expenses,
        "existing_monthly_household_debt_payments": request.existing_monthly_household_debt_payments,
    }

    # Fetch latest assumption to merge with request if necessary (legacy fallback)
    latest_assumption = db.scalars(
        select(BusinessAssumption)
        .where(BusinessAssumption.business_id == business_id)
        .order_by(desc(BusinessAssumption.created_at))
    ).first()

    if latest_assumption:
        normalized = normalize_legacy_business_assumption(latest_assumption)
        for k, v in normalized.items():
            if inputs.get(k) is None:
                inputs[k] = v

    business = db.get(Business, business_id)
    if not business:
        raise ValueError(f"Business {business_id} not found")

    # Build profile for matcher
    profile = {
        "requested_loan_amount": inputs.get("requested_loan_amount"),
        "project_cost": inputs.get("project_cost"),
        "business_category": business.business_category,
    }
    
    if business.location_id:
        location = db.get(Location, business.location_id)
        if location:
            profile["location_type"] = location.location_type

    # 2. Load Policy (must exist, no magic fallback)
    policy_path = os.path.join(os.path.dirname(__file__), "../../../finance-spec/calculation-policy.json")
    if not os.path.exists(policy_path):
        raise RuntimeError("CRITICAL: calculation-policy.json not found")
        
    try:
        with open(policy_path, "r") as f:
            policy = json.load(f)
    except Exception as e:
        raise RuntimeError(f"CRITICAL: failed to parse calculation-policy.json: {str(e)}")
        
    policy_version = policy.get("policy_version", "UNKNOWN")
    engine_version = "1.0.0"

    # 3. Match Scheme Rule (if SCHEME mode)
    final_rule = None
    evaluation_date = date.today()
    
    if request.financing_mode == "SCHEME":
        if request.scheme_rule_id:
            rule = db.scalars(select(SchemeRule).where(SchemeRule.id == request.scheme_rule_id)).first()
            if rule:
                res = evaluate_scheme_compatibility(profile, rule.__dict__, evaluation_date, policy)
                if res["status"] == "COMPATIBLE":
                    final_rule = rule
        elif request.scheme_id:
            rules = db.scalars(select(SchemeRule).where(SchemeRule.scheme_id == request.scheme_id)).all()
            compatible = []
            rules_by_id = {}
            for r in rules:
                rd = r.__dict__
                rules_by_id[r.id] = rd
                res = evaluate_scheme_compatibility(profile, rd, evaluation_date, policy)
                if res["status"] == "COMPATIBLE":
                    compatible.append(res)
            
            if compatible:
                best = select_best_rule(compatible, rules_by_id)
                if best:
                    final_rule = next((r for r in rules if r.id == best["scheme_rule_id"]), None)
                    
        if final_rule is None and (request.scheme_rule_id or request.scheme_id):
            # Requested scheme but no compatible rule found
            raise ValueError("INSUFFICIENT_DATA or NOT_COMPATIBLE: No active compatible scheme rule found for the provided profile.")

    annual_rate = None
    total_tenure = None
    moratorium_months = None
    max_loan_cap = None
    scheme_id = None
    scheme_rule_id = None
    
    if final_rule:
        max_loan_cap = final_rule.max_loan_amount
        annual_rate = final_rule.annual_interest_rate
        total_tenure = final_rule.tenure_months
        moratorium_months = final_rule.moratorium_months
        scheme_id = final_rule.scheme_id
        scheme_rule_id = final_rule.id

    if max_loan_cap is not None:
        inputs["maximum_scheme_loan_amount"] = max_loan_cap
    if annual_rate is not None:
        inputs["annual_interest_rate_percent"] = annual_rate
    if total_tenure is not None and moratorium_months is not None:
        inputs["repayment_tenure_months"] = total_tenure - moratorium_months
        inputs["moratorium_months"] = moratorium_months
        moratorium_method = getattr(final_rule, 'moratorium_interest_method', None) if final_rule else None
        if moratorium_method and moratorium_method in ("NONE", "SIMPLE_CAPITALIZE", "COMPOUND_CAPITALIZE"):
            inputs["moratorium_interest_method"] = moratorium_method
        else:
            inputs["moratorium_interest_method"] = "NONE"

    # 4. Execute Deterministic Calculator
    # Force allow_stage_overrides=False for production
    result = calculate_financial_assessment(inputs, policy, allow_stage_overrides=False)
    input_hash = compute_input_hash(inputs, policy_version)

    # 5. Map Result back to DB Model
    latest_assessment = db.scalars(
        select(FinanceAssessment)
        .where(FinanceAssessment.business_id == business_id)
        .order_by(desc(FinanceAssessment.calculation_version))
    ).first()
    next_version = (latest_assessment.calculation_version + 1) if latest_assessment else 1
    
    recommended_loan = result.get("recommended_loan_amount")
    emi = result.get("emi")
    cap_prin = result.get("capitalized_principal")
    total_int = result.get("total_interest")
    dscr = result.get("business_dscr")
    burden = Decimal("100.0") / dscr if dscr and dscr > 0 else Decimal("0.00")
    
    margin_contribution = None

    assessment = FinanceAssessment(
        business_id=business_id,
        scheme_id=scheme_id,
        scheme_rule_id=scheme_rule_id,
        project_cost=inputs.get("project_cost"),
        margin_contribution=margin_contribution,
        maximum_loan=Decimal(str(result.get("maximum_scheme_loan_amount"))) if result.get("maximum_scheme_loan_amount") is not None else None,
        recommended_loan=Decimal(str(recommended_loan)) if recommended_loan is not None else None,
        annual_interest_rate=Decimal(str(annual_rate)) if annual_rate is not None else None,
        total_tenure_months=total_tenure,
        moratorium_months=moratorium_months if moratorium_months is not None else 0,
        active_repayment_months=inputs.get("repayment_tenure_months"),
        capitalized_principal=Decimal(str(cap_prin)) if cap_prin is not None else None,
        emi=Decimal(str(emi)) if emi is not None else None,
        total_interest=Decimal(str(total_int)) if total_int is not None else None,
        
        monthly_revenue=Decimal(str(result["monthly_revenue"])) if result.get("monthly_revenue") is not None else None,
        monthly_variable_cost=Decimal(str(result["monthly_variable_cost"])) if result.get("monthly_variable_cost") is not None else None,
        monthly_fixed_cost=Decimal(str(result["monthly_fixed_cost"])) if result.get("monthly_fixed_cost") is not None else None,
        monthly_business_surplus=Decimal(str(result["business_cash_available_for_debt_service"])) if result.get("business_cash_available_for_debt_service") is not None else None,
        affordable_loan_amount=Decimal(str(result["affordable_loan_amount"])) if result.get("affordable_loan_amount") is not None else None,
        business_dscr=Decimal(str(dscr)) if dscr is not None else None,
        household_existing_debt_ratio=Decimal(str(result["household_existing_debt_ratio"])) if result.get("household_existing_debt_ratio") is not None else None,
        household_buffer_ratio=Decimal(str(result["household_buffer_ratio"])) if result.get("household_buffer_ratio") is not None else None,
        break_even_units=result.get("break_even_units"),

        debt_affordability_status=result.get("overall_readiness", "INSUFFICIENT_DATA"),
        debt_service_burden=round_currency(burden),
        working_capital_requirement=inputs.get("working_capital_required", Decimal("0")),
        calculation_version=next_version,
        
        policy_version=policy_version,
        engine_version=engine_version,
        input_hash=input_hash,
        
        scheme_rule_version=final_rule.rule_version if final_rule else None,
        scheme_last_verified_at=final_rule.last_verified_at if final_rule else None,
    )

    db.add(assessment)
    db.commit()
    db.refresh(assessment)
    return assessment
