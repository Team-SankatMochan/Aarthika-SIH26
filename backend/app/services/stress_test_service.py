from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import select, desc
from app.models.stress_test import StressTest, StressTestScenario
from app.models.business_assumption import BusinessAssumption
from app.models.finance_assessment import FinanceAssessment
from app.schemas.stress_test import StressTestRunRequest

TWO_PLACES = Decimal("0.01")


def round_cur(val: Decimal) -> Decimal:
    return val.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def run_stress_test_for_business(
    business_id: str, request: StressTestRunRequest, db: Session
) -> StressTest:
    """
    Execute deterministic Crash Test simulation for a business.
    Calculates scenario impacts on Revenue, Costs, Cash Surplus, Debt Repayment Burden,
    Working Capital Pressure, Break Even, and Resilience Score.
    """
    # 1. Fetch base assumption
    if request.assumption_id:
        assumption = db.scalars(
            select(BusinessAssumption).where(
                BusinessAssumption.id == request.assumption_id,
                BusinessAssumption.business_id == business_id,
            )
        ).first()
    else:
        assumption = db.scalars(
            select(BusinessAssumption)
            .where(BusinessAssumption.business_id == business_id)
            .order_by(desc(BusinessAssumption.created_at))
        ).first()

    if not assumption:
        raise ValueError(f"No business assumptions found for business_id {business_id}")

    # 2. Fetch monthly EMI from finance assessment or request
    monthly_emi = request.monthly_emi
    if monthly_emi is None:
        latest_fa = db.scalars(
            select(FinanceAssessment)
            .where(FinanceAssessment.business_id == business_id)
            .order_by(desc(FinanceAssessment.created_at))
        ).first()
        monthly_emi = latest_fa.emi if latest_fa else Decimal("3500.00")

    # 3. Base monthly metrics
    # Daily production volume * 30 or customers * price * 30
    if assumption.production_volume > Decimal("0.00"):
        base_monthly_vol = assumption.production_volume * Decimal("30")
    else:
        base_monthly_vol = Decimal(assumption.expected_customers) * Decimal("30")

    base_price = assumption.selling_price
    base_revenue = round_cur(base_monthly_vol * base_price)
    base_raw_mat = round_cur(
        assumption.raw_material_cost * Decimal("30")
        if assumption.raw_material_cost < Decimal("1000")
        else assumption.raw_material_cost
    )
    base_fixed_costs = round_cur(
        assumption.labour_cost
        + assumption.rent
        + assumption.transport_cost
        + assumption.other_operating_cost
    )
    base_operating_cost = round_cur(base_raw_mat + base_fixed_costs)
    base_surplus = round_cur(base_revenue - base_operating_cost)
    base_working_cap = assumption.working_capital or Decimal("15000.00")

    # 4. Create StressTest record
    stress_test = StressTest(
        business_id=business_id,
        base_assumption_id=assumption.id,
        name="Vyapar Crash Test Session",
        description="Comprehensive deterministic stress testing under adverse macroeconomic and market scenarios.",
        status="COMPLETED",
    )
    db.add(stress_test)
    db.flush()

    # 5. Define scenario evaluation logic
    scenario_configs = {
        "DEMAND_DROP_20": {
            "name": "demand_volume",
            "pct": Decimal("-20.00"),
            "vol_factor": Decimal("0.80"),
            "price_factor": Decimal("1.00"),
            "raw_mat_factor": Decimal("0.80"),
            "transport_factor": Decimal("1.00"),
            "wc_factor": Decimal("1.10"),
        },
        "PRICE_DROP_10": {
            "name": "selling_price",
            "pct": Decimal("-10.00"),
            "vol_factor": Decimal("1.00"),
            "price_factor": Decimal("0.90"),
            "raw_mat_factor": Decimal("1.00"),
            "transport_factor": Decimal("1.00"),
            "wc_factor": Decimal("1.05"),
        },
        "RAW_MATERIAL_UP_20": {
            "name": "raw_material_cost",
            "pct": Decimal("20.00"),
            "vol_factor": Decimal("1.00"),
            "price_factor": Decimal("1.00"),
            "raw_mat_factor": Decimal("1.20"),
            "transport_factor": Decimal("1.00"),
            "wc_factor": Decimal("1.25"),
        },
        "LOST_MAJOR_CUSTOMER": {
            "name": "customer_concentration",
            "pct": Decimal("-25.00"),
            "vol_factor": Decimal("0.75"),
            "price_factor": Decimal("1.00"),
            "raw_mat_factor": Decimal("0.75"),
            "transport_factor": Decimal("0.90"),
            "wc_factor": Decimal("1.20"),
        },
        "TRANSPORT_COST_SPIKE": {
            "name": "transport_cost",
            "pct": Decimal("50.00"),
            "vol_factor": Decimal("1.00"),
            "price_factor": Decimal("1.00"),
            "raw_mat_factor": Decimal("1.00"),
            "transport_factor": Decimal("1.50"),
            "wc_factor": Decimal("1.15"),
        },
        "SEASONAL_DEMAND_DROP": {
            "name": "seasonal_demand",
            "pct": Decimal("-30.00"),
            "vol_factor": Decimal("0.70"),
            "price_factor": Decimal("0.95"),
            "raw_mat_factor": Decimal("0.70"),
            "transport_factor": Decimal("1.00"),
            "wc_factor": Decimal("1.30"),
        },
        "DELAYED_PAYMENTS": {
            "name": "payment_delay_days",
            "pct": Decimal("40.00"),
            "vol_factor": Decimal("1.00"),
            "price_factor": Decimal("1.00"),
            "raw_mat_factor": Decimal("1.00"),
            "transport_factor": Decimal("1.00"),
            "wc_factor": Decimal("1.50"),
        },
    }

    scenarios_to_run = request.scenarios_to_run or list(scenario_configs.keys())

    for sc_key in scenarios_to_run:
        cfg = scenario_configs.get(
            sc_key,
            {
                "name": "general_stress",
                "pct": Decimal("-15.00"),
                "vol_factor": Decimal("0.85"),
                "price_factor": Decimal("0.95"),
                "raw_mat_factor": Decimal("1.10"),
                "transport_factor": Decimal("1.10"),
                "wc_factor": Decimal("1.20"),
            },
        )

        sim_revenue = round_cur(base_monthly_vol * cfg["vol_factor"] * (base_price * cfg["price_factor"]))
        sim_raw_mat = round_cur(base_raw_mat * cfg["raw_mat_factor"])
        sim_transport = round_cur(assumption.transport_cost * cfg["transport_factor"])
        sim_fixed = round_cur(
            assumption.labour_cost + assumption.rent + sim_transport + assumption.other_operating_cost
        )
        sim_operating_cost = round_cur(sim_raw_mat + sim_fixed)
        sim_cash_surplus = round_cur(sim_revenue - sim_operating_cost)
        sim_wc_pressure = round_cur(base_working_cap * cfg["wc_factor"])

        # Contribution margin per unit
        unit_price = base_price * cfg["price_factor"]
        unit_var_cost = (
            (sim_raw_mat / (base_monthly_vol * cfg["vol_factor"]))
            if (base_monthly_vol * cfg["vol_factor"]) > Decimal("0.00")
            else Decimal("1.00")
        )
        unit_contrib = unit_price - unit_var_cost
        break_even_units = (
            round_cur(sim_fixed / unit_contrib)
            if unit_contrib > Decimal("0.00")
            else Decimal("99999.00")
        )

        # Resilience calculation
        if sim_cash_surplus > (monthly_emi * Decimal("1.50")):
            resilience_score = Decimal("88.00")
            result_status = "SURVIVES"
        elif sim_cash_surplus >= monthly_emi:
            resilience_score = Decimal("62.00")
            result_status = "AT_RISK"
        else:
            resilience_score = Decimal("25.00")
            result_status = "INSOLVENT"

        scenario = StressTestScenario(
            stress_test_id=stress_test.id,
            scenario_type=sc_key,
            parameter_name=cfg["name"],
            change_percentage=cfg["pct"],
            change_absolute=Decimal("0.00"),
            revenue=sim_revenue,
            operating_cost=sim_operating_cost,
            cash_surplus=sim_cash_surplus,
            debt_repayment_burden=monthly_emi,
            working_capital_pressure=sim_wc_pressure,
            break_even=break_even_units,
            resilience_score=resilience_score,
            result_status=result_status,
        )
        db.add(scenario)

    db.commit()
    db.refresh(stress_test)
    return stress_test
