import pytest
from app.services.finance_calculator import calculate_financial_assessment

def test_integration_parity_with_ts():
    """
    Evaluates a canonical business payload identically to TypeScript frontend.
    """
    inputs = {
      "requested_loan_amount": 50000,
      "maximum_scheme_loan_amount": 125000,
      "annual_interest_rate_percent": 12,
      "repayment_tenure_months": 24,
      "moratorium_months": 0,
      "monthly_units_sold": 1800,
      "selling_price_per_unit": 40,
      "variable_cost_per_unit": 18,
      "monthly_fixed_cost": 4000,
      "monthly_household_nonbusiness_income": 0,
      "monthly_household_essential_expenses": 8000,
      "existing_monthly_household_debt_payments": 0
    }
    policy = { "minimum_business_dscr": 1.2, "maximum_household_debt_ratio": 0.5 }
    
    result = calculate_financial_assessment(inputs, policy)
    
    # Test values must exactly match TypeScript assertions
    assert float(result["monthly_revenue"]) == 72000
    assert float(result["monthly_variable_cost"]) == 32400
    assert float(result["business_cash_available_for_debt_service"]) == 35600
    assert float(result["emi"]) == 2353.67
