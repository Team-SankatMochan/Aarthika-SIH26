/// <reference types="jest" />
import { calculateFinancialAssessment } from '../financeCalculator';

describe('Integration Parity with Python Backend', () => {
  it('evaluates a canonical business payload identically to Python backend', () => {
    const inputs = {
      requested_loan_amount: 50000,
      maximum_scheme_loan_amount: 125000,
      annual_interest_rate_percent: 12,
      repayment_tenure_months: 24,
      moratorium_months: 0,
      monthly_units_sold: 1800,
      selling_price_per_unit: 40,
      variable_cost_per_unit: 18,
      monthly_fixed_cost: 4000,
      monthly_household_nonbusiness_income: 0,
      monthly_household_essential_expenses: 8000,
      existing_monthly_household_debt_payments: 0
    };
    const policy = { minimum_business_dscr: 1.2, maximum_household_debt_ratio: 0.5 };
    
    const result = calculateFinancialAssessment(inputs, policy);
    
    // Test values must exactly match Python assertions
    expect(result.monthly_revenue).toBe(72000);
    expect(result.monthly_variable_cost).toBe(32400);
    expect(result.business_cash_available_for_debt_service).toBe(35600); // 72000 - 32400 - 4000
    expect(result.emi).toBe(2353.67);
  });
});
