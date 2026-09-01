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

    # 4. Formulate Decision
    # A) DO_NOT_INVEST_YET if severe insolvency under stress, poor pilot results, or unaffordable debt
    if (
        (latest_fa and latest_fa.debt_affordability_status == "UNSUSTAINABLE")
        or scenarios_insolvent >= 3
        or (pilot_results and avg_price_acceptance < Decimal("50.00"))
    ):
        decision_code = "DO_NOT_INVEST_YET"
        rationale = (
            "Current evidence and financial assumptions do not justify committing capital yet. "
            "Under simulated stress tests and debt repayment obligations, projected cash flow becomes insolvent "
            "or pilot customer price acceptance remained insufficient. Recommend refining unit economics or testing lower-cost pilot operations."
        )
        confidence = Decimal("0.85")

    # B) MODIFY if viable but fragile (stretched debt or tight margins in transport/raw materials)
    elif (
        (latest_fa and latest_fa.debt_affordability_status == "STRETCHED")
        or scenarios_insolvent > 0
        or (pilot_results and avg_repeat_purchase < Decimal("40.00"))
    ):
        decision_code = "MODIFY"
        rationale = (
            "The business idea demonstrates core commercial demand, but reveals financial vulnerability under cost spikes. "
            "Recommend modifying the operating plan: secure bulk raw-material pricing, optimize transport routes, "
            "or reduce borrowing by 20% to maintain a safer debt-service coverage ratio."
        )
        confidence = Decimal("0.80")

    # C) GO if robust resilience, strong pilot validation, affordable financing
    else:
        decision_code = "GO"
        rationale = (
            "Business demonstrates viable unit economics, robust crash-test resilience, and verified customer demand. "
            "Debt service burden is well within conservative repayment capacity. "
            "Proceed with recommended borrowing structure and phased rollout."
        )
        confidence = Decimal("0.88")

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
