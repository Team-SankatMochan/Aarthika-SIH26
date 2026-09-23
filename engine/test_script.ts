
import { calculateFinancialAssessment } from './financeCalculator';
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
const policy = {
  minimum_required_dscr: '1.20',
  maximum_household_debt_ratio: '0.50'
};
console.log(calculateFinancialAssessment(inputs, policy));

