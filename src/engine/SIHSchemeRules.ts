import policyData from '../../finance-spec/calculation-policy.json';

export interface SIHSchemeResult { schemeName: string; isMicroFinance: boolean; projectCost: number; maxLoanComponent: number; raw90PercentLoan: number; schemeLoanCap: number; interestRate: number; totalTenureMonths: number; activeRepaymentMonths: number; moratoriumMonths: number; isOutOfScope?: boolean; }

export const AARTHIKA_CALCULATION_POLICY = policyData;

export function getSIHSchemeTerms(marginCapital: number): SIHSchemeResult {
  if (!marginCapital || marginCapital <= 0) {
    return { schemeName: "Invalid", isMicroFinance: false, projectCost: 0, maxLoanComponent: 0, raw90PercentLoan: 0, schemeLoanCap: 0, interestRate: 0, totalTenureMonths: 0, activeRepaymentMonths: 0, moratoriumMonths: 0, isOutOfScope: true };
  }
  const projectCost = marginCapital / 0.10;
  let rawLoanComponent = projectCost * 0.90;

  if (projectCost <= 140000) {
    // Micro Finance
    return {
      schemeName: "Micro Finance",
      isMicroFinance: true,
      projectCost,
      maxLoanComponent: Math.min(rawLoanComponent, 125000),
      raw90PercentLoan: rawLoanComponent,
      schemeLoanCap: 125000,
      interestRate: 6.5,
      totalTenureMonths: 36,
      activeRepaymentMonths: 33,
      moratoriumMonths: 3
    };
  } else if (projectCost <= 5000000) {
    // Term Loan
    return {
      schemeName: "Term Loan",
      isMicroFinance: false,
      projectCost,
      maxLoanComponent: Math.min(rawLoanComponent, 4500000), // max 45 lakh
      raw90PercentLoan: rawLoanComponent,
      schemeLoanCap: 4500000,
      interestRate: 8,
      totalTenureMonths: 84, // 7 years
      activeRepaymentMonths: 78,
      moratoriumMonths: 6
    };
  } else {
    // Out of scope
    return {
      schemeName: "Out of Scope",
      isMicroFinance: false,
      projectCost,
      maxLoanComponent: 0,
      raw90PercentLoan: 0,
      schemeLoanCap: 0,
      interestRate: 0,
      totalTenureMonths: 0,
      activeRepaymentMonths: 0,
      moratoriumMonths: 0,
      isOutOfScope: true
    };
  }
}
