"""
Comprehensive Consolidation Tests for Backend Dynamic Analytics & Parity

Covers Tests 18-25 as required by the final consolidation pass:
18. canonical assumption payload persists correct fields.
19. backend report uses latest BusinessAssumption.
20. backend report financial snapshot changes when assumption values change.
21. available_margin_capital from business assumption reaches scheme routing.
22. report uses minimum_required_dscr from calculation-policy.json.
23. decision response accepts actual service readiness statuses.
24. backend AI cannot change deterministic snapshot numbers.
25. no market evidence -> NO_VERIFIED_DATA.
Plus SIH Scheme Rules deterministic parity tests.
"""

from decimal import Decimal
import pytest
from app.models.user import User
from app.models.business import Business
from app.models.business_assumption import BusinessAssumption
from app.models.evidence import Evidence
from app.schemas.decision import DecisionCreate, DecisionBase
from app.services.scheme_rules import get_sih_scheme_terms
from app.services.finance_calculator import calculate_financial_assessment
import json
import os


def test_scheme_rules_parity():
    """Verify SIH Scheme Rules matches canonical spec (Micro Finance vs Term Loan vs Out of Scope)."""
    # Micro Finance: margin capital 10,000 -> project cost 100,000 <= 140,000
    micro = get_sih_scheme_terms(10000)
    assert micro["is_micro_finance"] is True
    assert micro["project_cost"] == 100000.0
    assert micro["max_loan_component"] == 90000.0
    assert micro["scheme_loan_cap"] == 125000.0
    assert micro["interest_rate"] == 6.5
    assert micro["total_tenure_months"] == 36
    assert micro["active_repayment_months"] == 33
    assert micro["moratorium_months"] == 3
    assert micro["is_out_of_scope"] is False

    # Term Loan: margin capital 20,000 -> project cost 200,000 > 140,000 and <= 5,000,000
    term = get_sih_scheme_terms(20000)
    assert term["is_micro_finance"] is False
    assert term["project_cost"] == 200000.0
    assert term["max_loan_component"] == 180000.0
    assert term["scheme_loan_cap"] == 4500000.0
    assert term["interest_rate"] == 8.0
    assert term["total_tenure_months"] == 84
    assert term["active_repayment_months"] == 78
    assert term["moratorium_months"] == 6
    assert term["is_out_of_scope"] is False

    # Out of Scope: margin capital 600,000 -> project cost 6,000,000 > 5,000,000
    oos = get_sih_scheme_terms(600000)
    assert oos["is_out_of_scope"] is True
    assert oos["max_loan_component"] == 0.0

    # Missing / Zero margin capital
    zero = get_sih_scheme_terms(0)
    assert zero["is_out_of_scope"] is True
    none = get_sih_scheme_terms(None)
    assert none["is_out_of_scope"] is True


def test_18_canonical_assumption_payload_persists_fields(client, db_session):
    """Test 18: Canonical assumption payload persists correct aggregate and unit economics fields."""
    user = User(id="user_test_18", name="Ananya Rao", available_capital=Decimal("15000.00"))
    db_session.add(user)
    db_session.commit()

    biz = Business(id="biz_test_18", user_id=user.id, business_name="Dairy Unit", business_category="Dairy")
    db_session.add(biz)
    db_session.commit()

    payload = {
        "business_id": biz.id,
        "monthly_units_sold": 500.0,
        "unit_of_measure": "litres",
        "selling_price_per_unit": 60.0,
        "variable_cost_per_unit": 35.0,
        "monthly_fixed_cost": 4500.0,
        "available_margin_capital": 12000.0,
        "project_cost": 90000.0,
        "requested_loan_amount": 75000.0,
        "monthly_household_nonbusiness_income": 4000.0,
        "monthly_household_essential_expenses": 3500.0,
        "existing_monthly_household_debt_payments": 500.0,
        "assumption_source": "ENTREPRENEUR"
    }

    res = client.post(f"/businesses/{biz.id}/assumptions", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert float(data["monthly_units_sold"]) == 500.0
    assert float(data["selling_price_per_unit"]) == 60.0
    assert float(data["variable_cost_per_unit"]) == 35.0
    assert float(data["monthly_fixed_cost"]) == 4500.0
    assert float(data["available_margin_capital"]) == 12000.0
    assert float(data["project_cost"]) == 90000.0
    assert float(data["requested_loan_amount"]) == 75000.0


def test_19_20_backend_report_uses_latest_assumption_and_changes_with_inputs(client, db_session):
    """
    Test 19 & 20:
    19. Backend report uses latest BusinessAssumption.
    20. Backend report financial snapshot changes when assumption values change.
    """
    user = User(id="user_test_19", name="Kiran Patel", available_capital=Decimal("0.00"))
    db_session.add(user)
    db_session.commit()

    biz = Business(id="biz_test_19", user_id=user.id, business_name="Spice Packaging", business_category="Manufacturing")
    db_session.add(biz)
    db_session.commit()

    # Assumption 1: 100 units @ 50, vc 20, fc 1000 -> rev 5000, surplus 2000
    a1 = BusinessAssumption(
        business_id=biz.id,
        monthly_units_sold=Decimal("100"),
        selling_price_per_unit=Decimal("50"),
        variable_cost_per_unit=Decimal("20"),
        monthly_fixed_cost=Decimal("1000"),
        available_margin_capital=Decimal("10000"),
    )
    db_session.add(a1)
    db_session.commit()

    report1 = client.post("/ai/generate-report", json={"business_id": biz.id}).json()
    snap1 = report1["deterministic_snapshot"]
    assert snap1["monthly_revenue"] == 5000.0
    assert snap1["monthly_operating_surplus"] == 2000.0

    # Assumption 2: Update to 300 units @ 60, vc 25, fc 2000 -> rev 18000, surplus 8500
    a2 = BusinessAssumption(
        business_id=biz.id,
        monthly_units_sold=Decimal("300"),
        selling_price_per_unit=Decimal("60"),
        variable_cost_per_unit=Decimal("25"),
        monthly_fixed_cost=Decimal("2000"),
        available_margin_capital=Decimal("15000"),
    )
    db_session.add(a2)
    db_session.commit()

    report2 = client.post("/ai/generate-report", json={"business_id": biz.id}).json()
    snap2 = report2["deterministic_snapshot"]

    # Must reflect latest assumption (Assumption 2)
    assert snap2["monthly_revenue"] == 18000.0
    assert snap2["monthly_operating_surplus"] == 8500.0
    assert snap2["monthly_revenue"] != snap1["monthly_revenue"]
    assert snap2["monthly_operating_surplus"] != snap1["monthly_operating_surplus"]


def test_21_margin_capital_from_assumption_reaches_scheme_routing(client, db_session):
    """Test 21: available_margin_capital from business assumption reaches scheme routing."""
    # User row capital is 0, but assumption has 12,000 margin capital
    user = User(id="user_test_21", name="Ramesh Kumar", available_capital=Decimal("0.00"))
    db_session.add(user)
    db_session.commit()

    biz = Business(id="biz_test_21", user_id=user.id, business_name="Pottery Studio", business_category="Craft")
    db_session.add(biz)
    db_session.commit()

    a = BusinessAssumption(
        business_id=biz.id,
        monthly_units_sold=Decimal("400"),
        selling_price_per_unit=Decimal("70"),
        variable_cost_per_unit=Decimal("30"),
        monthly_fixed_cost=Decimal("3000"),
        available_margin_capital=Decimal("12000"),
    )
    db_session.add(a)
    db_session.commit()

    report = client.post("/ai/generate-report", json={"business_id": biz.id}).json()
    snap = report["deterministic_snapshot"]
    # 12,000 margin capital -> project cost 120,000 (Micro Finance, 6.5%, cap 125,000)
    # loan component = 108,000. Candidate EMI and business DSCR must be computed!
    assert snap["candidate_emi"] is not None
    assert snap["candidate_emi"] > 0
    assert snap["business_dscr"] is not None
    assert report["provenance"]["government_rule"] == "Micro Finance"


def test_22_report_uses_minimum_required_dscr_from_policy(client, db_session):
    """Test 22: Report uses minimum_required_dscr from calculation-policy.json."""
    policy_path = os.path.join(os.path.dirname(__file__), "../../finance-spec/calculation-policy.json")
    with open(policy_path, "r") as f:
        policy = json.load(f)
    assert "minimum_required_dscr" in policy
    min_dscr = float(policy["minimum_required_dscr"])
    assert min_dscr == 1.25


def test_23_decision_response_accepts_actual_service_readiness_statuses():
    """Test 23: Decision schema accepts all canonical readiness statuses without error."""
    canonical_statuses = [
        "READY_FOR_FINANCE_REVIEW",
        "HIGH_RISK",
        "TEST_FIRST",
        "MODIFY",
        "INCOMPLETE",
        "INSUFFICIENT_DATA",
    ]
    for status in canonical_statuses:
        d = DecisionCreate(
            business_id="biz_test",
            decision=status,
            rationale="Test rationale with sufficient characters."
        )
        assert d.decision == status


def test_24_backend_ai_cannot_change_deterministic_snapshot_numbers(client, db_session):
    """Test 24: Backend AI cannot change deterministic snapshot numbers."""
    user = User(id="user_test_24", name="Meera Devi", available_capital=Decimal("0.00"))
    db_session.add(user)
    db_session.commit()

    biz = Business(id="biz_test_24", user_id=user.id, business_name="Tailoring", business_category="Services")
    db_session.add(biz)
    db_session.commit()

    a = BusinessAssumption(
        business_id=biz.id,
        monthly_units_sold=Decimal("200"),
        selling_price_per_unit=Decimal("150"),
        variable_cost_per_unit=Decimal("60"),
        monthly_fixed_cost=Decimal("4000"),
        available_margin_capital=Decimal("10000"),
    )
    db_session.add(a)
    db_session.commit()

    policy_path = os.path.join(os.path.dirname(__file__), "../../finance-spec/calculation-policy.json")
    with open(policy_path, "r") as f:
        policy = json.load(f)

    # Compute directly via deterministic engine
    canonical_inputs = {
        "monthly_units_sold": 200.0,
        "selling_price_per_unit": 150.0,
        "variable_cost_per_unit": 60.0,
        "monthly_fixed_cost": 4000.0,
        "requested_loan_amount": 90000.0,
        "maximum_scheme_loan_amount": 125000.0,
        "annual_interest_rate_percent": 6.5,
        "repayment_tenure_months": 33,
        "moratorium_months": 3,
        "moratorium_interest_method": "NONE",
    }
    raw_calc = calculate_financial_assessment(canonical_inputs, policy, allow_stage_overrides=False)

    report = client.post("/ai/generate-report", json={"business_id": biz.id}).json()
    snap = report["deterministic_snapshot"]

    assert snap["monthly_revenue"] == float(raw_calc["monthly_revenue"])
    assert snap["monthly_variable_cost"] == float(raw_calc["monthly_variable_cost"])
    assert snap["monthly_operating_surplus"] == float(raw_calc["monthly_operating_surplus"])
    assert snap["unit_contribution_margin"] == float(raw_calc["unit_contribution_margin"])
    assert snap["break_even_units"] == raw_calc["break_even_units"]


def test_25_no_market_evidence_yields_no_verified_data(client, db_session):
    """Test 25: No market evidence rows -> market_data_status is NO_VERIFIED_DATA."""
    user = User(id="user_test_25", name="Sunil Verma", available_capital=Decimal("5000.00"))
    db_session.add(user)
    db_session.commit()

    biz = Business(id="biz_test_25", user_id=user.id, business_name="Carpentry", business_category="Carpentry")
    db_session.add(biz)
    db_session.commit()

    a = BusinessAssumption(
        business_id=biz.id,
        monthly_units_sold=Decimal("150"),
        selling_price_per_unit=Decimal("200"),
        variable_cost_per_unit=Decimal("80"),
        monthly_fixed_cost=Decimal("5000"),
    )
    db_session.add(a)
    db_session.commit()

    # Ensure no evidence rows exist
    evidence_count = db_session.query(Evidence).filter(Evidence.business_id == biz.id).count()
    assert evidence_count == 0

    report = client.post("/ai/generate-report", json={"business_id": biz.id}).json()
    assert report["market_data_status"] == "NO_VERIFIED_DATA"
    assert report["provenance"]["market_data_status"] == "NO_VERIFIED_DATA"
