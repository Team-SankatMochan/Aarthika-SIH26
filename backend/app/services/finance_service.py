import json
import os
from decimal import Decimal, ROUND_HALF_UP, getcontext
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import select, desc
from app.models.scheme import Scheme, SchemeRule
from app.models.business import Business
from app.models.business_assumption import BusinessAssumption
from app.models.finance_assessment import FinanceAssessment
from app.schemas.finance_assessment import FinanceAssessmentRequest
from app.services.finance_calculator import calculate_financial_assessment
from app.services.legacy_adapters import normalize_legacy_business_assumption

# Set high precision for financial calculations
getcontext().prec = 28
TWO_PLACES = Decimal("0.01")
FOUR_PLACES = Decimal("0.0001")

def round_currency(value: Decimal) -> Decimal:
    """Round a Decimal amount to 2 decimal places (currency)."""
    return value.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)

def calculate_project_cost_from_margin(margin_contribution: Decimal) -> Decimal:
    """Project Cost = Margin / 0.10 (assuming 10% entrepreneur margin contribution)."""
    return round_currency(margin_contribution / Decimal("0.10"))

def calculate_margin_from_cost(project_cost: Decimal) -> Decimal:
    """Margin = Project Cost * 0.10 (10% entrepreneur contribution)."""
    return round_currency(project_cost * Decimal("0.10"))

def find_matching_scheme_rule(
    project_cost: Decimal, db: Session, scheme_id: Optional[str] = None
) -> Optional[SchemeRule]:
    """Find active scheme rule matching the project cost range."""
    query = select(SchemeRule).where(
        SchemeRule.active == True,
        SchemeRule.min_project_cost <= project_cost,
        SchemeRule.max_project_cost >= project_cost,
    )
    if scheme_id:
        query = query.where(SchemeRule.scheme_id == scheme_id)

    query = query.order_by(desc(SchemeRule.min_project_cost))
    return db.scalars(query).first()

def assess_business_finance(
    business_id: str, request: FinanceAssessmentRequest, db: Session
) -> FinanceAssessment:
    """
    Perform deterministic financial assessment for a business using the pure golden-test logic.
    """
    # 1. Derive Project Cost and Margin Contribution
    if request.project_cost is not None and request.project_cost > Decimal("0.00"):
        project_cost = round_currency(request.project_cost)
        margin_contribution = (
            round_currency(request.margin_contribution)
            if request.margin_contribution is not None
            else calculate_margin_from_cost(project_cost)
        )
    elif request.margin_contribution is not None:
        margin_contribution = round_currency(request.margin_contribution)
        project_cost = calculate_project_cost_from_margin(margin_contribution)
    else:
        raise ValueError("Either project_cost or margin_contribution must be provided")

    # 2. Match Scheme Rule
    rule = find_matching_scheme_rule(project_cost, db, request.scheme_id or request.scheme_rule_id)
    
    annual_rate = None
    total_tenure = None
    moratorium_months = None
    max_loan_cap = Decimal("999999999.00")
    
    if rule:
        max_loan_cap = rule.max_loan_amount
        annual_rate = rule.annual_interest_rate
        total_tenure = rule.tenure_months
        moratorium_months = rule.moratorium_months
        scheme_id = rule.scheme_id
        scheme_rule_id = rule.id
    else:
        scheme_id = request.scheme_id
        scheme_rule_id = request.scheme_rule_id

    # 3. Read latest assumption for business
    latest_assumption = db.scalars(
        select(BusinessAssumption)
        .where(BusinessAssumption.business_id == business_id)
        .order_by(desc(BusinessAssumption.created_at))
    ).first()

    # 4. Prepare inputs for golden calculator
    inputs = {
        "requested_loan_amount": float(project_cost - margin_contribution),
        "maximum_scheme_loan_amount": float(max_loan_cap),
    }
    
    if annual_rate is not None:
        inputs["annual_interest_rate_percent"] = float(annual_rate)
    
    if total_tenure is not None and moratorium_months is not None:
        active_tenure = total_tenure - moratorium_months
        inputs["repayment_tenure_months"] = active_tenure
        inputs["moratorium_months"] = moratorium_months
        # Use the scheme rule's explicit method, or default to SIMPLE_CAPITALIZE per MUDRA/PMEGP norms
        moratorium_method = getattr(rule, 'moratorium_interest_method', None) if rule else None
        if moratorium_method and moratorium_method in ("NONE", "SIMPLE_CAPITALIZE", "COMPOUND_CAPITALIZE"):
            inputs["moratorium_interest_method"] = moratorium_method
        else:
            inputs["moratorium_interest_method"] = "SIMPLE_CAPITALIZE"

    if latest_assumption:
        normalized = normalize_legacy_business_assumption(latest_assumption)
        inputs.update(normalized)

    # 5. Load Policy
    policy_path = os.path.join(os.path.dirname(__file__), "../../../finance-spec/calculation-policy.json")
    try:
        with open(policy_path, "r") as f:
            policy = json.load(f)
    except Exception:
        # Fallback if running from a different root
        policy = {
            "minimum_business_dscr": 1.20,
            "maximum_household_debt_ratio": 0.50
        }

    # 6. Execute Deterministic Calculator
    result = calculate_financial_assessment(inputs, policy)

    # 7. Map Result back to DB Model
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
    burden = Decimal(str(100.0 / dscr)) if dscr and dscr > 0 else Decimal("0.00")

    assessment = FinanceAssessment(
        business_id=business_id,
        scheme_id=scheme_id,
        scheme_rule_id=scheme_rule_id,
        project_cost=project_cost,
        margin_contribution=margin_contribution,
        maximum_loan=Decimal(str(result.get("maximum_scheme_loan_amount", max_loan_cap))),
        recommended_loan=Decimal(str(recommended_loan)) if recommended_loan is not None else None,
        annual_interest_rate=Decimal(str(annual_rate)) if annual_rate is not None else None,
        total_tenure_months=total_tenure,
        moratorium_months=moratorium_months,
        active_repayment_months=inputs.get("repayment_tenure_months"),
        capitalized_principal=Decimal(str(cap_prin)) if cap_prin is not None else None,
        emi=Decimal(str(emi)) if emi is not None else None,
        total_interest=Decimal(str(total_int)) if total_int is not None else None,
        
        # Canonical fields
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
        working_capital_requirement=request.working_capital_needed or Decimal("0.00"),
        calculation_version=next_version,
        
        # P1: Provenance fields
        scheme_rule_version=rule.rule_version if rule else None,
        scheme_last_verified_at=rule.last_verified_at if rule else None,
    )

    db.add(assessment)
    db.commit()
    db.refresh(assessment)
    return assessment
