"""
FastAPI Routes for Deterministic AI Feasibility Reports

The backend AI report explains deterministic results rather than inventing numbers.
It builds canonical inputs from the latest BusinessAssumption, runs calculate_financial_assessment(),
evaluates stress scenarios, and passes the deterministic snapshot to the LLM to explain.
"""

import os
import json
import time
from decimal import Decimal
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select, desc
from pydantic import BaseModel, Field

from app.db.session import get_db
from app.services.groq_rag_pipeline import get_rag_pipeline
from app.models.business import Business
from app.models.business_assumption import BusinessAssumption
from app.models.evidence import Evidence
from app.services.finance_calculator import calculate_financial_assessment, compute_input_hash
from app.services.scheme_rules import get_sih_scheme_terms

router = APIRouter(prefix="/ai", tags=["AI Reports"])


class ReportRequest(BaseModel):
    """Request body for generating a report"""
    business_id: str


class ExplanationSection(BaseModel):
    summary: str
    deterministic_findings_explained: Optional[str] = ""
    caveats: list[str] = []
    questions_to_validate: list[str] = []
    suggested_next_steps: list[str] = []


class ReportResponse(BaseModel):
    """Response containing the generated report with full deterministic snapshot and provenance"""
    business_id: str
    source: str = "BACKEND_DETERMINISTIC_AI_EXPLAINED"
    deterministic_snapshot: Dict[str, Any]
    stress_analysis: List[Dict[str, Any]]
    market_data_status: str
    evidence_used: List[Dict[str, Any]]
    explanation: ExplanationSection
    provenance: Dict[str, Any]
    policy_version: str
    input_hash: str
    calculation_timestamp: int

    # Top-level backward compatibility fields
    summary: str
    deterministic_findings_explained: str
    caveats: list[str]
    questions_to_validate: list[str]
    suggested_next_steps: list[str]


def _load_policy() -> Dict[str, Any]:
    """Load canonical calculation policy."""
    policy_path = os.path.join(os.path.dirname(__file__), "../../../../finance-spec/calculation-policy.json")
    if not os.path.exists(policy_path):
        # Fallback path if running from different working directory
        policy_path = os.path.join(os.path.dirname(__file__), "../../../finance-spec/calculation-policy.json")
    with open(policy_path, "r") as f:
        return json.load(f)


def is_verified_market_evidence(e: Evidence) -> bool:
    """
    Check if an Evidence record counts as verified local market data.
    - Excludes MOCK_DEMO, ESTIMATED, LEGACY_UNKNOWN.
    - Excludes USER_ENTERED (which is user-provided, not verified market data).
    - Source must be GOVERNMENT, MARKET_PROVIDER, or PILOT_OBSERVED.
    - Evidence type must be MARKET_PRICE, DISTRICT_STATISTIC, WEATHER_OBSERVATION, or WEATHER_WARNING.
    - Excludes generic BUSINESS_CONTEXT.
    """
    source_type = getattr(e, "source_type", None)
    if hasattr(source_type, "value"):
        source_type = source_type.value
    if source_type in ("MOCK_DEMO", "ESTIMATED", "LEGACY_UNKNOWN", "USER_ENTERED", None):
        return False

    valid_sources = {"GOVERNMENT", "MARKET_PROVIDER", "PILOT_OBSERVED"}
    if source_type not in valid_sources:
        return False

    ev_type = getattr(e, "evidence_type", None)
    if hasattr(ev_type, "value"):
        ev_type = ev_type.value
    valid_ev_types = {"MARKET_PRICE", "DISTRICT_STATISTIC", "WEATHER_OBSERVATION", "WEATHER_WARNING"}
    if ev_type not in valid_ev_types:
        return False

    return True


@router.post("/generate-report", response_model=ReportResponse)
async def generate_business_report(
    request: ReportRequest,
    db: Session = Depends(get_db)
):
    """
    Generate a dynamic business feasibility explanatory report.
    - Loads Business & latest BusinessAssumption
    - Builds canonical inputs & runs deterministic FinanceEngine
    - Runs deterministic stress tests
    - Verifies evidence availability (NO_VERIFIED_DATA if none)
    - Has LLM EXPLAIN the snapshot (never recalculate numbers)
    """
    # 1. Fetch business
    business = db.query(Business).filter(Business.id == request.business_id).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    if not business.user:
        raise HTTPException(status_code=400, detail="Business has no associated user")

    # 2. Fetch latest BusinessAssumption
    latest_assumption = db.scalars(
        select(BusinessAssumption)
        .where(BusinessAssumption.business_id == business.id)
        .order_by(desc(BusinessAssumption.created_at))
    ).first()

    # 3. Location handling
    loc = business.location
    location_str = "Unknown"
    location_source = "NO_VERIFIED_DATA"
    if loc:
        parts = [p for p in [loc.village_or_city, loc.district, loc.state] if p]
        if parts:
            location_str = ", ".join(parts)
            location_source = "STRUCTURED_LOCATION"
    elif business.user.preferences and isinstance(business.user.preferences, dict):
        place = business.user.preferences.get("place")
        if place:
            location_str = str(place)
            location_source = "USER_PROVIDED_UNSTRUCTURED_LOCATION"

    # 4. Available margin capital: prefer latest assumption over user row
    available_margin = None
    if latest_assumption and latest_assumption.available_margin_capital is not None:
        available_margin = float(latest_assumption.available_margin_capital)
    elif business.user.available_capital is not None and float(business.user.available_capital) > 0:
        available_margin = float(business.user.available_capital)

    # 5. Build canonical inputs strictly from latest assumption
    canonical_inputs: Dict[str, Any] = {}
    if latest_assumption:
        if latest_assumption.monthly_units_sold is not None:
            canonical_inputs["monthly_units_sold"] = float(latest_assumption.monthly_units_sold)
        elif latest_assumption.production_volume is not None and float(latest_assumption.production_volume) > 0:
            canonical_inputs["monthly_units_sold"] = float(latest_assumption.production_volume)

        if latest_assumption.selling_price_per_unit is not None:
            canonical_inputs["selling_price_per_unit"] = float(latest_assumption.selling_price_per_unit)
        elif latest_assumption.selling_price is not None and float(latest_assumption.selling_price) > 0:
            canonical_inputs["selling_price_per_unit"] = float(latest_assumption.selling_price)

        if latest_assumption.variable_cost_per_unit is not None:
            canonical_inputs["variable_cost_per_unit"] = float(latest_assumption.variable_cost_per_unit)
        elif latest_assumption.raw_material_cost is not None and float(latest_assumption.raw_material_cost) > 0:
            canonical_inputs["variable_cost_per_unit"] = float(latest_assumption.raw_material_cost)

        # Monthly fixed cost
        if latest_assumption.monthly_fixed_cost is not None:
            canonical_inputs["monthly_fixed_cost"] = float(latest_assumption.monthly_fixed_cost)
        else:
            if latest_assumption.monthly_labour_cost is not None:
                canonical_inputs["monthly_labour_cost"] = float(latest_assumption.monthly_labour_cost)
            if latest_assumption.monthly_rent is not None:
                canonical_inputs["monthly_rent"] = float(latest_assumption.monthly_rent)
            if latest_assumption.monthly_transport_cost is not None:
                canonical_inputs["monthly_transport_cost"] = float(latest_assumption.monthly_transport_cost)
            if latest_assumption.monthly_other_fixed_cost is not None:
                canonical_inputs["monthly_other_fixed_cost"] = float(latest_assumption.monthly_other_fixed_cost)

        # Household
        if latest_assumption.monthly_household_nonbusiness_income is not None:
            canonical_inputs["monthly_household_nonbusiness_income"] = float(latest_assumption.monthly_household_nonbusiness_income)
        if latest_assumption.monthly_household_essential_expenses is not None:
            canonical_inputs["monthly_household_essential_expenses"] = float(latest_assumption.monthly_household_essential_expenses)
        if latest_assumption.existing_monthly_household_debt_payments is not None:
            canonical_inputs["existing_monthly_household_debt_payments"] = float(latest_assumption.existing_monthly_household_debt_payments)

        # Loan request
        if latest_assumption.requested_loan_amount is not None:
            canonical_inputs["requested_loan_amount"] = float(latest_assumption.requested_loan_amount)

    # 6. Apply deterministic SIH scheme rules if margin capital exists
    scheme = get_sih_scheme_terms(available_margin)
    if scheme and not scheme["is_out_of_scope"]:
        if "requested_loan_amount" not in canonical_inputs:
            canonical_inputs["requested_loan_amount"] = scheme["max_loan_component"]
        canonical_inputs["maximum_scheme_loan_amount"] = scheme["scheme_loan_cap"]
        canonical_inputs["annual_interest_rate_percent"] = scheme["interest_rate"]
        canonical_inputs["repayment_tenure_months"] = scheme["active_repayment_months"]
        canonical_inputs["moratorium_months"] = scheme["moratorium_months"]
        canonical_inputs["moratorium_interest_method"] = "NONE"

    # 7. Load policy and run deterministic calculation
    policy = _load_policy()
    policy_version = str(policy.get("policy_version", "policy-2026-v1"))
    assessment = calculate_financial_assessment(canonical_inputs, policy, allow_stage_overrides=False)

    # 8. Deterministic stress cases
    stress_results: List[Dict[str, Any]] = []

    # DEMAND_DROP_20
    if "monthly_units_sold" in canonical_inputs and canonical_inputs["monthly_units_sold"] is not None:
        demand_inputs = {**canonical_inputs}
        demand_inputs["monthly_units_sold"] = round(float(demand_inputs["monthly_units_sold"]) * 0.80)
        demand_res = calculate_financial_assessment(demand_inputs, policy, allow_stage_overrides=False)
        stress_results.append({
            "name": "DEMAND_DROP_20",
            "label": "Sales −20%",
            "revenue": float(demand_res.get("monthly_revenue") or 0),
            "operatingSurplus": float(demand_res.get("monthly_operating_surplus") or 0),
            "dscr": float(demand_res.get("business_dscr")) if demand_res.get("business_dscr") is not None else None,
            "businessAffordabilityStatus": demand_res.get("business_affordability_status") or "INCOMPLETE",
            "householdAffordabilityStatus": demand_res.get("household_affordability_status") or "INCOMPLETE",
            "overallReadiness": demand_res.get("overall_readiness") or "INCOMPLETE",
        })

    # RAW_MATERIAL_UP_20
    if "variable_cost_per_unit" in canonical_inputs and canonical_inputs["variable_cost_per_unit"] is not None:
        raw_inputs = {**canonical_inputs}
        raw_inputs["variable_cost_per_unit"] = float(raw_inputs["variable_cost_per_unit"]) * 1.20
        raw_res = calculate_financial_assessment(raw_inputs, policy, allow_stage_overrides=False)
        stress_results.append({
            "name": "RAW_MATERIAL_UP_20",
            "label": "Input Cost +20%",
            "revenue": float(raw_res.get("monthly_revenue") or 0),
            "operatingSurplus": float(raw_res.get("monthly_operating_surplus") or 0),
            "dscr": float(raw_res.get("business_dscr")) if raw_res.get("business_dscr") is not None else None,
            "businessAffordabilityStatus": raw_res.get("business_affordability_status") or "INCOMPLETE",
            "householdAffordabilityStatus": raw_res.get("household_affordability_status") or "INCOMPLETE",
            "overallReadiness": raw_res.get("overall_readiness") or "INCOMPLETE",
        })

    # 9. Build full deterministic snapshot
    deterministic_snapshot = {
        "monthly_revenue": float(assessment.get("monthly_revenue")) if assessment.get("monthly_revenue") is not None else None,
        "monthly_variable_cost": float(assessment.get("monthly_variable_cost")) if assessment.get("monthly_variable_cost") is not None else None,
        "monthly_fixed_cost": float(assessment.get("monthly_fixed_cost")) if assessment.get("monthly_fixed_cost") is not None else None,
        "monthly_operating_surplus": float(assessment.get("monthly_operating_surplus")) if assessment.get("monthly_operating_surplus") is not None else None,
        "unit_contribution_margin": float(assessment.get("unit_contribution_margin")) if assessment.get("unit_contribution_margin") is not None else None,
        "break_even_units": assessment.get("break_even_units"),
        "break_even_status": assessment.get("break_even_status"),
        "candidate_emi": float(assessment.get("candidate_emi")) if assessment.get("candidate_emi") is not None else None,
        "business_dscr": float(assessment.get("business_dscr")) if assessment.get("business_dscr") is not None else None,
        "maximum_affordable_emi": float(assessment.get("maximum_affordable_emi")) if assessment.get("maximum_affordable_emi") is not None else None,
        "affordable_loan_amount": float(assessment.get("affordable_loan_amount")) if assessment.get("affordable_loan_amount") is not None else None,
        "recommended_loan_amount": float(assessment.get("recommended_loan_amount")) if assessment.get("recommended_loan_amount") is not None else None,
        "post_loan_household_debt_ratio": float(assessment.get("post_loan_household_debt_ratio")) if assessment.get("post_loan_household_debt_ratio") is not None else None,
        "business_affordability_status": assessment.get("business_affordability_status"),
        "household_affordability_status": assessment.get("household_affordability_status"),
        "overall_readiness": assessment.get("overall_readiness"),
        "missing_fields": assessment.get("missing_fields", []),
        "stress_results": stress_results,
    }

    # 10. Check evidence and compute provenance
    evidence_rows = db.query(Evidence).filter(Evidence.business_id == business.id).all()
    verified_rows = [e for e in evidence_rows if is_verified_market_evidence(e)]
    user_entered_rows = [e for e in evidence_rows if getattr(e, "source_type", None) == "USER_ENTERED"]

    if len(verified_rows) > 0:
        market_data_status = "VERIFIED_DATA"
    elif len(user_entered_rows) > 0:
        market_data_status = "USER_PROVIDED_ONLY"
    else:
        market_data_status = "NO_VERIFIED_DATA"

    evidence_count = len(verified_rows)
    evidence_used = [
        {
            "id": e.id,
            "source": e.source_name or e.source,
            "metric": e.metric_name,
            "source_type": getattr(e, "source_type", None),
            "evidence_type": getattr(e, "evidence_type", None),
            "is_verified": is_verified_market_evidence(e),
        }
        for e in evidence_rows
    ]

    # Compute input hash for version alignment
    input_hash = compute_input_hash(canonical_inputs, policy_version)
    calculation_timestamp = int(time.time() * 1000)

    provenance = {
        "user_provided_fields": [k for k, v in canonical_inputs.items() if v is not None],
        "aarthika_calculations": ["revenue", "surplus", "break_even", "candidate_emi", "business_dscr", "stress_tests"],
        "government_rule": scheme.get("scheme_name") if scheme and not scheme.get("is_out_of_scope") else "NONE",
        "market_data_status": market_data_status,
        "location_source": location_source,
        "ai_explanation_only": True,
    }

    # 11. Run Groq RAG pipeline ONLY to explain the deterministic snapshot
    try:
        pipeline = get_rag_pipeline()
        ai_result = await pipeline.generate_report(
            business_id=business.id,
            business_category=business.business_category,
            location=location_str,
            capital=available_margin or 0.0,
            deterministic_snapshot=deterministic_snapshot,
            market_data_status=market_data_status,
            evidence_count=evidence_count,
        )
        rec = ai_result["final_recommendation"]
    except Exception as llm_err:
        # Graceful fallback: LLM failed, but deterministic snapshot is 100% intact!
        surplus = deterministic_snapshot.get("monthly_operating_surplus")
        dscr = deterministic_snapshot.get("business_dscr")
        readiness = deterministic_snapshot.get("overall_readiness") or "INCOMPLETE"

        surplus_str = f"₹{surplus:,.0f}/month" if surplus is not None else "Needs more information"
        dscr_str = f"{dscr:.2f}" if dscr is not None else "Need financing terms"

        summary_text = (
            f"Deterministic assessment complete: Business operating surplus is {surplus_str} with readiness status {readiness}."
            if surplus is not None
            else f"Deterministic assessment in progress: Core unit economics need more information (Status: {readiness})."
        )
        findings_text = f"Business DSCR: {dscr_str}. Operating surplus: {surplus_str}."

        rec = {
            "summary": summary_text,
            "deterministic_findings_explained": findings_text,
            "caveats": [
                "Local market demand and competitor pricing have not been verified on-ground."
                if market_data_status in ("NO_VERIFIED_DATA", "USER_PROVIDED_ONLY") else "Based on verified evidence."
            ],
            "questions_to_validate": [
                "Confirm monthly customer footfall and sales demand on-ground.",
                "Verify raw material supplier quotes and terms.",
            ],
            "suggested_next_steps": [
                "Review business fixed costs and ensure no hidden household expenses are included.",
                "Conduct on-ground pilot or pre-orders before formal loan commitment.",
            ]
        }

    explanation_obj = ExplanationSection(
        summary=rec["summary"],
        deterministic_findings_explained=rec.get("deterministic_findings_explained") or "",
        caveats=rec.get("caveats") or [],
        questions_to_validate=rec.get("questions_to_validate") or [],
        suggested_next_steps=rec.get("suggested_next_steps") or [],
    )

    return ReportResponse(
        business_id=business.id,
        source="BACKEND_DETERMINISTIC_AI_EXPLAINED",
        deterministic_snapshot=deterministic_snapshot,
        stress_analysis=stress_results,
        market_data_status=market_data_status,
        evidence_used=evidence_used,
        explanation=explanation_obj,
        provenance=provenance,
        policy_version=policy_version,
        input_hash=input_hash,
        calculation_timestamp=calculation_timestamp,
        # Backward compatibility
        summary=explanation_obj.summary,
        deterministic_findings_explained=explanation_obj.deterministic_findings_explained or "",
        caveats=explanation_obj.caveats,
        questions_to_validate=explanation_obj.questions_to_validate,
        suggested_next_steps=explanation_obj.suggested_next_steps,
    )


@router.get("/health")
async def health_check():
    """Check if Groq is configured correctly"""
    from app.core.config import settings

    required_vars = ["GROQ_API_KEY"]
    missing = [var for var in required_vars if not getattr(settings, var, None)]

    if missing:
        return {
            "status": "warning",
            "message": f"Missing optional AI environment variables: {', '.join(missing)}. Deterministic finance engine remains fully operational.",
            "deterministic_engine": "READY"
        }

    try:
        pipeline = get_rag_pipeline()
        return {
            "status": "ok",
            "message": "Groq RAG Pipeline is configured and ready",
            "deterministic_engine": "READY"
        }
    except Exception as e:
        return {
            "status": "warning",
            "message": f"Pipeline initialization warning: {str(e)}. Deterministic finance engine remains fully operational.",
            "deterministic_engine": "READY"
        }
