/**
 * Canonical Business Analytics Service
 *
 * Single reusable module that converts confirmed business-plan inputs into
 * canonical FinanceEngine inputs, runs deterministic calculations, generates
 * stress scenarios, and produces dynamic risk findings & SWOT.
 *
 * All screens (MyPlanScreen, RiskTestScreen, RiskAnalysisDashboard) must
 * consume the snapshot this service produces — never independently recalculate.
 */

import { calculateFinancialAssessment, formatINR } from '../../engine/financeCalculator';
import { getSIHSchemeTerms, AARTHIKA_CALCULATION_POLICY } from '../engine/SIHSchemeRules';

// ── Types ───────────────────────────────────────────────────────────────────

export type DataProvenance =
  | 'USER_PROVIDED'
  | 'USER_CONFIRMED_ESTIMATE'
  | 'SUGGESTED_ESTIMATE'
  | 'AARTHIKA_CALCULATION'
  | 'GOVERNMENT_RULE'
  | 'AI_HYPOTHESIS'
  | 'NOT_PROVIDED';

export interface BusinessPlanInputs {
  // Business identity
  businessCategory?: string;
  businessTitle?: string;

  // Setup / project cost
  setupCost?: number | null;

  // Available margin capital (user's own money)
  availableMarginCapital?: number | null;

  // Unit economics
  monthlyUnitsSold?: number | null;
  sellingPricePerUnit?: number | null;
  variableCostPerUnit?: number | null;

  // Business fixed costs
  monthlyBusinessFixedCost?: number | null;
  // (Optional granular breakdown — only if user explicitly provided them)
  monthlyLabourCost?: number | null;
  monthlyRent?: number | null;
  monthlyTransportCost?: number | null;
  monthlyOtherFixedCost?: number | null;

  // Household data (separate from business)
  householdEssentialExpenses?: number | null;
  householdNonBusinessIncome?: number | null;
  existingHouseholdEMI?: number | null;

  // Loan request (only if user explicitly supplied)
  requestedLoanAmount?: number | null;

  // Unit type label for display
  unitType?: string;

  // Track field-level provenance
  fieldProvenance?: Record<string, DataProvenance>;
  presetSource?: string | null;
}

export type ReportStatus =
  | 'LOADING'
  | 'READY'
  | 'PARTIAL'
  | 'PARTIAL_OFFLINE'
  | 'INSUFFICIENT_DATA'
  | 'BACKEND_UNAVAILABLE'
  | 'ERROR';

export interface StressScenarioResult {
  name: string;
  label: string;
  revenue: number;
  variableCost: number;
  fixedCost: number;
  operatingSurplus: number;
  emi: number | null;
  dscr: number | null;
  businessAffordabilityStatus: string;
  householdAffordabilityStatus: string;
  overallReadiness: string;
  readiness: string; // for backward compatibility, mirrors overallReadiness
  revenueChange: number;
  costChange: number;
  netCashFlow: number;
  monthlyRevenue: number;
  monthlyExpenses: number;
  loanEMI: number;
}

export interface RiskFinding {
  risk: string;
  category: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  impact: 'Low' | 'Medium' | 'High';
  source: DataProvenance;
  detail: string;
  probability?: number | null;
  financialExposure?: number | null;
}

export interface SwotItem {
  finding: string;
  whyItMatters: string;
  impact: 'Low' | 'Medium' | 'High';
  source: DataProvenance;
}

export interface AnalyticsSnapshot {
  // Report metadata
  status: ReportStatus;
  source: 'LOCAL_DETERMINISTIC' | 'BACKEND_ENHANCED';
  timestamp: number;
  policyVersion: string;
  inputHash: string;
  missingFields: string[];

  // Section status breakdown (Section Z)
  businessAnalysisStatus: 'COMPLETE' | 'VIABLE' | 'STRUCTURALLY_UNVIABLE' | 'INSUFFICIENT_DATA';
  financingAnalysisStatus: 'COMPLETE' | 'SCHEME_ROUTED' | 'INCOMPLETE';
  householdAnalysisStatus: 'COMPLETE' | 'INCOMPLETE' | 'INSUFFICIENT_DATA';
  marketAnalysisStatus: 'VERIFIED_DATA' | 'NO_VERIFIED_DATA';

  // Raw user inputs
  inputs: BusinessPlanInputs;

  // Scheme terms (if margin capital is available)
  schemeTerms: ReturnType<typeof getSIHSchemeTerms> | null;

  // Canonical finance engine results
  financeResult: Record<string, any>;

  // Computed display values
  monthlyRevenue: number | null;
  monthlyVariableCost: number | null;
  monthlyFixedCost: number | null;
  contributionMargin: number | null;
  operatingSurplus: number | null;
  breakEvenUnits: number | null;
  breakEvenStatus: string | null;
  breakEvenRevenue: number | null;
  candidateEmi: number | null;
  businessDscr: number | null;
  maximumAffordableEmi: number | null;
  affordableLoanAmount: number | null;
  recommendedLoanAmount: number | null;
  householdDebtRatio: number | null;
  businessAffordabilityStatus: string;
  householdAffordabilityStatus: string;
  overallReadiness: string;

  // Availability flags
  businessAnalysisAvailable: boolean;
  householdAnalysisAvailable: boolean;

  // Stress scenarios
  stressResults: StressScenarioResult[];

  // Dynamic risk findings
  riskFindings: RiskFinding[];

  // Dynamic SWOT
  swot: {
    strengths: SwotItem[];
    weaknesses: SwotItem[];
    opportunities: SwotItem[];
    threats: SwotItem[];
  };

  // Provenance breakdown
  provenance: {
    userProvided: string[];
    calculations: string[];
    governmentRule: string;
    marketData: 'NO_VERIFIED_DATA' | 'VERIFIED_DATA';
    aiExplanationOnly: boolean;
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isPresent(v: any): v is number {
  return v !== null && v !== undefined;
}

/**
 * Format editable string value.
 * Explicit 0 remains '0'. Missing (null / undefined) remains ''.
 */
export function editableValue(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

/**
 * Create a completely blank custom business.
 * Never inherits stale preset assumptions.
 */
export function createBlankCustomBusiness(title: string) {
  return {
    sector: 'custom',
    title,
    setupCost: null,
    monthlyFixed: null,
    unitType: '',
    pricePerUnit: null,
    costPerUnit: null,
    salesPerMonth: null,
    householdEssentialExpenses: null,
    householdIncome: null,
    existingEMI: null,
    availableMarginCapital: null,
    requestedLoanAmount: null,
    presetSource: null,
    breakdown: [],
  };
}

/**
 * Pure JS SHA-256 implementation for portable input hashing across React Native and Node.
 */
function sha256Hex(str: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let i: number, j: number;
  let result = '';

  const words: number[] = [];
  const asciiBitLength = str.length * 8;

  let hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  for (i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i);
    words[i >> 2] |= charCode << ((3 - (i % 4)) * 8);
  }
  words[asciiBitLength >> 5] |= 0x80 << (24 - (asciiBitLength % 32));
  words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;

  for (i = 0; i < words.length; i += 16) {
    const w = words.slice(i, i + 16);
    const oldHash = hash.slice(0);

    for (j = 0; j < 64; j++) {
      if (j >= 16) {
        const s0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        const s1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
      }
      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const s0 = rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
      const s1 = rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);
      const temp1 = hash[7] + s1 + ch + k[j] + (w[j] | 0);
      const temp2 = s0 + maj;

      hash = [(temp1 + temp2) | 0, hash[0], hash[1], hash[2], (hash[3] + temp1) | 0, hash[4], hash[5], hash[6]];
    }
    for (j = 0; j < 8; j++) {
      hash[j] = (hash[j] + oldHash[j]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const b = (hash[i] >> (8 * j)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

/**
 * Compute SHA-256 hash matching backend compute_input_hash
 */
export function computeInputHash(inputs: Record<string, any>, policyVersion: string): string {
  const canonical: Record<string, string> = {};
  const sortedKeys = Object.keys(inputs).sort();
  for (const k of sortedKeys) {
    const v = inputs[k];
    if (v !== null && v !== undefined) {
      canonical[k] = String(v);
    }
  }
  canonical['_policy_version'] = String(policyVersion);
  return sha256Hex(JSON.stringify(canonical));
}

// ── Core Analytics ──────────────────────────────────────────────────────────

/**
 * Build a canonical FinanceEngine input object from user's business plan inputs.
 * Maps front-end fields to the engine's expected fields.
 * Never fabricates values — missing stays missing.
 */
export function buildCanonicalInputs(plan: BusinessPlanInputs): Record<string, any> {
  const inputs: Record<string, any> = {};

  // Unit economics
  if (isPresent(plan.monthlyUnitsSold)) inputs.monthly_units_sold = plan.monthlyUnitsSold;
  if (isPresent(plan.sellingPricePerUnit)) inputs.selling_price_per_unit = plan.sellingPricePerUnit;
  if (isPresent(plan.variableCostPerUnit)) inputs.variable_cost_per_unit = plan.variableCostPerUnit;

  // Fixed costs: use aggregate if provided, else use granular components
  if (isPresent(plan.monthlyBusinessFixedCost)) {
    inputs.monthly_fixed_cost = plan.monthlyBusinessFixedCost;
  } else {
    // Only set granular fields if they were explicitly provided
    if (isPresent(plan.monthlyLabourCost)) inputs.monthly_labour_cost = plan.monthlyLabourCost;
    if (isPresent(plan.monthlyRent)) inputs.monthly_rent = plan.monthlyRent;
    if (isPresent(plan.monthlyTransportCost)) inputs.monthly_transport_cost = plan.monthlyTransportCost;
    if (isPresent(plan.monthlyOtherFixedCost)) inputs.monthly_other_fixed_cost = plan.monthlyOtherFixedCost;
  }

  // Household data (entirely separate from business)
  if (isPresent(plan.householdNonBusinessIncome)) {
    inputs.monthly_household_nonbusiness_income = plan.householdNonBusinessIncome;
  }
  if (isPresent(plan.householdEssentialExpenses)) {
    inputs.monthly_household_essential_expenses = plan.householdEssentialExpenses;
  }
  if (isPresent(plan.existingHouseholdEMI)) {
    inputs.existing_monthly_household_debt_payments = plan.existingHouseholdEMI;
  }

  // Loan / scheme terms — derive from margin capital via SIH scheme rules
  const scheme = isPresent(plan.availableMarginCapital) && plan.availableMarginCapital! > 0
    ? getSIHSchemeTerms(plan.availableMarginCapital!)
    : null;

  if (scheme && !scheme.isOutOfScope) {
    inputs.requested_loan_amount = isPresent(plan.requestedLoanAmount)
      ? plan.requestedLoanAmount
      : scheme.maxLoanComponent;
    inputs.maximum_scheme_loan_amount = scheme.schemeLoanCap;
    inputs.annual_interest_rate_percent = scheme.interestRate;
    inputs.repayment_tenure_months = scheme.activeRepaymentMonths;
    inputs.moratorium_months = scheme.moratoriumMonths;
    // Section K: Moratorium interest method defaults to 'NONE' unless versioned gov rule says otherwise.
    inputs.moratorium_interest_method = 'NONE';
  } else if (isPresent(plan.requestedLoanAmount)) {
    // User supplied loan amount but no scheme terms — financing structure is incomplete
    inputs.requested_loan_amount = plan.requestedLoanAmount;
  }

  return inputs;
}

function deriveBusinessAffordabilityStatus(dscr: number | null, operatingSurplus: number | null, fallback?: string): string {
  if (dscr !== null) {
    return dscr >= AARTHIKA_CALCULATION_POLICY.minimum_required_dscr
      ? 'READY_FOR_FINANCE_REVIEW'
      : 'HIGH_RISK';
  }
  if (operatingSurplus !== null && operatingSurplus < 0) {
    return 'HIGH_RISK';
  }
  return fallback ?? 'INCOMPLETE';
}

/**
 * Generate the full deterministic analytics snapshot from user inputs.
 */
export function generateAnalyticsSnapshot(plan: BusinessPlanInputs): AnalyticsSnapshot {
  const canonicalInputs = buildCanonicalInputs(plan);
  const scheme = isPresent(plan.availableMarginCapital) && plan.availableMarginCapital! > 0
    ? getSIHSchemeTerms(plan.availableMarginCapital!)
    : null;

  let financeResult: Record<string, any> = {};
  let status: ReportStatus = 'READY';
  const missingFields: string[] = [];
  if (!isPresent(plan.monthlyUnitsSold)) missingFields.push('monthly_units_sold');
  if (!isPresent(plan.sellingPricePerUnit)) missingFields.push('selling_price_per_unit');
  if (!isPresent(plan.variableCostPerUnit)) missingFields.push('variable_cost_per_unit');

  try {
    financeResult = calculateFinancialAssessment(canonicalInputs, AARTHIKA_CALCULATION_POLICY);
    if (financeResult.missing_fields) {
      missingFields.push(...financeResult.missing_fields);
    }
  } catch (err) {
    console.error('[BusinessAnalytics] Finance calculation error:', err);
    status = 'ERROR';
  }

  // Compute display values
  const monthlyRevenue = financeResult.monthly_revenue ?? null;
  const monthlyVariableCost = financeResult.monthly_variable_cost ?? null;
  const monthlyFixedCost = financeResult.monthly_fixed_cost ?? null;
  const contributionMargin = financeResult.unit_contribution_margin ?? null;
  const operatingSurplus = financeResult.monthly_operating_surplus ?? null;
  const breakEvenUnits = financeResult.break_even_units ?? null;
  const breakEvenStatus = financeResult.break_even_status ?? null;
  const breakEvenRevenue = breakEvenUnits != null && isPresent(plan.sellingPricePerUnit)
    ? breakEvenUnits * plan.sellingPricePerUnit!
    : null;
  const candidateEmi = financeResult.candidate_emi ?? null;
  const businessDscr = financeResult.business_dscr ?? null;
  const maximumAffordableEmi = financeResult.maximum_affordable_emi ?? null;
  const affordableLoanAmount = financeResult.affordable_loan_amount ?? null;
  const recommendedLoanAmount = financeResult.recommended_loan_amount ?? null;
  const householdDebtRatio = financeResult.post_loan_household_debt_ratio ?? null;

  // Section P: Derive businessAffordabilityStatus independently from household data
  const businessAffordabilityStatus = deriveBusinessAffordabilityStatus(
    businessDscr,
    operatingSurplus,
    financeResult.business_affordability_status
  );
  const householdAffordabilityStatus = financeResult.household_affordability_status ?? 'INCOMPLETE';
  const overallReadiness = financeResult.overall_readiness ?? 'INCOMPLETE';

  const businessAnalysisAvailable = operatingSurplus !== null;
  const householdAnalysisAvailable =
    financeResult.household_affordability_status !== 'INSUFFICIENT_DATA' &&
    financeResult.household_affordability_status !== undefined;

  // Generate stress scenarios using actual inputs
  const stressResults = generateStressScenarios(plan, canonicalInputs, financeResult);

  // Generate dynamic risk findings
  const riskFindings = generateDynamicRiskFindings(plan, financeResult, stressResults);

  // Generate dynamic SWOT
  const swot = generateDynamicSwot(plan, financeResult, stressResults);

  // Section Z: Section statuses
  const businessAnalysisStatus: AnalyticsSnapshot['businessAnalysisStatus'] =
    operatingSurplus === null
      ? 'INSUFFICIENT_DATA'
      : breakEvenStatus === 'STRUCTURALLY_UNVIABLE'
      ? 'STRUCTURALLY_UNVIABLE'
      : 'COMPLETE';

  const financingAnalysisStatus: AnalyticsSnapshot['financingAnalysisStatus'] =
    candidateEmi !== null && businessDscr !== null
      ? 'COMPLETE'
      : scheme && !scheme.isOutOfScope
      ? 'SCHEME_ROUTED'
      : 'INCOMPLETE';

  const householdAnalysisStatus: AnalyticsSnapshot['householdAnalysisStatus'] =
    householdDebtRatio !== null
      ? 'COMPLETE'
      : financeResult.household_affordability_status === 'INSUFFICIENT_DATA'
      ? 'INSUFFICIENT_DATA'
      : 'INCOMPLETE';

  const marketAnalysisStatus: AnalyticsSnapshot['marketAnalysisStatus'] = 'NO_VERIFIED_DATA';

  // Section Z: Overall report status
  if (status !== 'ERROR') {
    if (businessAnalysisStatus === 'INSUFFICIENT_DATA') {
      status = 'INSUFFICIENT_DATA';
    } else if (financingAnalysisStatus === 'COMPLETE' && householdAnalysisStatus === 'COMPLETE') {
      status = 'READY';
    } else {
      status = 'PARTIAL';
    }
  }

  const policyVersion = String(AARTHIKA_CALCULATION_POLICY.policy_version || 'policy-2026-v1');
  const inputHash = computeInputHash(canonicalInputs, policyVersion);

  const provenance = {
    userProvided: Object.keys(canonicalInputs).filter(k => canonicalInputs[k] !== undefined && canonicalInputs[k] !== null),
    calculations: ['Revenue', 'Break-even', 'Candidate EMI', 'Business DSCR', 'Stress Scenarios'],
    governmentRule: scheme && !scheme.isOutOfScope ? scheme.schemeName : 'None (No margin capital provided)',
    marketData: 'NO_VERIFIED_DATA' as const,
    aiExplanationOnly: true,
  };

  return {
    status,
    source: 'LOCAL_DETERMINISTIC',
    timestamp: Date.now(),
    policyVersion,
    inputHash,
    missingFields,
    businessAnalysisStatus,
    financingAnalysisStatus,
    householdAnalysisStatus,
    marketAnalysisStatus,
    inputs: plan,
    schemeTerms: scheme,
    financeResult,
    monthlyRevenue,
    monthlyVariableCost,
    monthlyFixedCost,
    contributionMargin,
    operatingSurplus,
    breakEvenUnits,
    breakEvenStatus,
    breakEvenRevenue,
    candidateEmi,
    businessDscr,
    maximumAffordableEmi,
    affordableLoanAmount,
    recommendedLoanAmount,
    householdDebtRatio,
    businessAffordabilityStatus,
    householdAffordabilityStatus,
    overallReadiness,
    businessAnalysisAvailable,
    householdAnalysisAvailable,
    stressResults,
    riskFindings,
    swot,
    provenance,
  };
}

// ── Stress Scenarios ────────────────────────────────────────────────────────

function generateStressScenarios(
  plan: BusinessPlanInputs,
  baseInputs: Record<string, any>,
  baseResult: Record<string, any>,
): StressScenarioResult[] {
  const scenarios: StressScenarioResult[] = [];

  if (!isPresent(plan.monthlyUnitsSold) || !isPresent(plan.sellingPricePerUnit) || !isPresent(plan.variableCostPerUnit)) {
    return scenarios;
  }

  const baseRevenue = baseResult.monthly_revenue ?? 0;
  const baseVarCost = baseResult.monthly_variable_cost ?? 0;
  const baseFixed = baseResult.monthly_fixed_cost ?? 0;
  const baseSurplus = baseResult.monthly_operating_surplus ?? 0;
  const baseEmi = baseResult.candidate_emi ?? 0;

  const baseDscr = baseResult.business_dscr ?? null;
  const baseBizStatus = deriveBusinessAffordabilityStatus(baseDscr, baseSurplus, baseResult.business_affordability_status);

  // BASELINE
  scenarios.push({
    name: 'BASELINE',
    label: 'Current Plan',
    revenue: baseRevenue,
    variableCost: baseVarCost,
    fixedCost: baseFixed,
    operatingSurplus: baseSurplus,
    emi: baseEmi || null,
    dscr: baseDscr,
    businessAffordabilityStatus: baseBizStatus,
    householdAffordabilityStatus: baseResult.household_affordability_status ?? 'INCOMPLETE',
    overallReadiness: baseResult.overall_readiness ?? 'INCOMPLETE',
    readiness: baseResult.overall_readiness ?? 'INCOMPLETE',
    revenueChange: 0,
    costChange: 0,
    netCashFlow: baseSurplus - baseEmi,
    monthlyRevenue: baseRevenue,
    monthlyExpenses: baseVarCost + baseFixed,
    loanEMI: baseEmi,
  });

  // DEMAND_DROP_20: reduce monthly units by 20%
  const demandDropInputs = { ...baseInputs };
  if (demandDropInputs.monthly_units_sold != null) {
    demandDropInputs.monthly_units_sold = Math.round(demandDropInputs.monthly_units_sold * 0.80);
  }
  try {
    const demandResult = calculateFinancialAssessment(demandDropInputs, AARTHIKA_CALCULATION_POLICY);
    const rev = demandResult.monthly_revenue ?? 0;
    const varC = demandResult.monthly_variable_cost ?? 0;
    const fixed = demandResult.monthly_fixed_cost ?? 0;
    const surplus = demandResult.monthly_operating_surplus ?? 0;
    const emi = demandResult.candidate_emi ?? baseEmi;
    const dscr = demandResult.business_dscr ?? (emi > 0 ? surplus / emi : null);
    const bizStatus = deriveBusinessAffordabilityStatus(dscr, surplus, demandResult.business_affordability_status);

    scenarios.push({
      name: 'DEMAND_DROP_20',
      label: 'Sales −20%',
      revenue: rev,
      variableCost: varC,
      fixedCost: fixed,
      operatingSurplus: surplus,
      emi: emi || null,
      dscr,
      businessAffordabilityStatus: bizStatus,
      householdAffordabilityStatus: demandResult.household_affordability_status ?? 'INCOMPLETE',
      overallReadiness: demandResult.overall_readiness ?? 'INCOMPLETE',
      readiness: demandResult.overall_readiness ?? 'INCOMPLETE',
      revenueChange: -20,
      costChange: 0,
      netCashFlow: surplus - emi,
      monthlyRevenue: rev,
      monthlyExpenses: varC + fixed,
      loanEMI: emi,
    });
  } catch (e) {
    console.warn('[BusinessAnalytics] DEMAND_DROP_20 stress failed:', e);
  }

  // RAW_MATERIAL_UP_20: increase variable cost by 20%
  const rawMatInputs = { ...baseInputs };
  if (rawMatInputs.variable_cost_per_unit != null) {
    rawMatInputs.variable_cost_per_unit = rawMatInputs.variable_cost_per_unit * 1.20;
  }
  try {
    const rawMatResult = calculateFinancialAssessment(rawMatInputs, AARTHIKA_CALCULATION_POLICY);
    const rev = rawMatResult.monthly_revenue ?? 0;
    const varC = rawMatResult.monthly_variable_cost ?? 0;
    const fixed = rawMatResult.monthly_fixed_cost ?? 0;
    const surplus = rawMatResult.monthly_operating_surplus ?? 0;
    const emi = rawMatResult.candidate_emi ?? baseEmi;
    const dscr = rawMatResult.business_dscr ?? (emi > 0 ? surplus / emi : null);
    const bizStatus = deriveBusinessAffordabilityStatus(dscr, surplus, rawMatResult.business_affordability_status);

    scenarios.push({
      name: 'RAW_MATERIAL_UP_20',
      label: 'Input Cost +20%',
      revenue: rev,
      variableCost: varC,
      fixedCost: fixed,
      operatingSurplus: surplus,
      emi: emi || null,
      dscr,
      businessAffordabilityStatus: bizStatus,
      householdAffordabilityStatus: rawMatResult.household_affordability_status ?? 'INCOMPLETE',
      overallReadiness: rawMatResult.overall_readiness ?? 'INCOMPLETE',
      readiness: rawMatResult.overall_readiness ?? 'INCOMPLETE',
      revenueChange: 0,
      costChange: 20,
      netCashFlow: surplus - emi,
      monthlyRevenue: rev,
      monthlyExpenses: varC + fixed,
      loanEMI: emi,
    });
  } catch (e) {
    console.warn('[BusinessAnalytics] RAW_MATERIAL_UP_20 stress failed:', e);
  }

  return scenarios;
}

// ── Dynamic Risk Findings ───────────────────────────────────────────────────

function generateDynamicRiskFindings(
  plan: BusinessPlanInputs,
  financeResult: Record<string, any>,
  stressResults: StressScenarioResult[],
): RiskFinding[] {
  const findings: RiskFinding[] = [];

  const contributionMargin = financeResult.unit_contribution_margin;
  const operatingSurplus = financeResult.monthly_operating_surplus;
  const breakEvenUnits = financeResult.break_even_units;
  const breakEvenStatus = financeResult.break_even_status;
  const businessDscr = financeResult.business_dscr;
  const minDscr = AARTHIKA_CALCULATION_POLICY.minimum_required_dscr;
  const hhDebtRatio = financeResult.post_loan_household_debt_ratio;
  const maxHhDebt = AARTHIKA_CALCULATION_POLICY.maximum_household_debt_ratio;

  // Contribution margin risk
  if (contributionMargin != null && contributionMargin <= 0) {
    findings.push({
      risk: 'Structural pricing/cost risk',
      category: 'Business Economics',
      severity: 'Critical',
      impact: 'High',
      source: 'AARTHIKA_CALCULATION',
      detail: `Unit contribution margin is ${formatINR(contributionMargin)}. Selling price does not cover variable cost per unit.`,
    });
  }

  // Break-even risk
  if (breakEvenStatus === 'NO_FINITE_BREAK_EVEN') {
    findings.push({
      risk: 'No finite break-even possible',
      category: 'Business Economics',
      severity: 'Critical',
      impact: 'High',
      source: 'AARTHIKA_CALCULATION',
      detail: 'Contribution margin is zero — fixed costs can never be recovered.',
    });
  } else if (breakEvenStatus === 'STRUCTURALLY_UNVIABLE') {
    findings.push({
      risk: 'Structurally unviable pricing',
      category: 'Business Economics',
      severity: 'Critical',
      impact: 'High',
      source: 'AARTHIKA_CALCULATION',
      detail: 'Price is below variable cost. Every additional unit increases losses.',
    });
  } else if (breakEvenUnits != null && isPresent(plan.monthlyUnitsSold) && breakEvenUnits > plan.monthlyUnitsSold!) {
    findings.push({
      risk: 'Sales volume below break-even',
      category: 'Sales Volume',
      severity: 'High',
      impact: 'High',
      source: 'AARTHIKA_CALCULATION',
      detail: `Break-even requires ${breakEvenUnits} units/month but planned sales are ${plan.monthlyUnitsSold} units.`,
    });
  }

  // Operating viability
  if (operatingSurplus != null && operatingSurplus <= 0) {
    findings.push({
      risk: 'Operating viability risk',
      category: 'Business Economics',
      severity: 'High',
      impact: 'High',
      source: 'AARTHIKA_CALCULATION',
      detail: `Monthly operating surplus is ${formatINR(operatingSurplus)}. Business costs exceed revenue.`,
    });
  }

  // DSCR risk
  if (businessDscr != null && businessDscr < minDscr) {
    findings.push({
      risk: 'Debt-servicing risk',
      category: 'Financing',
      severity: businessDscr < 1 ? 'Critical' : 'High',
      impact: 'High',
      source: 'AARTHIKA_CALCULATION',
      detail: `Business DSCR is ${businessDscr.toFixed(2)}, below the minimum threshold of ${minDscr}.`,
    });
  }

  // Section P: For business stress findings, compare businessAffordabilityStatus
  const demandStress = stressResults.find(s => s.name === 'DEMAND_DROP_20');
  if (demandStress && (demandStress.businessAffordabilityStatus === 'HIGH_RISK' || demandStress.operatingSurplus <= 0)) {
    findings.push({
      risk: 'Demand-shock sensitivity',
      category: 'Market Risk',
      severity: 'Medium',
      impact: 'Medium',
      source: 'AARTHIKA_CALCULATION',
      detail: `A 20% drop in sales volume causes business stress (surplus: ${formatINR(demandStress.operatingSurplus)}, status: ${demandStress.businessAffordabilityStatus}).`,
    });
  }

  const rawMatStress = stressResults.find(s => s.name === 'RAW_MATERIAL_UP_20');
  if (rawMatStress && (rawMatStress.businessAffordabilityStatus === 'HIGH_RISK' || rawMatStress.operatingSurplus <= 0)) {
    findings.push({
      risk: 'Input-cost sensitivity',
      category: 'Operational Risk',
      severity: 'Medium',
      impact: 'Medium',
      source: 'AARTHIKA_CALCULATION',
      detail: `A 20% increase in raw material costs causes business stress (surplus: ${formatINR(rawMatStress.operatingSurplus)}, status: ${rawMatStress.businessAffordabilityStatus}).`,
    });
  }

  // Household affordability
  if (hhDebtRatio != null && hhDebtRatio > maxHhDebt) {
    findings.push({
      risk: 'Household affordability pressure',
      category: 'Household',
      severity: 'Medium',
      impact: 'Medium',
      source: 'AARTHIKA_CALCULATION',
      detail: `Post-loan household debt ratio is ${(hhDebtRatio * 100).toFixed(0)}%, exceeding the ${(maxHhDebt * 100).toFixed(0)}% policy limit.`,
    });
  }

  return findings;
}

// ── Dynamic SWOT ────────────────────────────────────────────────────────────

function generateDynamicSwot(
  plan: BusinessPlanInputs,
  financeResult: Record<string, any>,
  stressResults: StressScenarioResult[],
): AnalyticsSnapshot['swot'] {
  const strengths: SwotItem[] = [];
  const weaknesses: SwotItem[] = [];
  const opportunities: SwotItem[] = [];
  const threats: SwotItem[] = [];

  const cm = financeResult.unit_contribution_margin;
  const surplus = financeResult.monthly_operating_surplus;
  const revenue = financeResult.monthly_revenue;
  const breakEvenUnits = financeResult.break_even_units;
  const dscr = financeResult.business_dscr;
  const breakEvenStatus = financeResult.break_even_status;

  // Strengths
  if (cm != null && cm > 0) {
    const marginPct = revenue > 0 ? ((revenue - financeResult.monthly_variable_cost) / revenue * 100).toFixed(0) : '—';
    strengths.push({
      finding: `Positive contribution margin: ${formatINR(cm)}/unit (${marginPct}% gross margin)`,
      whyItMatters: 'Each unit sold contributes positively to covering fixed costs',
      impact: cm > 10 ? 'High' : 'Medium',
      source: 'AARTHIKA_CALCULATION',
    });
  }

  if (breakEvenUnits != null && isPresent(plan.monthlyUnitsSold) && plan.monthlyUnitsSold! > breakEvenUnits * 1.2) {
    strengths.push({
      finding: `Large break-even buffer: selling ${plan.monthlyUnitsSold} vs ${breakEvenUnits} break-even units`,
      whyItMatters: 'Business can absorb moderate demand drops and still cover costs',
      impact: 'High',
      source: 'AARTHIKA_CALCULATION',
    });
  }

  if (surplus != null && surplus > 0) {
    strengths.push({
      finding: `Positive operating surplus: ${formatINR(surplus)}/month`,
      whyItMatters: 'Business generates cash above operating costs before debt service',
      impact: surplus > 5000 ? 'High' : 'Medium',
      source: 'AARTHIKA_CALCULATION',
    });
  }

  if (dscr != null && dscr >= AARTHIKA_CALCULATION_POLICY.minimum_required_dscr) {
    strengths.push({
      finding: `Healthy debt service coverage: DSCR ${dscr.toFixed(2)}`,
      whyItMatters: `Exceeds the minimum required ${AARTHIKA_CALCULATION_POLICY.minimum_required_dscr}`,
      impact: 'High',
      source: 'AARTHIKA_CALCULATION',
    });
  }

  // Weaknesses
  if (surplus != null && surplus <= 0) {
    weaknesses.push({
      finding: `Negative operating surplus: ${formatINR(surplus)}/month`,
      whyItMatters: 'Business costs exceed revenue — cannot service any debt',
      impact: 'High',
      source: 'AARTHIKA_CALCULATION',
    });
  }

  if (cm != null && cm <= 0) {
    weaknesses.push({
      finding: `Non-positive contribution margin: ${formatINR(cm)}/unit`,
      whyItMatters: 'Selling price does not cover per-unit variable cost',
      impact: 'High',
      source: 'AARTHIKA_CALCULATION',
    });
  }

  if (dscr != null && dscr < AARTHIKA_CALCULATION_POLICY.minimum_required_dscr && dscr > 0) {
    weaknesses.push({
      finding: `Low debt service coverage: DSCR ${dscr.toFixed(2)}`,
      whyItMatters: `Below the required minimum of ${AARTHIKA_CALCULATION_POLICY.minimum_required_dscr}`,
      impact: 'High',
      source: 'AARTHIKA_CALCULATION',
    });
  }

  if (breakEvenStatus === 'NO_FINITE_BREAK_EVEN' || breakEvenStatus === 'STRUCTURALLY_UNVIABLE') {
    weaknesses.push({
      finding: 'No achievable break-even point',
      whyItMatters: 'Current price/cost structure cannot cover fixed costs at any volume',
      impact: 'High',
      source: 'AARTHIKA_CALCULATION',
    });
  }

  // Opportunities
  opportunities.push({
    finding: 'Market evidence not yet verified',
    whyItMatters: 'Local demand, pricing, and competition data needs on-ground validation',
    impact: 'Medium',
    source: 'AI_HYPOTHESIS',
  });

  if (plan.businessCategory) {
    opportunities.push({
      finding: `Explore government scheme eligibility for ${plan.businessCategory}`,
      whyItMatters: 'May qualify for subsidized financing terms under SIH guidelines',
      impact: 'Medium',
      source: 'AI_HYPOTHESIS',
    });
  }

  // Threats
  const demandStress = stressResults.find(s => s.name === 'DEMAND_DROP_20');
  if (demandStress && demandStress.operatingSurplus <= 0) {
    threats.push({
      finding: 'Vulnerable to 20% demand drop',
      whyItMatters: `Operating surplus turns negative (${formatINR(demandStress.operatingSurplus)}) with modest sales decline`,
      impact: 'High',
      source: 'AARTHIKA_CALCULATION',
    });
  }

  const rawMatStress = stressResults.find(s => s.name === 'RAW_MATERIAL_UP_20');
  if (rawMatStress && rawMatStress.operatingSurplus <= 0) {
    threats.push({
      finding: 'Vulnerable to 20% input cost increase',
      whyItMatters: `Operating surplus turns negative (${formatINR(rawMatStress.operatingSurplus)}) with modest cost increase`,
      impact: 'High',
      source: 'AARTHIKA_CALCULATION',
    });
  }

  threats.push({
    finding: 'Market evidence not yet verified — local competition unknown',
    whyItMatters: 'Cannot assess competitive pressure without on-ground data',
    impact: 'Medium',
    source: 'AI_HYPOTHESIS',
  });

  return { strengths, weaknesses, opportunities, threats };
}

/**
 * Convert an AnalyticsSnapshot to the RiskAnalysisDashboard's view model.
 * Pure deterministic metrics — no synthetic scores, no GO/CAUTION/NO-GO, no fake zeros.
 */
export function snapshotToDashboardData(snapshot: AnalyticsSnapshot): Record<string, any> {
  const plan = snapshot.inputs;
  const fr = snapshot.financeResult;

  // Section O: Probability and exposure are null/undefined unless evidence-backed.
  const risks = snapshot.riskFindings.map(rf => ({
    risk: rf.risk,
    category: rf.category,
    probability: rf.probability ?? null,
    impact: rf.impact,
    severity: rf.severity,
    financialExposure: rf.financialExposure ?? null,
    mitigation: rf.detail,
    source: rf.source,
  }));

  // SWOT
  const swot = {
    strengths: snapshot.swot.strengths.map(s => ({
      finding: s.finding,
      whyItMatters: s.whyItMatters,
      impact: s.impact,
      evidence: `Source: ${s.source}`,
    })),
    weaknesses: snapshot.swot.weaknesses.map(w => ({
      finding: w.finding,
      whyItMatters: w.whyItMatters,
      impact: w.impact,
      evidence: `Source: ${w.source}`,
    })),
    opportunities: snapshot.swot.opportunities.map(o => ({
      finding: o.finding,
      whyItMatters: o.whyItMatters,
      impact: o.impact,
      evidence: `Source: ${o.source}`,
    })),
    threats: snapshot.swot.threats.map(t => ({
      finding: t.finding,
      whyItMatters: t.whyItMatters,
      impact: t.impact,
      evidence: `Source: ${t.source}`,
    })),
  };

  // Loan terms from scheme
  const schemeInterest = snapshot.schemeTerms?.interestRate ?? null;
  const schemeTenure = snapshot.schemeTerms?.activeRepaymentMonths ?? null;

  // Canonical readiness label & rationale
  const readiness = snapshot.overallReadiness;
  let humanLabel = 'More information needed';
  let rationale = 'Analysis is incomplete — additional information is needed.';
  if (readiness === 'READY_FOR_FINANCE_REVIEW') {
    humanLabel = 'Ready for finance review';
    rationale = 'Business economics and household affordability meet policy thresholds.';
  } else if (readiness === 'HIGH_RISK') {
    humanLabel = 'Financial pressure detected';
    rationale = 'One or more critical thresholds are not met. Review the specific risk findings.';
  } else if (readiness === 'OUT_OF_SCOPE') {
    humanLabel = 'Outside this scheme route';
    rationale = 'Project cost exceeds maximum limit for the available scheme.';
  }

  return {
    // Section N: Real deterministic metrics
    deterministicMetrics: {
      monthlyRevenue: snapshot.monthlyRevenue,
      monthlyOperatingSurplus: snapshot.operatingSurplus,
      candidateEmi: snapshot.candidateEmi,
      businessDscr: snapshot.businessDscr,
      breakEvenUnits: snapshot.breakEvenUnits,
      maximumAffordableEmi: snapshot.maximumAffordableEmi,
      affordableLoanAmount: snapshot.affordableLoanAmount,
      postLoanHouseholdDebtRatio: snapshot.householdDebtRatio,
      businessReadiness: snapshot.businessAffordabilityStatus,
      householdReadiness: snapshot.householdAffordabilityStatus,
      overallReadiness: snapshot.overallReadiness,
    },
    marketDataStatus: 'NO_VERIFIED_DATA' as const,
    swot,
    risks,
    financials: {
      monthlyRevenue: snapshot.monthlyRevenue ?? 0,
      monthlyExpenses: (snapshot.monthlyVariableCost ?? 0) + (snapshot.monthlyFixedCost ?? 0),
      loanEMI: snapshot.candidateEmi ?? 0,
      netCashFlow: snapshot.operatingSurplus ?? 0,
      breakEvenRevenue: snapshot.breakEvenRevenue ?? 0,
      safetyMargin: snapshot.monthlyRevenue != null && snapshot.breakEvenRevenue != null
        ? snapshot.monthlyRevenue - snapshot.breakEvenRevenue
        : 0,
    },
    baseInputs: {
      pricePerUnit: plan.sellingPricePerUnit ?? 0,
      costPerUnit: plan.variableCostPerUnit ?? 0,
      salesPerMonth: plan.monthlyUnitsSold ?? 0,
      monthlyFixed: snapshot.monthlyFixedCost ?? 0,
      personalCost: plan.householdEssentialExpenses ?? 0,
      householdEssentialExpenses: plan.householdEssentialExpenses ?? 0,
      setupCost: plan.setupCost ?? 0,
      availableMarginCapital: plan.availableMarginCapital ?? null,
      loanAmount: fr.recommended_loan_amount ?? fr.requested_loan_amount ?? null,
      interestRatePercent: schemeInterest,
      loanTenureMonths: schemeTenure,
    },
    scenarios: snapshot.stressResults,
    recommendation: {
      decision: readiness,
      decisionLabel: humanLabel,
      rationale,
      disclaimer: 'This is a business-plan readiness assessment, not loan approval.',
      supportingPoints: snapshot.missingFields.length > 0
        ? [`Missing data: ${snapshot.missingFields.join(', ')}`]
        : [],
      actionItems: [
        ...(snapshot.missingFields.length > 0 ? ['Provide missing business/household data'] : []),
        'Validate local market demand on-ground',
        'Confirm supplier pricing and availability',
      ],
    },
    provenance: snapshot.provenance,
    analyticsSnapshot: snapshot,
  };
}
