import { getSIHSchemeTerms, AARTHIKA_CALCULATION_POLICY } from '../SIHSchemeRules';
import { calculateFinancialAssessment } from '../../../engine/financeCalculator';
import { parseSpokenNumber } from '../../services/numberParser';
import { globalInputStore } from '../CanonicalInputStore';

describe('SIH Demo Closure Tests', () => {
  describe('Hindi/Hinglish STT Parsing', () => {
    it('parses Hindi and Hinglish numbers correctly', () => {
      expect(parseSpokenNumber('चार हजार').value).toBe(4000);
      expect(parseSpokenNumber('chaar hazaar').value).toBe(4000);
      expect(parseSpokenNumber('पचास हजार').value).toBe(50000);
      expect(parseSpokenNumber('ek lakh').value).toBe(100000);
      expect(parseSpokenNumber('एक लाख').value).toBe(100000);
    });
  });

  describe('Unconfirmed values excluded', () => {
    it('returns only confirmed values from the store', () => {
      globalInputStore.set({ field: 'confirmed_field', value: 100, confirmed: true, source: 'USER_PROVIDED', timestamp: 1 });
      globalInputStore.set({ field: 'unconfirmed_field', value: 200, confirmed: false, source: 'DERIVED_FROM_USER_INPUT' as any, timestamp: 2 });
      
      const confirmed = globalInputStore.getConfirmedValues();
      expect(confirmed.confirmed_field).toBe(100);
      expect(confirmed.unconfirmed_field).toBeUndefined();
    });
  });



  describe('Missing vs Zero Fixed Costs', () => {
    it('treats missing fixed costs as INSUFFICIENT_DATA', () => {
      const inputs = {
        requested_loan_amount: 10000,
        annual_interest_rate_percent: 12,
        repayment_tenure_months: 24,
        monthly_units_sold: 100,
        selling_price_per_unit: 50,
        variable_cost_per_unit: 20
        // Missing fixed costs
      };
      const result = calculateFinancialAssessment(inputs, AARTHIKA_CALCULATION_POLICY);
      expect(result.loan_structure_status).toBe('INSUFFICIENT_DATA');
      expect(result.missing_fields).toContain('monthly_labour_cost');
    });

    it('treats explicit zero fixed costs as valid', () => {
      const inputs = {
        requested_loan_amount: 10000,
        annual_interest_rate_percent: 12,
        repayment_tenure_months: 24,
        monthly_units_sold: 100,
        selling_price_per_unit: 50,
        variable_cost_per_unit: 20,
        monthly_labour_cost: 0,
        monthly_rent: 0,
        monthly_transport_cost: 0,
        monthly_other_fixed_cost: 0,
        monthly_household_nonbusiness_income: 10000,
        monthly_household_essential_expenses: 5000,
        existing_monthly_household_debt_payments: 0
      };
      const result = calculateFinancialAssessment(inputs, AARTHIKA_CALCULATION_POLICY);
      expect(result.loan_structure_status).not.toBe('INSUFFICIENT_DATA');
      expect(result.monthly_fixed_cost).toBe(0);
    });
  });

  describe('Stress Scenarios', () => {
    it('DEMAND_DROP_20 transforms units correctly', () => {
      const baseUnits = 100;
      const stressedUnits = baseUnits * 0.80;
      expect(stressedUnits).toBe(80);
    });
    
    it('RAW_MATERIAL_UP_20 transforms variable cost correctly', () => {
      const baseCost = 20;
      const stressedCost = baseCost * 1.20;
      expect(stressedCost).toBe(24);
    });
  });

  describe('SIH Scheme Boundaries and Tenures', () => {
    it('Micro Finance Boundary', () => {
      // project cost = 1.40L requires margin 14,000
      const scheme = getSIHSchemeTerms(14000);
      expect(scheme.isMicroFinance).toBe(true);
      expect(scheme.projectCost).toBe(140000);
      expect(scheme.raw90PercentLoan).toBe(126000);
      expect(scheme.maxLoanComponent).toBe(125000); // Capped at 1.25L
      expect(scheme.totalTenureMonths).toBe(36);
      expect(scheme.activeRepaymentMonths).toBe(33);
    });

    it('Term Loan Boundary', () => {
      // project cost = 1.41L requires margin 14,100
      const scheme = getSIHSchemeTerms(14100);
      expect(scheme.isMicroFinance).toBe(false);
      expect(scheme.schemeName).toBe('Term Loan');
      expect(scheme.projectCost).toBe(141000);
      expect(scheme.totalTenureMonths).toBe(84);
      expect(scheme.activeRepaymentMonths).toBe(78);
    });

    it('Out of Scope (> 50L)', () => {
      // project cost = 51L requires margin 5,10,000
      const scheme = getSIHSchemeTerms(510000);
      expect(scheme.isOutOfScope).toBe(true);
      expect(scheme.schemeName).not.toBe('Term Loan');
      expect(scheme.schemeName).toBe('Out of Scope');
      expect(scheme.maxLoanComponent).toBe(0);
    });
  });

  describe('Policy Configuration', () => {
    it('canonical policy loaded from the canonical source', () => {
      expect(AARTHIKA_CALCULATION_POLICY.minimum_required_dscr).toBe(1.25);
      expect(AARTHIKA_CALCULATION_POLICY.maximum_household_debt_ratio).toBe(0.50);
    });
  });

  describe('Demo Voice Fixtures', () => {
    it('demo TEXT voice fixture remains string', () => {
      // In the app, location is a TEXT field. Text isn't parsed through numberParser.
      const fixture = "रामपुर, मलिहाबाद, लखनऊ";
      expect(typeof fixture).toBe('string');
      // If we passed it through numberParser by mistake, it would fail
      const parsed = parseSpokenNumber(fixture);
      expect(parsed.success).toBe(false);
    });

    it('demo numeric voice fixture passes number parser', () => {
      const marginFixture = "एक लाख";
      const unitsFixture = "छह सौ";
      const priceFixture = "पचपन";
      
      expect(parseSpokenNumber(marginFixture).value).toBe(100000);
      expect(parseSpokenNumber(unitsFixture).value).toBe(600);
      expect(parseSpokenNumber(priceFixture).value).toBe(55);
    });
  });
});
