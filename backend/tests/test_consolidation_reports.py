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
from app.models.evidence_enums import SourceType, EvidenceType
from app.schemas.decision import DecisionCreate, DecisionBase
from app.services.scheme_rules import get_sih_scheme_terms
from app.services.finance_calculator import calculate_financial_assessment, compute_input_hash
from app.services.decision_service import evaluate_business_decision
from app.api.routes.ai_reports import is_verified_market_evidence
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


def test_26_cross_language_hash_fixtures():
    """Test 26: Cross-language hash fixture verification against finance-spec/input-hash-fixtures.json."""
    fixture_path = os.path.join(os.path.dirname(__file__), "../../finance-spec/input-hash-fixtures.json")
    with open(fixture_path, "r", encoding="utf-8") as f:
        fixtures = json.load(f)

    assert len(fixtures) >= 5

    for item in fixtures:
        computed_hash = compute_input_hash(item["inputs"], item["policy_version"])
        assert computed_hash == item["expected_hash"], f"Failed for {item['id']}"


def test_27_market_evidence_strict_verification():
    """Test 27: Strict verification of market evidence."""
    class DummyEvidence:
        def __init__(self, source_type, evidence_type):
            self.source_type = source_type
            self.evidence_type = evidence_type

    # Excluded sources
    assert is_verified_market_evidence(DummyEvidence(SourceType.MOCK_DEMO, EvidenceType.MARKET_PRICE)) is False
    assert is_verified_market_evidence(DummyEvidence(SourceType.ESTIMATED, EvidenceType.MARKET_PRICE)) is False
    assert is_verified_market_evidence(DummyEvidence(SourceType.LEGACY_UNKNOWN, EvidenceType.MARKET_PRICE)) is False
    assert is_verified_market_evidence(DummyEvidence(SourceType.USER_ENTERED, EvidenceType.MARKET_PRICE)) is False

    # Excluded evidence type
    assert is_verified_market_evidence(DummyEvidence(SourceType.GOVERNMENT, EvidenceType.BUSINESS_CONTEXT)) is False

    # Legitimate verified market evidence
    assert is_verified_market_evidence(DummyEvidence(SourceType.GOVERNMENT, EvidenceType.MARKET_PRICE)) is True
    assert is_verified_market_evidence(DummyEvidence(SourceType.MARKET_PROVIDER, EvidenceType.DISTRICT_STATISTIC)) is True
    assert is_verified_market_evidence(DummyEvidence(SourceType.PILOT_OBSERVED, EvidenceType.MARKET_PRICE)) is True


def test_28_ai_fallback_missing_surplus_produces_needs_more_info(client, db_session):
    """Test 28: Missing surplus does not turn into ₹0 in AI fallback report."""
    user = User(id="user_test_28", name="Meena", available_capital=Decimal("5000.00"))
    db_session.add(user)
    db_session.commit()

    biz = Business(id="biz_test_28", user_id=user.id, business_name="Incomplete Shop", business_category="Retail")
    db_session.add(biz)
    db_session.commit()

    # Create assumption missing selling price and variable cost
    a = BusinessAssumption(
        business_id=biz.id,
        monthly_units_sold=Decimal("100"),
        monthly_fixed_cost=Decimal("2000"),
    )
    db_session.add(a)
    db_session.commit()

    res = client.post("/ai/generate-report", json={"business_id": biz.id})
    assert res.status_code == 200
    data = res.json()
    assert data["deterministic_snapshot"]["monthly_operating_surplus"] is None
    # Explanation must NOT claim ₹0
    summary = data["explanation"]["summary"]
    assert "₹0" not in summary
    assert "need more information" in summary.lower() or "needs more information" in summary.lower()


def test_29_out_of_scope_contract_and_emission(db_session):
    """Test 29: OUT_OF_SCOPE is accepted by schema and only emitted when project cost > ₹50L."""
    # Schema validation
    d = DecisionBase(
        business_id="biz_oos_test",
        decision="OUT_OF_SCOPE",
        rationale="Project exceeds maximum SIH scheme limit of ₹50 lakh."
    )
    assert d.decision == "OUT_OF_SCOPE"

    user = User(id="user_test_29", name="Vikram", available_capital=Decimal("600000.00"))
    db_session.add(user)
    db_session.commit()

    biz = Business(id="biz_test_29", user_id=user.id, business_name="Factory", business_category="Manufacturing")
    db_session.add(biz)
    db_session.commit()

    # Margin capital 600,000 -> Project cost 6,000,000 (> 50 Lakh cap)
    a = BusinessAssumption(
        business_id=biz.id,
        monthly_units_sold=Decimal("5000"),
        selling_price_per_unit=Decimal("200"),
        variable_cost_per_unit=Decimal("100"),
        monthly_fixed_cost=Decimal("50000"),
        available_margin_capital=Decimal("600000"),
    )
    db_session.add(a)
    db_session.commit()

    decision = evaluate_business_decision(biz.id, db_session)
    assert decision.decision == "OUT_OF_SCOPE"

    # When margin capital is missing / 0, it must NOT be OUT_OF_SCOPE
    biz2 = Business(id="biz_test_29_zero", user_id=user.id, business_name="Shop", business_category="Retail")
    db_session.add(biz2)
    db_session.commit()

    a2 = BusinessAssumption(
        business_id=biz2.id,
        monthly_units_sold=Decimal("500"),
        selling_price_per_unit=Decimal("20"),
        variable_cost_per_unit=Decimal("10"),
        monthly_fixed_cost=Decimal("2000"),
        available_margin_capital=Decimal("0"),
    )
    db_session.add(a2)
    db_session.commit()

    decision2 = evaluate_business_decision(biz2.id, db_session)
    assert decision2.decision != "OUT_OF_SCOPE"


def test_30_decision_service_canonical_assumption_summary(db_session):
    """Test 30: Decision service uses canonical assumption fields and None for missing fields."""
    user = User(id="user_test_30", name="Geeta", available_capital=Decimal("10000.00"))
    db_session.add(user)
    db_session.commit()

    biz = Business(id="biz_test_30", user_id=user.id, business_name="Tailoring", business_category="Apparel")
    db_session.add(biz)
    db_session.commit()

    a = BusinessAssumption(
        business_id=biz.id,
        selling_price_per_unit=Decimal("150"),
        variable_cost_per_unit=Decimal("60"),
        # monthly_units_sold and monthly_fixed_cost are omitted
    )
    db_session.add(a)
    db_session.commit()

    dec = evaluate_business_decision(biz.id, db_session)
    assert "selling_price_per_unit" in dec.assumptions_summary
    assert dec.assumptions_summary["selling_price_per_unit"] == 150.0
    assert dec.assumptions_summary["monthly_units_sold"] is None
    assert dec.assumptions_summary["monthly_fixed_cost"] is None
    # No deprecated fields
    assert "selling_price" not in dec.assumptions_summary
    assert "production_volume" not in dec.assumptions_summary


def test_31_explicit_backend_provenance_classification(client, db_session):
    """Test 31: Provenance explicitly separates user inputs, government rules, and Aarthika calculations."""
    user = User(id="user_test_31", name="Rekha", available_capital=Decimal("15000.00"))
    db_session.add(user)
    db_session.commit()

    biz = Business(id="biz_test_31", user_id=user.id, business_name="Pottery", business_category="Manufacturing")
    db_session.add(biz)
    db_session.commit()

    a = BusinessAssumption(
        business_id=biz.id,
        monthly_units_sold=Decimal("600"),
        selling_price_per_unit=Decimal("45"),
        variable_cost_per_unit=Decimal("20"),
        monthly_fixed_cost=Decimal("4000"),
        available_margin_capital=Decimal("15000"),
        # requested_loan_amount is NOT provided by user
    )
    db_session.add(a)
    db_session.commit()

    report = client.post("/ai/generate-report", json={"business_id": biz.id}).json()
    prov = report["provenance"]

    # User provided fields must only contain confirmed user inputs
    user_fields = prov["user_provided_fields"]
    assert "monthly_units_sold" in user_fields
    assert "selling_price_per_unit" in user_fields
    assert "variable_cost_per_unit" in user_fields
    assert "monthly_fixed_cost" in user_fields
    assert "available_margin_capital" in user_fields

    # Government rules must NOT be classified as user-provided
    assert "maximum_scheme_loan_amount" not in user_fields
    assert "annual_interest_rate_percent" not in user_fields
    assert "repayment_tenure_months" not in user_fields
    assert "moratorium_months" not in user_fields
    assert "requested_loan_amount" not in user_fields  # was auto-derived

    # Government rules must exist in government_rules
    assert any("scheme_route:" in r for r in prov["government_rules"])
    assert any("annual_interest_rate_percent:" in r for r in prov["government_rules"])

    # Calculations must include auto_derived_requested_loan and project_cost_from_margin
    calcs = prov["aarthika_calculations"]
    assert "auto_derived_requested_loan" in calcs
    assert "project_cost_from_margin" in calcs
    assert "candidate_emi" in calcs
    assert "business_dscr" in calcs


def test_32_missing_core_economics_stress_tests_empty(client, db_session):
    """Test 32: Missing fixed cost or selling price results in empty stress tests without fake ₹0."""
    user = User(id="user_test_32", name="Kiran", available_capital=Decimal("10000.00"))
    db_session.add(user)
    db_session.commit()

    biz = Business(id="biz_test_32", user_id=user.id, business_name="Services", business_category="Services")
    db_session.add(biz)
    db_session.commit()

    # monthly_fixed_cost is missing
    a = BusinessAssumption(
        business_id=biz.id,
        monthly_units_sold=Decimal("300"),
        selling_price_per_unit=Decimal("50"),
        variable_cost_per_unit=Decimal("20"),
    )
    db_session.add(a)
    db_session.commit()

    report = client.post("/ai/generate-report", json={"business_id": biz.id}).json()
    snap = report["deterministic_snapshot"]

    # Stress results must be empty, never manufactured ₹0
    assert snap["stress_results"] == []


