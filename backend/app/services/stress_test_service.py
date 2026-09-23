from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import select, desc
from app.models.stress_test import StressTest, StressTestScenario
from app.models.business_assumption import BusinessAssumption
from app.models.finance_assessment import FinanceAssessment
from app.schemas.stress_test import StressTestRunRequest
from app.services.legacy_adapters import normalize_legacy_business_assumption

TWO_PLACES = Decimal("0.01")


def round_cur(val: Decimal) -> Decimal:
    return val.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def run_stress_test_for_business(
    business_id: str, request: StressTestRunRequest, db: Session
) -> StressTest:
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

    normalized = normalize_legacy_business_assumption(assumption)
    
    # 2. Fetch monthly EMI from finance assessment or request
    monthly_emi = request.monthly_emi
    if monthly_emi is None:
        latest_fa = db.scalars(
            select(FinanceAssessment)
            .where(FinanceAssessment.business_id == business_id)
            .order_by(desc(FinanceAssessment.created_at))
        ).first()
        monthly_emi = latest_fa.emi if latest_fa and latest_fa.emi is not None else None

    if monthly_emi is None:
        raise ValueError("INSUFFICIENT_DATA: Missing required Finance Assessment EMI.")

    # 3. Base monthly metrics
    base_monthly_vol = Decimal(str(normalized["monthly_units_sold"]))
    base_price = Decimal(str(normalized["selling_price_per_unit"]))
    base_raw_mat_unit = Decimal(str(normalized["variable_cost_per_unit"]))
    base_fixed_costs = Decimal(str(normalized["monthly_fixed_cost"]))
    
    base_revenue = round_cur(base_monthly_vol * base_price)
    base_raw_mat = round_cur(base_raw_mat_unit * base_monthly_vol)
    
    base_operating_cost = round_cur(base_raw_mat + base_fixed_costs)
    base_surplus = round_cur(base_revenue - base_operating_cost)
    base_working_cap = Decimal(str(assumption.working_capital_required if assumption.working_capital_required is not None else (assumption.working_capital or 0)))

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
            "raw_mat_factor": Decimal("1.00"),  
            "fixed_cost_factor": Decimal("1.00"),
            "wc_factor": Decimal("1.10"),
        },
        "PRICE_DROP_10": {
            "name": "selling_price",
            "pct": Decimal("-10.00"),
            "vol_factor": Decimal("1.00"),
            "price_factor": Decimal("0.90"),
            "raw_mat_factor": Decimal("1.00"),
            "fixed_cost_factor": Decimal("1.00"),
            "wc_factor": Decimal("1.05"),
        },
        "RAW_MATERIAL_UP_20": {
            "name": "raw_material_cost",
            "pct": Decimal("20.00"),
            "vol_factor": Decimal("1.00"),
            "price_factor": Decimal("1.00"),
            "raw_mat_factor": Decimal("1.20"),
            "fixed_cost_factor": Decimal("1.00"),
            "wc_factor": Decimal("1.25"),
        },
        "LOST_MAJOR_CUSTOMER": {
            "name": "customer_concentration",
            "pct": Decimal("-25.00"),
            "vol_factor": Decimal("0.75"),
            "price_factor": Decimal("1.00"),
            "raw_mat_factor": Decimal("1.00"),
            "fixed_cost_factor": Decimal("1.00"),
            "wc_factor": Decimal("1.20"),
        },
        "TRANSPORT_COST_SPIKE": {
            "name": "transport_cost",
            "pct": Decimal("50.00"),
            "vol_factor": Decimal("1.00"),
            "price_factor": Decimal("1.00"),
            "raw_mat_factor": Decimal("1.00"),
            "fixed_cost_factor": Decimal("1.20"), 
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
        sim_fixed = round_cur(base_fixed_costs * cfg.get("fixed_cost_factor", Decimal("1.00")))
        
        sim_operating_cost = round_cur(sim_raw_mat + sim_fixed)
        sim_cash_surplus = round_cur(sim_revenue - sim_operating_cost)
        sim_wc_pressure = round_cur(base_working_cap * cfg["wc_factor"])

        # Contribution margin per unit
        unit_price = base_price * cfg["price_factor"]
        unit_var_cost = (
            (sim_raw_mat / (base_monthly_vol * cfg["vol_factor"]))
            if (base_monthly_vol * cfg["vol_factor"]) > Decimal("0.00")
            else Decimal("0.00")
        )
        unit_contrib = unit_price - unit_var_cost
        
        if unit_contrib > Decimal("0.00"):
            break_even_units = round_cur(sim_fixed / unit_contrib)
        else:
            break_even_units = None

        # Resilience calculation
        if monthly_emi > Decimal("0"):
            dscr = sim_cash_surplus / monthly_emi
            if dscr >= Decimal("1.50"):
                resilience_score = Decimal("100.00")
                result_status = "SURVIVES"
            elif dscr >= Decimal("1.00"):
                resilience_score = round_cur(dscr * Decimal("50.00"))
                result_status = "AT_RISK"
            elif dscr > Decimal("0"):
                resilience_score = round_cur(dscr * Decimal("30.00"))
                result_status = "INSOLVENT"
            else:
                resilience_score = Decimal("0.00")
                result_status = "INSOLVENT"
        else:
            if sim_cash_surplus > Decimal("0"):
                resilience_score = Decimal("100.00")
                result_status = "SURVIVES"
            else:
                resilience_score = Decimal("0.00")
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
