import pytest
from hypothesis import given, strategies as st
from app.services.finance_calculator import calculate_financial_assessment
from decimal import Decimal

# Basic bounded domains to avoid infinity/NaN
money = st.decimals(min_value=100, max_value=10000000, places=2)
rate = st.decimals(min_value=0.01, max_value=40.0, places=2)
months = st.integers(min_value=1, max_value=120)

policy = { "minimum_business_dscr": 1.2, "maximum_household_debt_ratio": 0.5 }

@given(money, money, rate, months)
def test_principal_increases_emi_does_not_decrease(p1, p2, r, m):
    """If principal increases, EMI should not decrease."""
    inputs1 = {
        "requested_loan_amount": p1,
        "maximum_scheme_loan_amount": 99999999,
        "annual_interest_rate_percent": r,
        "repayment_tenure_months": m
    }
    inputs2 = {**inputs1, "requested_loan_amount": p1 + p2}
    
    res1 = calculate_financial_assessment(inputs1, policy)
    res2 = calculate_financial_assessment(inputs2, policy)
    
    emi1 = res1.get("emi", Decimal("0"))
    emi2 = res2.get("emi", Decimal("0"))
    
    if emi1 is not None and emi2 is not None:
        assert emi2 >= emi1

@given(money, rate, rate, months)
def test_rate_increases_emi_does_not_decrease(p, r1, r2, m):
    """If interest rate increases, EMI should not decrease."""
    inputs1 = {
        "requested_loan_amount": p,
        "maximum_scheme_loan_amount": 99999999,
        "annual_interest_rate_percent": r1,
        "repayment_tenure_months": m
    }
    inputs2 = {**inputs1, "annual_interest_rate_percent": r1 + r2}
    
    res1 = calculate_financial_assessment(inputs1, policy)
    res2 = calculate_financial_assessment(inputs2, policy)
    
    emi1 = res1.get("emi", Decimal("0"))
    emi2 = res2.get("emi", Decimal("0"))
    
    if emi1 is not None and emi2 is not None:
        assert emi2 >= emi1

@given(money, rate, months, money, money)
def test_cfads_decreases_dscr_does_not_increase(p, r, m, rev1, rev2):
    """If CFADS decreases, DSCR should not increase."""
    inputs1 = {
        "requested_loan_amount": p,
        "maximum_scheme_loan_amount": 99999999,
        "annual_interest_rate_percent": r,
        "repayment_tenure_months": m,
        "monthly_units_sold": 1,
        "selling_price_per_unit": rev1 + rev2,
        "variable_cost_per_unit": 0,
        "monthly_fixed_cost": 0,
    }
    inputs2 = {**inputs1, "selling_price_per_unit": rev1} # Revenue goes down
    
    res1 = calculate_financial_assessment(inputs1, policy)
    res2 = calculate_financial_assessment(inputs2, policy)
    
    dscr1 = res1.get("business_dscr")
    dscr2 = res2.get("business_dscr")
    
    if dscr1 is not None and dscr2 is not None:
        assert dscr2 <= dscr1

def test_missing_household_inputs_never_pass():
    inputs = {
        "requested_loan_amount": 100000,
        "maximum_scheme_loan_amount": 99999999,
        "annual_interest_rate_percent": 10,
        "repayment_tenure_months": 24,
        "monthly_units_sold": 1000,
        "selling_price_per_unit": 50,
        "variable_cost_per_unit": 20,
        "monthly_fixed_cost": 5000,
    }
    res = calculate_financial_assessment(inputs, policy)
    assert res.get("household_affordability_status") != "READY_FOR_FINANCE_REVIEW"
    assert res.get("overall_readiness") != "READY_FOR_FINANCE_REVIEW"
