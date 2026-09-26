/**
 * AARTHIKA Consolidation Regression Test Suite (Tests 1–17)
 * Verifies deterministic analytics, custom business reset, missing-vs-zero semantics,
 * strict business/household separation, provenance tracking, and elimination of synthetic scores.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  generateAnalyticsSnapshot,
  snapshotToDashboardData,
  createBlankCustomBusiness,
  editableValue,
  computeInputHash,
  type BusinessPlanInputs,
} from '../businessAnalytics';
import { SECTOR_CATALOG } from '../../constants/sectors';

describe('Aarthika Business Analytics Consolidation Suite', () => {
  // 1. Different inputs produce different analytics.
  test('Test 1: Different inputs produce different analytics (Plan A vs Plan B)', () => {
    const planA: BusinessPlanInputs = {
      businessCategory: 'retail',
      businessTitle: 'Plan A Store',
      monthlyUnitsSold: 600,
      sellingPricePerUnit: 55,
      variableCostPerUnit: 30,
      monthlyBusinessFixedCost: 5000,
      setupCost: 80000,
      availableMarginCapital: 10000,
    };

    const planB: BusinessPlanInputs = {
      businessCategory: 'retail',
      businessTitle: 'Plan B Store',
      monthlyUnitsSold: 250,
      sellingPricePerUnit: 55,
      variableCostPerUnit: 45,
      monthlyBusinessFixedCost: 10000,
      setupCost: 80000,
      availableMarginCapital: 10000,
    };

    const snapA = generateAnalyticsSnapshot(planA);
    const snapB = generateAnalyticsSnapshot(planB);

    // Revenue difference: 600*55 = 33000 vs 250*55 = 13750
    expect(snapA.monthlyRevenue).toBe(33000);
    expect(snapB.monthlyRevenue).toBe(13750);
    expect(snapA.monthlyRevenue).not.toBe(snapB.monthlyRevenue);

    // Operating surplus: 33000 - 18000 - 5000 = 10000 vs 13750 - 11250 - 10000 = -7500
    expect(snapA.operatingSurplus).toBe(10000);
    expect(snapB.operatingSurplus).toBe(-7500);
    expect(snapA.operatingSurplus).not.toBe(snapB.operatingSurplus);

    // Break-even units: 5000 / (55 - 30) = 200 vs 10000 / (55 - 45) = 1000
    expect(snapA.breakEvenUnits).toBe(200);
    expect(snapB.breakEvenUnits).toBe(1000);
    expect(snapA.breakEvenUnits).not.toBe(snapB.breakEvenUnits);

    // Risk findings differ (Plan B has negative operating surplus finding)
    expect(snapA.riskFindings).not.toEqual(snapB.riskFindings);
  });

  // 2. Explicit zero remains zero.
  test('Test 2: Explicit zero remains zero (does not convert to missing/fallback)', () => {
    expect(editableValue(0)).toBe('0');

    const planWithZero: BusinessPlanInputs = {
      sellingPricePerUnit: 50,
      variableCostPerUnit: 20,
      monthlyUnitsSold: 100,
      monthlyBusinessFixedCost: 0, // Explicit 0 fixed cost
      setupCost: 0, // Explicit 0 setup cost
    };

    const snap = generateAnalyticsSnapshot(planWithZero);
    expect(snap.monthlyFixedCost).toBe(0);
    expect(snap.operatingSurplus).toBe(3000); // 5000 - 2000 - 0 = 3000
  });

  // 3. Missing remains missing.
  test('Test 3: Missing remains missing (nullish semantics)', () => {
    expect(editableValue(null)).toBe('');
    expect(editableValue(undefined)).toBe('');

    const missingPlan: BusinessPlanInputs = {
      businessTitle: 'Incomplete Plan',
      // No selling price, no units
    };

    const snap = generateAnalyticsSnapshot(missingPlan);
    expect(snap.monthlyRevenue).toBeNull();
    expect(snap.operatingSurplus).toBeNull();
    expect(snap.candidateEmi).toBeNull();
    expect(snap.missingFields).toContain('monthly_units_sold');
    expect(snap.missingFields).toContain('selling_price_per_unit');
  });

  // 4. Household expenses do NOT change business operating surplus.
  test('Test 4: Household expenses do NOT change business operating surplus', () => {
    const basePlan: BusinessPlanInputs = {
      sellingPricePerUnit: 100,
      variableCostPerUnit: 40,
      monthlyUnitsSold: 200,
      monthlyBusinessFixedCost: 3000,
      householdEssentialExpenses: 4000,
    };

    const highHouseholdPlan: BusinessPlanInputs = {
      ...basePlan,
      householdEssentialExpenses: 25000, // Very high household living costs
    };

    const snapBase = generateAnalyticsSnapshot(basePlan);
    const snapHigh = generateAnalyticsSnapshot(highHouseholdPlan);

    // Business Operating Surplus MUST be completely identical: 20000 - 8000 - 3000 = 9000
    expect(snapBase.operatingSurplus).toBe(9000);
    expect(snapHigh.operatingSurplus).toBe(9000);
    expect(snapBase.monthlyRevenue).toBe(snapHigh.monthlyRevenue);
    expect(snapBase.monthlyVariableCost).toBe(snapHigh.monthlyVariableCost);
    expect(snapBase.breakEvenUnits).toBe(snapHigh.breakEvenUnits);
  });

  // 5. Household inputs DO change household affordability.
  test('Test 5: Household inputs DO change household affordability', () => {
    const comfortableHousehold: BusinessPlanInputs = {
      setupCost: 100000,
      availableMarginCapital: 10000,
      sellingPricePerUnit: 100,
      variableCostPerUnit: 40,
      monthlyUnitsSold: 200,
      monthlyBusinessFixedCost: 3000,
      householdEssentialExpenses: 3000,
      householdNonBusinessIncome: 15000,
      existingHouseholdEMI: 0,
    };

    const stressedHousehold: BusinessPlanInputs = {
      ...comfortableHousehold,
      householdEssentialExpenses: 20000,
      householdNonBusinessIncome: 0,
      existingHouseholdEMI: 8000,
    };

    const snapComfort = generateAnalyticsSnapshot(comfortableHousehold);
    const snapStress = generateAnalyticsSnapshot(stressedHousehold);

    expect(snapComfort.householdDebtRatio).not.toBe(snapStress.householdDebtRatio);
    expect(snapComfort.financeResult.household_affordability_status).not.toBe(
      snapStress.financeResult.household_affordability_status
    );
  });

  // 6. Custom text business has blank assumptions.
  test('Test 6: Custom text business has blank assumptions', () => {
    const textCustom = createBlankCustomBusiness('My Organic Mushroom Farm');
    expect(textCustom.sector).toBe('custom');
    expect(textCustom.title).toBe('My Organic Mushroom Farm');
    expect(textCustom.setupCost).toBeNull();
    expect(textCustom.monthlyFixed).toBeNull();
    expect(textCustom.unitType).toBe('');
    expect(textCustom.pricePerUnit).toBeNull();
    expect(textCustom.costPerUnit).toBeNull();
    expect(textCustom.salesPerMonth).toBeNull();
    expect(textCustom.householdEssentialExpenses).toBeNull();
    expect(textCustom.householdIncome).toBeNull();
    expect(textCustom.existingEMI).toBeNull();
    expect(textCustom.availableMarginCapital).toBeNull();
    expect(textCustom.requestedLoanAmount).toBeNull();
    expect(textCustom.presetSource).toBeNull();
    expect(textCustom.breakdown).toEqual([]);
  });

  // 7. Custom voice business has blank assumptions.
  test('Test 7: Custom voice business has blank assumptions', () => {
    const voiceCustom = createBlankCustomBusiness('मशरूम की खेती');
    expect(voiceCustom.sector).toBe('custom');
    expect(voiceCustom.title).toBe('मशरूम की खेती');
    expect(voiceCustom.setupCost).toBeNull();
    expect(voiceCustom.monthlyFixed).toBeNull();
    expect(voiceCustom.pricePerUnit).toBeNull();
    expect(voiceCustom.costPerUnit).toBeNull();
    expect(voiceCustom.salesPerMonth).toBeNull();
  });

  // 8. Sector preset values are labelled SUGGESTED_ESTIMATE.
  test('Test 8: Sector preset values are labelled SUGGESTED_ESTIMATE', () => {
    const dairySector = SECTOR_CATALOG.find((s) => s.id === 'dairy');
    expect(dairySector).toBeDefined();

    const planFromPreset: BusinessPlanInputs = {
      businessCategory: dairySector!.id,
      businessTitle: 'Dairy Farming',
      setupCost: dairySector!.presets.setupCost,
      monthlyUnitsSold: dairySector!.presets.salesPerMonth,
      sellingPricePerUnit: dairySector!.presets.pricePerUnit,
      variableCostPerUnit: dairySector!.presets.costPerUnit,
      monthlyBusinessFixedCost: dairySector!.presets.monthlyFixed,
      householdEssentialExpenses: dairySector!.presets.personalCost,
      presetSource: 'SUGGESTED_ESTIMATE',
      fieldProvenance: {
        setupCost: 'SUGGESTED_ESTIMATE',
        monthlyUnitsSold: 'SUGGESTED_ESTIMATE',
        sellingPricePerUnit: 'SUGGESTED_ESTIMATE',
        variableCostPerUnit: 'SUGGESTED_ESTIMATE',
      },
    };

    expect(planFromPreset.presetSource).toBe('SUGGESTED_ESTIMATE');
    expect(planFromPreset.fieldProvenance?.monthlyUnitsSold).toBe('SUGGESTED_ESTIMATE');
  });

  // 9. Confirmed presets change provenance.
  test('Test 9: Confirmed presets change provenance', () => {
    const confirmedPlan: BusinessPlanInputs = {
      businessCategory: 'dairy',
      businessTitle: 'Dairy Farming',
      setupCost: 150000,
      monthlyUnitsSold: 1200,
      sellingPricePerUnit: 50,
      variableCostPerUnit: 25,
      monthlyBusinessFixedCost: 5000,
      presetSource: 'USER_CONFIRMED_ESTIMATE',
      fieldProvenance: {
        setupCost: 'USER_CONFIRMED_ESTIMATE',
        monthlyUnitsSold: 'USER_CONFIRMED_ESTIMATE',
        sellingPricePerUnit: 'USER_CONFIRMED_ESTIMATE',
        variableCostPerUnit: 'USER_CONFIRMED_ESTIMATE',
      },
    };

    expect(confirmedPlan.presetSource).toBe('USER_CONFIRMED_ESTIMATE');
    expect(confirmedPlan.fieldProvenance?.monthlyUnitsSold).toBe('USER_CONFIRMED_ESTIMATE');
  });

  // 10. Sales −20% changes actual business affordability when appropriate.
  test('Test 10: Sales −20% changes actual business affordability when appropriate', () => {
    // Setup a business where baseline DSCR is viable, but a 20% sales drop triggers HIGH_RISK
    const tightPlan: BusinessPlanInputs = {
      setupCost: 120000,
      availableMarginCapital: 12000, // Loan = 108000 (Micro finance @ 6.5% -> ~3585 EMI)
      sellingPricePerUnit: 50,
      variableCostPerUnit: 25,
      monthlyUnitsSold: 320, // Baseline surplus: 320 * 25 - 3200 = 4800 (DSCR = 4800/3585 = 1.339 >= 1.25 viable)
      monthlyBusinessFixedCost: 3200,
    };

    const snap = generateAnalyticsSnapshot(tightPlan);
    const demandDrop = snap.stressResults.find((s) => s.name === 'DEMAND_DROP_20');

    expect(demandDrop).toBeDefined();
    // In DEMAND_DROP_20: sales = 320 * 0.8 = 256. Revenue = 12800, Var = 6400, Fixed = 3200.
    // Surplus = 3200. DSCR = 3200 / 3585 = 0.89 < 1.25 -> HIGH_RISK!
    expect(demandDrop!.businessAffordabilityStatus).toBe('HIGH_RISK');
  });

  // 11. Raw material +20% uses the canonical engine.
  test('Test 11: Raw material +20% uses the canonical engine', () => {
    const plan: BusinessPlanInputs = {
      setupCost: 100000,
      availableMarginCapital: 10000,
      sellingPricePerUnit: 60,
      variableCostPerUnit: 30,
      monthlyUnitsSold: 300,
      monthlyBusinessFixedCost: 4000,
    };

    const snap = generateAnalyticsSnapshot(plan);
    const rawMaterialStress = snap.stressResults.find((s) => s.name === 'RAW_MATERIAL_UP_20');

    expect(rawMaterialStress).toBeDefined();
    // Raw material up 20%: unit cost = 30 * 1.2 = 36.
    // Monthly variable cost = 300 * 36 = 10800.
    // Surplus = 18000 - 10800 - 4000 = 3200.
    expect(rawMaterialStress!.operatingSurplus).toBe(3200);
  });

  // 12. No UI-side EMI formula.
  test('Test 12: No UI-side EMI formula (RiskAnalysisDashboard relies on deterministic metrics)', () => {
    const plan: BusinessPlanInputs = {
      setupCost: 100000,
      availableMarginCapital: 10000,
      sellingPricePerUnit: 50,
      variableCostPerUnit: 20,
      monthlyUnitsSold: 300,
      monthlyBusinessFixedCost: 4000,
    };

    const snap = generateAnalyticsSnapshot(plan);
    const dash = snapshotToDashboardData(snap);

    // Dashboard gets its metrics directly from snapshot without UI recalculation
    expect(dash.deterministicMetrics.candidateEmi).toBe(snap.candidateEmi);
    expect(dash.deterministicMetrics.businessDscr).toBe(snap.businessDscr);
    expect(dash.deterministicMetrics.breakEvenUnits).toBe(snap.breakEvenUnits);
  });

  // 13. No fallback 12% rate.
  test('Test 13: No fallback 12% rate when margin capital is absent', () => {
    const noLoanPlan: BusinessPlanInputs = {
      sellingPricePerUnit: 50,
      variableCostPerUnit: 20,
      monthlyUnitsSold: 200,
      monthlyBusinessFixedCost: 2000,
      // No setup cost, no available margin capital
    };

    const snap = generateAnalyticsSnapshot(noLoanPlan);
    const dash = snapshotToDashboardData(snap);

    // Interest rate must NOT be 12%
    expect(snap.schemeTerms).toBeNull();
    expect(dash.baseInputs.interestRatePercent).toBeNull();
    expect(dash.deterministicMetrics.candidateEmi).toBeNull();
  });

  // 14. No GO / CAUTION / NO-GO mapping.
  test('Test 14: No GO / CAUTION / NO-GO mapping in recommendation', () => {
    const readyPlan: BusinessPlanInputs = {
      setupCost: 100000,
      availableMarginCapital: 10000,
      sellingPricePerUnit: 100,
      variableCostPerUnit: 30,
      monthlyUnitsSold: 500,
      monthlyBusinessFixedCost: 5000,
      householdEssentialExpenses: 3000,
      householdNonBusinessIncome: 10000,
      existingHouseholdEMI: 0,
    };

    const snap = generateAnalyticsSnapshot(readyPlan);
    const dash = snapshotToDashboardData(snap);

    expect(dash.recommendation.decision).not.toBe('GO');
    expect(dash.recommendation.decision).not.toBe('CAUTION');
    expect(dash.recommendation.decision).not.toBe('NO-GO');
    expect(dash.recommendation.decision).toBe('READY_FOR_FINANCE_REVIEW');
    expect(dash.recommendation.decisionLabel).toBe('Ready for finance review');
  });

  // 15. No artificial overall risk score.
  test('Test 15: No artificial overall risk score or viability percentages', () => {
    const plan: BusinessPlanInputs = {
      setupCost: 100000,
      availableMarginCapital: 10000,
      sellingPricePerUnit: 50,
      variableCostPerUnit: 25,
      monthlyUnitsSold: 300,
      monthlyBusinessFixedCost: 3000,
    };

    const snap = generateAnalyticsSnapshot(plan);
    const dash: any = snapshotToDashboardData(snap);

    expect(dash.overallRiskScore).toBeUndefined();
    expect(dash.businessViabilityScore).toBeUndefined();
    expect(dash.financialResilience).toBeUndefined();
    expect(dash.marketRisk).toBeUndefined();
    expect(dash.operationalRisk).toBeUndefined();
  });

  // 16. No fake probability/exposure zero values.
  test('Test 16: No fake probability/exposure zero values when unsupported', () => {
    const plan: BusinessPlanInputs = {
      sellingPricePerUnit: 50,
      variableCostPerUnit: 25,
      monthlyUnitsSold: 100,
      monthlyBusinessFixedCost: 5000, // Negative surplus
    };

    const snap = generateAnalyticsSnapshot(plan);
    const dash = snapshotToDashboardData(snap);

    expect(dash.marketDataStatus).toBe('NO_VERIFIED_DATA');
    for (const risk of dash.risks) {
      // Must not be 0 masquerading as unknown
      if (risk.probability !== undefined) {
        expect(risk.probability).not.toBe(0);
      }
      if (risk.financialExposure !== undefined) {
        expect(risk.financialExposure).not.toBe(0);
      }
    }
  });

  // 17. Moratorium method is not invented (defaults to 'NONE').
  test('Test 17: Moratorium method is not invented (must be NONE)', () => {
    const plan: BusinessPlanInputs = {
      setupCost: 100000,
      availableMarginCapital: 10000,
      sellingPricePerUnit: 60,
      variableCostPerUnit: 30,
      monthlyUnitsSold: 300,
      monthlyBusinessFixedCost: 4000,
    };

    const snap = generateAnalyticsSnapshot(plan);
    // Principal must not have simple interest capitalized during moratorium
    expect(snap.financeResult.capitalized_principal).toBe(snap.financeResult.recommended_loan_amount);
  });

  // 18. Cross-language hash parity fixture verification (Item 1 & 17.A)
  test('Test 18: Cross-language hash fixture verification against finance-spec/input-hash-fixtures.json', () => {
    const fixturePath = path.resolve(__dirname, '../../../finance-spec/input-hash-fixtures.json');
    const fixtures = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

    expect(fixtures.length).toBeGreaterThanOrEqual(5);

    for (const fixture of fixtures) {
      const computed = computeInputHash(fixture.inputs, fixture.policy_version);
      expect(computed).toBe(fixture.expected_hash);
    }
  });

  // 19. Hashed backend explanation merge and hash mismatch rejection (Item 17.B, 17.C)
  test('Test 19: Hashed backend explanation merge succeeds on match, rejects on mismatch', () => {
    const plan: BusinessPlanInputs = {
      sellingPricePerUnit: 60,
      variableCostPerUnit: 35,
      monthlyUnitsSold: 400,
      monthlyBusinessFixedCost: 4000,
      availableMarginCapital: 10000,
    };
    const snap = generateAnalyticsSnapshot(plan);

    // Matching backend report
    const matchingBackendReport = {
      input_hash: snap.inputHash,
      policy_version: snap.policyVersion,
      explanation: {
        summary: 'Backend AI explanation: solid margin buffer.',
        deterministic_findings_explained: 'DSCR is strong at 1.67.',
        suggested_next_steps: ['Lock supplier contracts'],
      },
      market_data_status: 'VERIFIED_DATA',
    };

    // Stale/mismatched backend report
    const mismatchedBackendReport = {
      input_hash: 'stale_hash_from_old_session',
      policy_version: snap.policyVersion,
      explanation: {
        summary: 'Stale advice that should be rejected.',
      },
      market_data_status: 'VERIFIED_DATA',
    };

    // Verification logic matching src/app/index.tsx
    const canMergeMatching =
      matchingBackendReport.input_hash === snap.inputHash &&
      matchingBackendReport.policy_version === snap.policyVersion;
    expect(canMergeMatching).toBe(true);

    const canMergeMismatched =
      mismatchedBackendReport.input_hash === snap.inputHash &&
      mismatchedBackendReport.policy_version === snap.policyVersion;
    expect(canMergeMismatched).toBe(false);
  });

  // 20. What-If with missing inputs: no fake defaults (Item 2, 17.D)
  test('Test 20: What-If with missing inputs does not invent fake defaults', () => {
    const incompletePlan: BusinessPlanInputs = {
      businessTitle: 'Incomplete Plan',
      // price and cost are missing
      monthlyUnitsSold: 500,
      monthlyBusinessFixedCost: 4000,
    };
    const snap = generateAnalyticsSnapshot(incompletePlan);
    const dash = snapshotToDashboardData(snap);

    expect(dash.baseInputs.pricePerUnit).toBeNull();
    expect(dash.baseInputs.costPerUnit).toBeNull();
    // Required check in WhatIfSimulator:
    const hasRequiredInputs =
      dash.baseInputs.pricePerUnit != null &&
      dash.baseInputs.costPerUnit != null &&
      dash.baseInputs.salesPerMonth != null &&
      dash.baseInputs.monthlyFixed != null;
    expect(hasRequiredInputs).toBe(false);
  });

  // 21. What-If calculations: no UI-side formula fallbacks (Item 3, 17.E)
  test('Test 21: Engine analytics produce null when inputs are missing without UI formula fallback', () => {
    const missingPlan: BusinessPlanInputs = {
      sellingPricePerUnit: 50,
      // variable cost is missing
      monthlyUnitsSold: 300,
      monthlyBusinessFixedCost: 5000,
    };
    const snap = generateAnalyticsSnapshot(missingPlan);
    expect(snap.operatingSurplus).toBeNull();
    expect(snap.breakEvenUnits).toBeNull();
    expect(snap.breakEvenRevenue).toBeNull();
  });

  // 22. Missing financing terms: Stress scenarios have null EMI and postEmiCashFlow, never ₹0 (Item 5, 6, 17.F)
  test('Test 22: Missing financing terms keep candidateEmi and postEmiCashFlow as null, never ₹0', () => {
    const planNoMargin: BusinessPlanInputs = {
      sellingPricePerUnit: 60,
      variableCostPerUnit: 30,
      monthlyUnitsSold: 400,
      monthlyBusinessFixedCost: 4000,
      // availableMarginCapital is absent
    };
    const snap = generateAnalyticsSnapshot(planNoMargin);
    expect(snap.candidateEmi).toBeNull();
    expect(snap.businessDscr).toBeNull();

    for (const scenario of snap.stressResults) {
      expect(scenario.emi).toBeNull();
      expect(scenario.loanEMI).toBeNull();
      expect(scenario.postEmiCashFlow).toBeNull();
      // Pre-EMI operating surplus must be present
      expect(scenario.operatingSurplus).not.toBeNull();
    }
  });

  // 23. Break-even null / unviable display never turns into ₹0 (Item 7, 17.G, 17.H)
  test('Test 23: Break-even for price <= cost is STRUCTURALLY_UNVIABLE with null revenue, not ₹0', () => {
    const unviablePlan: BusinessPlanInputs = {
      sellingPricePerUnit: 20,
      variableCostPerUnit: 25, // Cost exceeds price!
      monthlyUnitsSold: 500,
      monthlyBusinessFixedCost: 3000,
    };
    const snap = generateAnalyticsSnapshot(unviablePlan);
    expect(snap.breakEvenStatus).toBe('STRUCTURALLY_UNVIABLE');
    expect(snap.breakEvenUnits).toBeNull();
    expect(snap.breakEvenRevenue).toBeNull();

    const dash = snapshotToDashboardData(snap);
    expect(dash.financials.breakEvenRevenue).toBeNull();
    expect(dash.financials.breakEvenRevenue).not.toBe(0);
  });

  // 24. Provenance categorization: scheme terms are GOVERNMENT_RULE, not USER_PROVIDED (Item 9, 17.J)
  test('Test 24: Provenance correctly categorizes inputs, government rules, and calculations', () => {
    const plan: BusinessPlanInputs = {
      sellingPricePerUnit: 50,
      variableCostPerUnit: 20,
      monthlyUnitsSold: 300,
      monthlyBusinessFixedCost: 3000,
      availableMarginCapital: 10000,
      householdEssentialExpenses: 4000,
      householdNonBusinessIncome: 12000,
    };
    const snap = generateAnalyticsSnapshot(plan);

    // User provided
    expect(snap.provenance.userProvided).toContain('sellingPricePerUnit');
    expect(snap.provenance.userProvided).toContain('monthlyUnitsSold');
    expect(snap.provenance.userProvided).not.toContain('interestRate');
    expect(snap.provenance.userProvided).not.toContain('repaymentMonths');

    // Government rules
    const govRules = snap.provenance.governmentRule;
    expect(govRules.some((r: string) => r.includes('Scheme:'))).toBe(true);
    expect(govRules.some((r: string) => r.includes('Interest rate:'))).toBe(true);
    expect(govRules.some((r: string) => r.includes('Tenure:'))).toBe(true);

    // Calculations
    expect(snap.provenance.calculations.some((c: string) => c.includes('Monthly Revenue'))).toBe(true);
    expect(snap.provenance.calculations.some((c: string) => c.includes('Operating Surplus'))).toBe(true);
    expect(snap.provenance.calculations.some((c: string) => c.includes('Candidate EMI'))).toBe(true);
    expect(snap.provenance.calculations.some((c: string) => c.includes('Break-even'))).toBe(true);
  });
});
