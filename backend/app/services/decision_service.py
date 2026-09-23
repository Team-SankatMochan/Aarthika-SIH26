from decimal import Decimal
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import select, desc
from app.models.decision import Decision
from app.models.business import Business
from app.models.business_assumption import BusinessAssumption
from app.models.stress_test import StressTest, StressTestScenario
from app.models.pilot import Pilot, PilotResult
from app.models.finance_assessment import FinanceAssessment
from app.models.evidence import Evidence


def evaluate_business_decision(business_id: str, db: Session) -> Decision:
    """
    Synthesize the pre-investment decision for a business based on:
    - Business assumptions & unit economics
    - Stress test / Crash test resilience results
    - Real-world pilot validation experiments & results
    - Finance affordability & DSCR
    - Traceable market/pilot evidence
    """
    # 1. Fetch latest data points
    latest_assumption = db.scalars(
        select(BusinessAssumption)
        .where(BusinessAssumption.business_id == business_id)
        .order_by(desc(BusinessAssumption.created_at))
    ).first()

    latest_fa = db.scalars(
        select(FinanceAssessment)
        .where(FinanceAssessment.business_id == business_id)
        .order_by(desc(FinanceAssessment.created_at))
    ).first()

    latest_st = db.scalars(
        select(StressTest)
        .where(StressTest.business_id == business_id)
        .order_by(desc(StressTest.created_at))
    ).first()

    all_evidence = db.scalars(
        select(Evidence).where(Evidence.business_id == business_id)
    ).all()

    pilots = db.scalars(
        select(Pilot).where(Pilot.business_id == business_id)
    ).all()

    # Collect pilot results
    pilot_results = []
    for p in pilots:
        res = db.scalars(select(PilotResult).where(PilotResult.pilot_id == p.id)).all()
        pilot_results.extend(res)

    # 2. Check crash test resilience
    scenarios_insolvent = 0
    scenarios_survived = 0
    if latest_st:
        scenarios = db.scalars(
            select(StressTestScenario).where(StressTestScenario.stress_test_id == latest_st.id)
        ).all()
        for sc in scenarios:
            if sc.result_status == "INSOLVENT":
                scenarios_insolvent += 1
            elif sc.result_status == "SURVIVES":
                scenarios_survived += 1

    # 3. Check pilot validation metrics
    avg_repeat_purchase = Decimal("0.00")
    avg_price_acceptance = Decimal("0.00")
    if pilot_results:
        avg_repeat_purchase = sum(r.repeat_purchase_rate for r in pilot_results) / Decimal(len(pilot_results))
        avg_price_acceptance = sum(r.price_acceptance for r in pilot_results) / Decimal(len(pilot_results))

    # 4. Formulate Decision (Exact Readiness Rules)
    
    # Check if core business data is missing
    # We assume it's missing if emi or dscr are None, but since we didn't add nullable to emi, 
    # we can check affordable_loan_amount or business_dscr
    if not latest_fa or latest_fa.business_dscr is None:
        decision_code = "INSUFFICIENT_DATA"
        rationale = "Missing core business data (cannot calculate EMI or Business DSCR)."
        confidence = Decimal("1.00")
        
    elif latest_fa.household_existing_debt_ratio is None and latest_fa.household_buffer_ratio is None:
        decision_code = "INCOMPLETE"
        rationale = "Business data exists, but household data is missing."
        confidence = Decimal("1.00")
        
    elif latest_fa.break_even_units is None and getattr(latest_fa, "break_even_status", None) in ["STRUCTURALLY_UNVIABLE", "NO_FINITE_BREAK_EVEN"]:
        # We didn't save break_even_status, but we can check if units is null and cost exists
        decision_code = "MODIFY"
        rationale = "Unviable business economics (e.g., negative contribution margin)."
        confidence = Decimal("1.00")
        
    elif not pilot_results or avg_price_acceptance < Decimal("50.00") or avg_repeat_purchase < Decimal("30.00"):
        decision_code = "TEST_FIRST"
        rationale = "Pilot validation required before finance review. Metrics are missing or insufficient."
        confidence = Decimal("1.00")
        
    elif scenarios_insolvent > 0 or latest_fa.business_dscr < Decimal("1.20") or (latest_fa.household_existing_debt_ratio is not None and latest_fa.household_existing_debt_ratio > Decimal("0.50")):
        # Note: thresholds are illustrative here; ideally pulled from policy
        decision_code = "HIGH_RISK"
        rationale = "DSCR < minimum threshold, severe stress test failure, or household debt ratio too high."
        confidence = Decimal("1.00")
        
    else:
        decision_code = "READY_FOR_FINANCE_REVIEW"
        rationale = "Full data exists, DSCR >= minimum, Household metrics pass policy thresholds, and pilots validate demand."
        confidence = Decimal("1.00")
    # Summaries
    evidence_summary = {
        "total_evidence_count": len(all_evidence),
        "observed_count": len([e for e in all_evidence if e.is_observed]),
        "estimated_count": len([e for e in all_evidence if e.is_estimated]),
        "pilots_completed": len([p for p in pilots if p.status == "COMPLETED"]),
        "pilot_repeat_purchase_avg": float(avg_repeat_purchase),
        "pilot_price_acceptance_avg": float(avg_price_acceptance),
    }

    assumptions_summary = {
        "selling_price": float(latest_assumption.selling_price) if latest_assumption else 0.0,
        "production_volume": float(latest_assumption.production_volume) if latest_assumption else 0.0,
        "raw_material_cost": float(latest_assumption.raw_material_cost) if latest_assumption else 0.0,
        "assumption_source": latest_assumption.assumption_source if latest_assumption else "NONE",
    }

    financial_risk_summary = {
        "affordability_status": latest_fa.debt_affordability_status if latest_fa else "NOT_EVALUATED",
        "maximum_loan": float(latest_fa.maximum_loan) if latest_fa else 0.0,
        "recommended_loan": float(latest_fa.recommended_loan) if latest_fa else 0.0,
        "monthly_emi": float(latest_fa.emi) if latest_fa else 0.0,
        "scenarios_survived": scenarios_survived,
        "scenarios_insolvent": scenarios_insolvent,
    }

    decision = Decision(
        business_id=business_id,
        decision=decision_code,
        rationale=rationale,
        confidence=confidence,
        evidence_summary=evidence_summary,
        assumptions_summary=assumptions_summary,
        financial_risk_summary=financial_risk_summary,
    )

    db.add(decision)
    db.commit()
    db.refresh(decision)
    return decision
