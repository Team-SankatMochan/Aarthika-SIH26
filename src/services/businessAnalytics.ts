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
}

export type ReportStatus =
  | 'LOADING'
  | 'READY'
  | 'PARTIAL_OFFLINE'
  | 'INSUFFICIENT_DATA'
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
  readiness: string;
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
  missingFields: string[];

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
  overallReadiness: string;

  // Business-only analysis availability
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
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isPresent(v: any): v is number {
  return v !== null && v !== undefined;
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
    // Requested loan: use user-provided if available, else use scheme max loan component
    inputs.requested_loan_amount = isPresent(plan.requestedLoanAmount)
      ? plan.requestedLoanAmount
      : scheme.maxLoanComponent;
    inputs.maximum_scheme_loan_amount = scheme.schemeLoanCap;
    inputs.annual_interest_rate_percent = scheme.interestRate;
    inputs.repayment_tenure_months = scheme.activeRepaymentMonths;
    inputs.moratorium_months = scheme.moratoriumMonths;
    inputs.moratorium_interest_method = 'SIMPLE_CAPITALIZE';
  } else if (isPresent(plan.requestedLoanAmount)) {
    // User supplied loan amount but no scheme terms — financing structure is incomplete
    inputs.requested_loan_amount = plan.requestedLoanAmount;
  }

  return inputs;
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

  if (status !== 'ERROR' && missingFields.length > 0) {
    status = operatingSurplus !== null ? 'READY' : 'INSUFFICIENT_DATA';
  }

  return {
    status,
    source: 'LOCAL_DETERMINISTIC',
    timestamp: Date.now(),
    missingFields,
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
    overallReadiness,
    businessAnalysisAvailable,
    householdAnalysisAvailable,
    stressResults,
    riskFindings,
    swot,
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

  // BASELINE
  scenarios.push({
    name: 'BASELINE',
    label: 'Current Plan',
    revenue: baseRevenue,
    variableCost: baseVarCost,
    fixedCost: baseFixed,
    operatingSurplus: baseSurplus,
    emi: baseEmi || null,
    dscr: baseResult.business_dscr ?? null,
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
    scenarios.push({
      name: 'DEMAND_DROP_20',
      label: 'Sales −20%',
      revenue: rev,
      variableCost: varC,
      fixedCost: fixed,
      operatingSurplus: surplus,
      emi: emi || null,
      dscr: demandResult.business_dscr ?? null,
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
    scenarios.push({
      name: 'RAW_MATERIAL_UP_20',
      label: 'Input Cost +20%',
      revenue: rev,
      variableCost: varC,
      fixedCost: fixed,
      operatingSurplus: surplus,
      emi: emi || null,
      dscr: rawMatResult.business_dscr ?? null,
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

  // Stress scenario: demand shock
  const demandStress = stressResults.find(s => s.name === 'DEMAND_DROP_20');
  if (demandStress && (demandStress.readiness === 'HIGH_RISK' || (demandStress.operatingSurplus <= 0))) {
    findings.push({
      risk: 'Demand-shock sensitivity',
      category: 'Market Risk',
      severity: 'Medium',
      impact: 'Medium',
      source: 'AARTHIKA_CALCULATION',
      detail: `A 20% drop in sales volume moves the business to ${demandStress.readiness || 'negative surplus'}.`,
    });
  }

  // Stress scenario: input cost
  const rawMatStress = stressResults.find(s => s.name === 'RAW_MATERIAL_UP_20');
  if (rawMatStress && (rawMatStress.readiness === 'HIGH_RISK' || (rawMatStress.operatingSurplus <= 0))) {
    findings.push({
      risk: 'Input-cost sensitivity',
      category: 'Operational Risk',
      severity: 'Medium',
      impact: 'Medium',
      source: 'AARTHIKA_CALCULATION',
      detail: `A 20% increase in raw material costs moves the business to ${rawMatStress.readiness || 'negative surplus'}.`,
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

  // Opportunities — only category-level hypotheses
  opportunities.push({
    finding: 'Market evidence not yet verified',
    whyItMatters: 'Local demand, pricing, and competition data needs on-ground validation',
    impact: 'Medium',
    source: 'AI_HYPOTHESIS',
  });

  if (plan.businessCategory) {
    opportunities.push({
      finding: `Explore government scheme eligibility for ${plan.businessCategory}`,
      whyItMatters: 'May qualify for subsidized financing terms',
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
 * Convert an AnalyticsSnapshot to the RiskAnalysisDashboard's RiskData shape.
 * This is the ONLY transformation the dashboard should use.
 */
export function snapshotToDashboardData(snapshot: AnalyticsSnapshot): Record<string, any> {
  const plan = snapshot.inputs;
  const fr = snapshot.financeResult;

  // Compute a real financial resilience ratio from actual data
  const financialResilience = snapshot.monthlyRevenue && snapshot.monthlyRevenue > 0
    ? Math.min(0.95, Math.max(0.05, (snapshot.operatingSurplus ?? 0) / snapshot.monthlyRevenue))
    : 0;

  // Map risk findings to dashboard format
  const risks = snapshot.riskFindings.map(rf => ({
    risk: rf.risk,
    category: rf.category,
    probability: 0, // No fake probabilities — set to 0
    impact: rf.impact,
    severity: rf.severity,
    financialExposure: 0, // Only show if we have a real basis
    mitigation: rf.detail,
  }));

  // Map SWOT
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

  // Derive overall risk posture from actual DSCR and surplus
  const overallRiskScore = snapshot.businessDscr != null
    ? Math.min(1, Math.max(0, 1 - (snapshot.businessDscr / (AARTHIKA_CALCULATION_POLICY.minimum_required_dscr * 2))))
    : (snapshot.operatingSurplus != null && snapshot.operatingSurplus <= 0 ? 0.85 : 0.5);

  const businessViabilityScore = snapshot.operatingSurplus != null && snapshot.monthlyRevenue != null && snapshot.monthlyRevenue > 0
    ? Math.min(1, Math.max(0, snapshot.operatingSurplus / snapshot.monthlyRevenue))
    : 0;

  // Loan terms from scheme
  const schemeInterest = snapshot.schemeTerms?.interestRate ?? null;
  const schemeTenure = snapshot.schemeTerms?.activeRepaymentMonths ?? null;

  return {
    overallRiskScore,
    businessViabilityScore,
    financialResilience,
    marketRisk: 0, // NO fake market risk — we have no verified data
    operationalRisk: 0, // NO fake operational risk
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
      setupCost: plan.setupCost ?? 0,
      loanAmount: fr.recommended_loan_amount ?? fr.requested_loan_amount ?? 0,
      interestRatePercent: schemeInterest ?? 0,
      loanTenureMonths: schemeTenure ?? 0,
    },
    scenarios: snapshot.stressResults,
    recommendation: {
      decision: snapshot.overallReadiness === 'READY_FOR_FINANCE_REVIEW' ? 'GO'
        : snapshot.overallReadiness === 'HIGH_RISK' ? 'CAUTION'
        : 'REVIEW',
      rationale: snapshot.overallReadiness === 'READY_FOR_FINANCE_REVIEW'
        ? 'Business economics and household affordability meet policy thresholds.'
        : snapshot.overallReadiness === 'HIGH_RISK'
        ? 'One or more critical thresholds are not met. Review the specific risk findings.'
        : 'Analysis is incomplete — additional information is needed.',
      supportingPoints: snapshot.missingFields.length > 0
        ? [`Missing data: ${snapshot.missingFields.join(', ')}`]
        : [],
      actionItems: [
        ...(snapshot.missingFields.length > 0 ? ['Provide missing business/household data'] : []),
        'Validate local market demand on-ground',
        'Confirm supplier pricing and availability',
      ],
    },
    // Extra fields for enhanced display
    analyticsSnapshot: snapshot,
  };
}
