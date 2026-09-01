from decimal import Decimal
from app.services.finance_service import (
    calculate_project_cost_from_margin,
    calculate_margin_from_cost,
    find_matching_scheme_rule,
    calculate_moratorium_interest,
    calculate_emi,
    assess_business_finance,
)
from app.schemas.finance_assessment import FinanceAssessmentRequest


def test_project_cost_and_margin_calculations():
    """Verify margin to project cost and project cost to margin arithmetic."""
    # ₹14,000 margin -> ₹1,40,000 project cost
    margin = Decimal("14000.00")
    cost = calculate_project_cost_from_margin(margin)
    assert cost == Decimal("140000.00")

    # ₹1,40,000 cost -> ₹14,000 margin
    derived_margin = calculate_margin_from_cost(cost)
    assert derived_margin == Decimal("14000.00")

    # ₹5,00,000 cost -> ₹50,000 margin
    big_cost = Decimal("500000.00")
    assert calculate_margin_from_cost(big_cost) == Decimal("50000.00")


def test_scheme_rule_matching(db_session, seeded_schemes):
    """Test matching scheme rule for project costs under/over ₹1,40,000."""
    # Under ₹1.40L -> Micro Finance
    rule_micro = find_matching_scheme_rule(Decimal("140000.00"), db_session)
    assert rule_micro is not None
    assert rule_micro.scheme.scheme_type == "MICRO_FINANCE"
    assert rule_micro.max_loan_amount == Decimal("125000.00")
    assert rule_micro.annual_interest_rate == Decimal("6.50")

    # Over ₹1.40L (e.g. ₹10,00,000) -> Term Loan
    rule_term = find_matching_scheme_rule(Decimal("1000000.00"), db_session)
    assert rule_term is not None
    assert rule_term.scheme.scheme_type == "TERM_LOAN"
    assert rule_term.annual_interest_rate == Decimal("8.00")
    assert rule_term.max_loan_amount == Decimal("4500000.00")


def test_moratorium_accrual_and_capitalized_principal():
    """
    Test moratorium interest accrual:
    Principal: ₹1,00,000, Rate: 6.5%, Moratorium: 3 months
    Monthly rate = (6.5 / 100) / 12 = 0.00541666...
    Accrued interest = 100000 * (0.065 / 12) * 3 = 1625.00
    Capitalized Principal = 101625.00
    """
    principal = Decimal("100000.00")
    rate = Decimal("6.50")
    moratorium_months = 3

    accrued, capitalized = calculate_moratorium_interest(principal, rate, moratorium_months)
    assert accrued == Decimal("1625.00")
    assert capitalized == Decimal("101625.00")

    # Zero moratorium
    accrued_zero, cap_zero = calculate_moratorium_interest(principal, rate, 0)
    assert accrued_zero == Decimal("0.00")
    assert cap_zero == principal


def test_emi_calculation():
    """
    Test standard reducing balance EMI:
    Principal: ₹1,01,625.00, Annual Rate: 6.5%, Active Months: 33 (36 - 3)
    Monthly rate r = 0.065 / 12 = 0.0054166666...
    EMI = [101625 * r * (1+r)^33] / [(1+r)^33 - 1]
    Formula calculation produces ₹3,371.29
    """
    capitalized = Decimal("101625.00")
    rate = Decimal("6.50")
    active_months = 33

    emi = calculate_emi(capitalized, rate, active_months)
    assert emi > Decimal("3300.00") and emi < Decimal("3400.00")
    assert emi == Decimal("3371.29")


def test_maximum_vs_recommended_loan_differentiation(db_session, sample_business, seeded_schemes):
    """
    Test that maximum possible loan is differentiated from recommended loan
    based on cash flow and debt service capacity.
    """
    biz = sample_business["business"]

    # Case 1: Healthy cash flow
    req_healthy = FinanceAssessmentRequest(
        project_cost=Decimal("140000.00"),
        monthly_net_cash_flow=Decimal("15000.00"),
    )
    fa_healthy = assess_business_finance(biz.id, req_healthy, db_session)
    assert fa_healthy.maximum_loan == Decimal("125000.00")
    # When cash flow is ample, recommended loan equals maximum loan
    assert fa_healthy.debt_affordability_status == "AFFORDABLE"
    assert fa_healthy.calculation_version == 1

    # Case 2: Tight cash flow (e.g. only ₹4,000 monthly surplus)
    req_tight = FinanceAssessmentRequest(
        project_cost=Decimal("140000.00"),
        monthly_net_cash_flow=Decimal("4000.00"),
    )
    fa_tight = assess_business_finance(biz.id, req_tight, db_session)
    assert fa_tight.maximum_loan == Decimal("125000.00")
    assert fa_tight.recommended_loan < fa_tight.maximum_loan
    assert fa_tight.debt_affordability_status == "UNSUSTAINABLE"
    assert fa_tight.calculation_version == 2  # Audit version incremented
