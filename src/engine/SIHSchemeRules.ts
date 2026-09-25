export interface SIHSchemeResult { schemeName: string; isMicroFinance: boolean; projectCost: number; maxLoanComponent: number; interestRate: number; tenureMonths: number; moratoriumMonths: number; }

export function getSIHSchemeTerms(marginCapital: number): SIHSchemeResult {
  const projectCost = marginCapital / 0.10;
  let rawLoanComponent = projectCost * 0.90;

  if (projectCost <= 140000) {
    // Micro Finance
    return {
      schemeName: "Micro Finance",
      isMicroFinance: true,
      projectCost,
      maxLoanComponent: Math.min(rawLoanComponent, 125000),
      interestRate: 6.5,
      tenureMonths: 36,
      moratoriumMonths: 3
    };
  } else {
    // Term Loan
    return {
      schemeName: "Term Loan",
      isMicroFinance: false,
      projectCost,
      maxLoanComponent: Math.min(rawLoanComponent, 4500000), // max 45 lakh
      interestRate: 8,
      tenureMonths: 84, // 7 years
      moratoriumMonths: 6
    };
  }
}
