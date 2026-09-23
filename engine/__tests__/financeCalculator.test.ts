import { calculateFinancialAssessment } from '../financeCalculator';

describe('financeCalculator', () => {
  const policy = {
    minimum_required_dscr: "1.20",
    maximum_household_debt_ratio: "0.50"
  };

  it('calculates properly when inputs are present', () => {
    const inputs = {
      requested_loan_amount: 50000,
      annual_interest_rate_percent: 12,
      repayment_tenure_months: 24,
      moratorium_months: 0,
      monthly_units_sold: 100,
      selling_price_per_unit: 500,
      variable_cost_per_unit: 200,
      monthly_fixed_cost: 10000,
      monthly_household_nonbusiness_income: 20000,
      monthly_household_essential_expenses: 10000,
      existing_monthly_household_debt_payments: 2000,
    };
    
    const result = calculateFinancialAssessment(inputs, policy);
    console.log(JSON.stringify(result, null, 2));
    
    expect(result.monthly_revenue).toBe(50000);
    expect(result.monthly_variable_cost).toBe(20000);
    expect(result.monthly_operating_surplus).toBe(20000);
    expect(result.business_cash_available_for_debt_service).toBe(20000);
    expect(result.capitalized_principal).toBe(50000);
    expect(result.emi).toBeGreaterThan(0);
    expect(result.overall_readiness).toBe("READY_FOR_FINANCE_REVIEW");
  });

  it('blocks calculation and returns INSUFFICIENT_DATA if missing loan structure', () => {
    const inputs = {
      requested_loan_amount: 50000,
      monthly_units_sold: 100,
      selling_price_per_unit: 500,
      variable_cost_per_unit: 200,
      monthly_fixed_cost: 10000,
      monthly_household_nonbusiness_income: 20000,
    };
    
    const result = calculateFinancialAssessment(inputs, policy);
    
    expect(result.loan_structure_status).toBe("INSUFFICIENT_DATA");
    expect(result.business_affordability_status).toBe("INSUFFICIENT_DATA");
    expect(result.missing_fields).toContain("repayment_tenure_months");
    expect(result.missing_fields).toContain("annual_interest_rate_percent");
  });

  it('throws error if policy is missing', () => {
    const inputs = {
      requested_loan_amount: 50000,
      monthly_units_sold: 100,
    };
    
    expect(() => calculateFinancialAssessment(inputs, {})).toThrow("CRITICAL: minimum_required_dscr missing from policy");
  });
});
