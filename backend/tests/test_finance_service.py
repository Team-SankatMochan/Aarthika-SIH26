from decimal import Decimal
from app.services.finance_service import (
    calculate_project_cost_from_margin,
    calculate_margin_from_cost,
    find_matching_scheme_rule,
)


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


# Removed test_moratorium_accrual_and_capitalized_principal and test_emi_calculation as they test deleted functions


# Tests removed because they test deleted function assess_business_finance
