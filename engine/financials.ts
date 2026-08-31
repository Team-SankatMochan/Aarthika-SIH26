/* ── Aarthika Financial Engine ────────────────────────────────────
 *  Pure functions — zero dependencies, runs entirely offline.
 *  All monetary values are in INR. Rates are annual percentages.
 * ────────────────────────────────────────────────────────────── */

// ─── City & Location Data ──────────────────────────────────────

export type CityTier = 'tier1' | 'tier2' | 'tier3' | 'rural';

export interface CityData {
  name: string;
  state: string;
  tier: CityTier;
  /** Cost-of-living multiplier relative to national average (1.0) */
  costMultiplier: number;
  /** Average annual lending rate for small business loans (%) */
  avgInterestRate: number;
  /** Natural disaster risk index 0–1 (higher = riskier) */
  disasterRiskIndex: number;
}

export const CITIES: Record<string, CityData> = {
  // ── Tier 1 ──
  mumbai:    { name: 'Mumbai',      state: 'Maharashtra',    tier: 'tier1', costMultiplier: 1.45, avgInterestRate: 10.5, disasterRiskIndex: 0.55 },
  delhi:     { name: 'Delhi',       state: 'Delhi',          tier: 'tier1', costMultiplier: 1.35, avgInterestRate: 10.5, disasterRiskIndex: 0.35 },
  bengaluru: { name: 'Bengaluru',   state: 'Karnataka',      tier: 'tier1', costMultiplier: 1.30, avgInterestRate: 10.5, disasterRiskIndex: 0.20 },
  hyderabad: { name: 'Hyderabad',   state: 'Telangana',      tier: 'tier1', costMultiplier: 1.20, avgInterestRate: 10.5, disasterRiskIndex: 0.30 },
  chennai:   { name: 'Chennai',     state: 'Tamil Nadu',     tier: 'tier1', costMultiplier: 1.25, avgInterestRate: 10.5, disasterRiskIndex: 0.65 },
  kolkata:   { name: 'Kolkata',     state: 'West Bengal',    tier: 'tier1', costMultiplier: 1.15, avgInterestRate: 10.5, disasterRiskIndex: 0.60 },
  pune:      { name: 'Pune',        state: 'Maharashtra',    tier: 'tier1', costMultiplier: 1.20, avgInterestRate: 10.5, disasterRiskIndex: 0.35 },
  ahmedabad: { name: 'Ahmedabad',   state: 'Gujarat',        tier: 'tier1', costMultiplier: 1.10, avgInterestRate: 10.5, disasterRiskIndex: 0.45 },

  // ── Tier 2 ──
  jaipur:       { name: 'Jaipur',       state: 'Rajasthan',       tier: 'tier2', costMultiplier: 1.00, avgInterestRate: 11.5, disasterRiskIndex: 0.30 },
  lucknow:      { name: 'Lucknow',      state: 'Uttar Pradesh',   tier: 'tier2', costMultiplier: 0.95, avgInterestRate: 11.5, disasterRiskIndex: 0.40 },
  kanpur:       { name: 'Kanpur',       state: 'Uttar Pradesh',   tier: 'tier2', costMultiplier: 0.90, avgInterestRate: 11.5, disasterRiskIndex: 0.40 },
  nagpur:       { name: 'Nagpur',       state: 'Maharashtra',     tier: 'tier2', costMultiplier: 0.90, avgInterestRate: 11.5, disasterRiskIndex: 0.25 },
  indore:       { name: 'Indore',       state: 'Madhya Pradesh',  tier: 'tier2', costMultiplier: 0.90, avgInterestRate: 11.5, disasterRiskIndex: 0.20 },
  bhopal:       { name: 'Bhopal',       state: 'Madhya Pradesh',  tier: 'tier2', costMultiplier: 0.90, avgInterestRate: 11.5, disasterRiskIndex: 0.25 },
  visakhapatnam:{ name: 'Visakhapatnam',state: 'Andhra Pradesh',  tier: 'tier2', costMultiplier: 0.95, avgInterestRate: 11.5, disasterRiskIndex: 0.70 },
  patna:        { name: 'Patna',        state: 'Bihar',           tier: 'tier2', costMultiplier: 0.85, avgInterestRate: 12.0, disasterRiskIndex: 0.65 },
  vadodara:     { name: 'Vadodara',     state: 'Gujarat',         tier: 'tier2', costMultiplier: 0.90, avgInterestRate: 11.5, disasterRiskIndex: 0.40 },
  coimbatore:   { name: 'Coimbatore',   state: 'Tamil Nadu',      tier: 'tier2', costMultiplier: 0.95, avgInterestRate: 11.5, disasterRiskIndex: 0.30 },
  surat:        { name: 'Surat',        state: 'Gujarat',         tier: 'tier2', costMultiplier: 1.00, avgInterestRate: 11.5, disasterRiskIndex: 0.50 },
  kochi:        { name: 'Kochi',        state: 'Kerala',          tier: 'tier2', costMultiplier: 1.00, avgInterestRate: 11.5, disasterRiskIndex: 0.60 },
  chandigarh:   { name: 'Chandigarh',   state: 'Chandigarh',      tier: 'tier2', costMultiplier: 1.05, avgInterestRate: 11.0, disasterRiskIndex: 0.20 },
  guwahati:     { name: 'Guwahati',     state: 'Assam',           tier: 'tier2', costMultiplier: 0.90, avgInterestRate: 12.0, disasterRiskIndex: 0.70 },
  bhubaneswar:  { name: 'Bhubaneswar',  state: 'Odisha',          tier: 'tier2', costMultiplier: 0.85, avgInterestRate: 12.0, disasterRiskIndex: 0.75 },

  // ── Tier 3 ──
  agra:        { name: 'Agra',        state: 'Uttar Pradesh',    tier: 'tier3', costMultiplier: 0.80, avgInterestRate: 12.5, disasterRiskIndex: 0.30 },
  varanasi:    { name: 'Varanasi',    state: 'Uttar Pradesh',    tier: 'tier3', costMultiplier: 0.80, avgInterestRate: 12.5, disasterRiskIndex: 0.45 },
  madurai:     { name: 'Madurai',     state: 'Tamil Nadu',       tier: 'tier3', costMultiplier: 0.80, avgInterestRate: 12.5, disasterRiskIndex: 0.35 },
  jodhpur:     { name: 'Jodhpur',     state: 'Rajasthan',        tier: 'tier3', costMultiplier: 0.75, avgInterestRate: 12.5, disasterRiskIndex: 0.25 },
  raipur:      { name: 'Raipur',      state: 'Chhattisgarh',     tier: 'tier3', costMultiplier: 0.80, avgInterestRate: 12.5, disasterRiskIndex: 0.30 },
  ranchi:      { name: 'Ranchi',      state: 'Jharkhand',        tier: 'tier3', costMultiplier: 0.78, avgInterestRate: 12.5, disasterRiskIndex: 0.35 },
  dehradun:    { name: 'Dehradun',    state: 'Uttarakhand',      tier: 'tier3', costMultiplier: 0.85, avgInterestRate: 12.0, disasterRiskIndex: 0.60 },
  mysuru:      { name: 'Mysuru',      state: 'Karnataka',        tier: 'tier3', costMultiplier: 0.85, avgInterestRate: 12.0, disasterRiskIndex: 0.20 },
  udaipur:     { name: 'Udaipur',     state: 'Rajasthan',        tier: 'tier3', costMultiplier: 0.78, avgInterestRate: 12.5, disasterRiskIndex: 0.20 },
  shimla:      { name: 'Shimla',      state: 'Himachal Pradesh', tier: 'tier3', costMultiplier: 0.85, avgInterestRate: 12.0, disasterRiskIndex: 0.55 },
  jammu:       { name: 'Jammu',       state: 'J&K',              tier: 'tier3', costMultiplier: 0.80, avgInterestRate: 12.5, disasterRiskIndex: 0.55 },
  trichy:      { name: 'Tiruchirappalli', state: 'Tamil Nadu',   tier: 'tier3', costMultiplier: 0.75, avgInterestRate: 12.5, disasterRiskIndex: 0.35 },
  vijayawada:  { name: 'Vijayawada',  state: 'Andhra Pradesh',   tier: 'tier3', costMultiplier: 0.80, avgInterestRate: 12.5, disasterRiskIndex: 0.60 },
  gwalior:     { name: 'Gwalior',     state: 'Madhya Pradesh',   tier: 'tier3', costMultiplier: 0.75, avgInterestRate: 12.5, disasterRiskIndex: 0.25 },
  jabalpur:    { name: 'Jabalpur',    state: 'Madhya Pradesh',   tier: 'tier3', costMultiplier: 0.75, avgInterestRate: 12.5, disasterRiskIndex: 0.25 },
  hubli:       { name: 'Hubli-Dharwad', state: 'Karnataka',      tier: 'tier3', costMultiplier: 0.78, avgInterestRate: 12.5, disasterRiskIndex: 0.20 },

  // ── Rural (representative clusters) ──
  rural_up:    { name: 'Rural UP',          state: 'Uttar Pradesh',    tier: 'rural', costMultiplier: 0.60, avgInterestRate: 14.0, disasterRiskIndex: 0.50 },
  rural_bihar: { name: 'Rural Bihar',       state: 'Bihar',            tier: 'rural', costMultiplier: 0.55, avgInterestRate: 14.5, disasterRiskIndex: 0.70 },
  rural_mp:    { name: 'Rural MP',          state: 'Madhya Pradesh',   tier: 'rural', costMultiplier: 0.55, avgInterestRate: 14.0, disasterRiskIndex: 0.30 },
  rural_raj:   { name: 'Rural Rajasthan',   state: 'Rajasthan',        tier: 'rural', costMultiplier: 0.55, avgInterestRate: 14.0, disasterRiskIndex: 0.35 },
  rural_odisha:{ name: 'Rural Odisha',      state: 'Odisha',           tier: 'rural', costMultiplier: 0.55, avgInterestRate: 14.5, disasterRiskIndex: 0.80 },
  rural_assam: { name: 'Rural Assam',       state: 'Assam',            tier: 'rural', costMultiplier: 0.55, avgInterestRate: 14.5, disasterRiskIndex: 0.75 },
  rural_mh:    { name: 'Rural Maharashtra', state: 'Maharashtra',      tier: 'rural', costMultiplier: 0.60, avgInterestRate: 13.5, disasterRiskIndex: 0.40 },
  rural_tn:    { name: 'Rural Tamil Nadu',  state: 'Tamil Nadu',       tier: 'rural', costMultiplier: 0.60, avgInterestRate: 13.5, disasterRiskIndex: 0.45 },
  rural_ker:   { name: 'Rural Kerala',      state: 'Kerala',           tier: 'rural', costMultiplier: 0.65, avgInterestRate: 13.0, disasterRiskIndex: 0.65 },
  rural_wb:    { name: 'Rural West Bengal', state: 'West Bengal',      tier: 'rural', costMultiplier: 0.55, avgInterestRate: 14.0, disasterRiskIndex: 0.65 },
};

/** Flat sorted list for pickers */
export const CITY_LIST = Object.entries(CITIES)
  .map(([key, data]) => ({ key, ...data }))
  .sort((a, b) => a.name.localeCompare(b.name));

// ─── Business Types ────────────────────────────────────────────

export interface BusinessTypeData {
  label: string;
  /** Typical margin % for the sector */
  marginPercent: number;
  /** Sector risk adjustment factor (1.0 = neutral) */
  riskFactor: number;
}

export const BUSINESS_TYPES: Record<string, BusinessTypeData> = {
  kirana:        { label: 'Kirana / Grocery',           marginPercent: 0.08, riskFactor: 0.80 },
  dairy:         { label: 'Dairy & Milk Products',      marginPercent: 0.10, riskFactor: 0.85 },
  textile:       { label: 'Textile & Garments',         marginPercent: 0.15, riskFactor: 1.00 },
  agriculture:   { label: 'Agriculture & Farming',      marginPercent: 0.12, riskFactor: 1.30 },
  food_stall:    { label: 'Food Stall / Street Food',   marginPercent: 0.20, riskFactor: 1.10 },
  handicraft:    { label: 'Handicrafts & Artisan',      marginPercent: 0.25, riskFactor: 1.15 },
  hardware:      { label: 'Hardware & Building',        marginPercent: 0.12, riskFactor: 0.90 },
  pharmacy:      { label: 'Medical / Pharmacy',         marginPercent: 0.18, riskFactor: 0.70 },
  electronics:   { label: 'Electronics & Mobile',       marginPercent: 0.10, riskFactor: 0.95 },
  transport:     { label: 'Transport & Logistics',      marginPercent: 0.14, riskFactor: 1.05 },
  beauty:        { label: 'Beauty & Salon',             marginPercent: 0.30, riskFactor: 0.95 },
  education:     { label: 'Tuition / Coaching',         marginPercent: 0.35, riskFactor: 0.75 },
  tailoring:     { label: 'Tailoring / Boutique',       marginPercent: 0.25, riskFactor: 0.85 },
  poultry:       { label: 'Poultry & Fisheries',        marginPercent: 0.15, riskFactor: 1.20 },
  auto_repair:   { label: 'Auto Repair / Service',      marginPercent: 0.20, riskFactor: 0.90 },
  flour_mill:    { label: 'Flour Mill / Oil Mill',      marginPercent: 0.12, riskFactor: 0.95 },
  other:         { label: 'Other',                      marginPercent: 0.15, riskFactor: 1.00 },
};

export const BUSINESS_TYPE_LIST = Object.entries(BUSINESS_TYPES)
  .map(([key, data]) => ({ key, ...data }))
  .sort((a, b) => a.label.localeCompare(b.label));

// ─── Tier defaults ─────────────────────────────────────────────

const TIER_DEFAULTS: Record<CityTier, Omit<CityData, 'name' | 'state'>> = {
  tier1: { tier: 'tier1', costMultiplier: 1.25, avgInterestRate: 10.5, disasterRiskIndex: 0.35 },
  tier2: { tier: 'tier2', costMultiplier: 0.95, avgInterestRate: 11.5, disasterRiskIndex: 0.40 },
  tier3: { tier: 'tier3', costMultiplier: 0.80, avgInterestRate: 12.5, disasterRiskIndex: 0.35 },
  rural: { tier: 'rural', costMultiplier: 0.58, avgInterestRate: 14.0, disasterRiskIndex: 0.55 },
};

// ─── Core Calculation Types ────────────────────────────────────

export interface ProjectInputs {
  marginCapital: number;
  cityKey: string;
  businessTypeKey: string;
}

export interface ProjectResult {
  /** Total project cost = margin / margin% (scaled by location) */
  totalProjectCost: number;
  /** Loan amount = project cost − margin capital */
  loanAmount: number;
  /** Margin % used (from business type) */
  marginPercent: number;
  /** Monthly EMI at location-aware interest rate */
  emi: number;
  /** Annual interest rate used (%) */
  interestRate: number;
  /** Loan tenure in months */
  tenureMonths: number;
  /** City tier */
  tier: CityTier;
  /** Disaster risk index for the location (0–1) */
  disasterRisk: number;
  /** Location cost multiplier used */
  costMultiplier: number;
  /** Business risk factor */
  businessRiskFactor: number;
  /** Composite risk score 0–1 (used for Go/No-Go gauge) */
  riskRatio: number;
  /** City data */
  city: CityData;
  /** Business data */
  business: BusinessTypeData;
}

// ─── Core Calculations ────────────────────────────────────────

const DEFAULT_TENURE_MONTHS = 36;

/**
 * Calculate total project cost from margin capital.
 * Scaled by the city's cost-of-living multiplier.
 */
export function calculateProjectCost(
  marginCapital: number,
  marginPercent: number,
  costMultiplier: number,
): number {
  const baseCost = marginCapital / marginPercent;
  return baseCost * costMultiplier;
}

/**
 * Standard EMI formula: E = P × r × (1+r)^n / ((1+r)^n − 1)
 */
export function calculateEMI(
  loanAmount: number,
  annualRatePercent: number,
  months: number,
): number {
  if (loanAmount <= 0 || months <= 0) return 0;
  const r = annualRatePercent / 12 / 100;
  if (r === 0) return loanAmount / months;
  return (loanAmount * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

/**
 * Compute a composite risk ratio (0–1) from disaster risk, business risk, and EMI burden.
 * - 0.0–0.4  → green   (GO)
 * - 0.4–0.7  → amber   (CAUTION)
 * - 0.7–1.0  → red     (NO-GO)
 */
export function calculateRiskRatio(
  disasterImpact: number,
  disasterRiskIndex: number,
  businessRiskFactor: number,
  emi: number,
  monthlyIncome: number,
): number {
  // EMI affordability component (0–1): higher when EMI eats more income
  const emiRatio = monthlyIncome > 0 ? Math.min(emi / monthlyIncome, 1) : 1;

  // Disaster component: the slider amplifies the location's base risk
  const disasterComponent = disasterRiskIndex * (1 + disasterImpact);

  // Weighted composite
  const raw =
    0.35 * emiRatio +
    0.35 * Math.min(disasterComponent, 1) +
    0.30 * (businessRiskFactor - 0.70) / 0.60;  // normalise 0.70–1.30 → 0–1

  return Math.min(Math.max(raw, 0), 1);
}

/**
 * Estimate monthly income from the margin capital and business type margin.
 * Rough heuristic: if margin capital is 10% of project cost, annual revenue
 * ≈ project cost × margin%, monthly ≈ that / 12.
 */
export function estimateMonthlyIncome(
  marginCapital: number,
  marginPercent: number,
  costMultiplier: number,
): number {
  const projectCost = calculateProjectCost(marginCapital, marginPercent, costMultiplier);
  return (projectCost * marginPercent) / 12;
}

/**
 * Full project analysis — the main entry point for the dashboard.
 */
export function analyseProject(inputs: ProjectInputs): ProjectResult {
  const city = CITIES[inputs.cityKey];
  const business = BUSINESS_TYPES[inputs.businessTypeKey] ?? BUSINESS_TYPES.other;

  if (!city) {
    throw new Error(`Unknown city key: ${inputs.cityKey}`);
  }

  const marginPercent = business.marginPercent;
  const costMultiplier = city.costMultiplier;
  const interestRate = city.avgInterestRate;
  const tenureMonths = DEFAULT_TENURE_MONTHS;

  const totalProjectCost = calculateProjectCost(inputs.marginCapital, marginPercent, costMultiplier);
  const loanAmount = Math.max(totalProjectCost - inputs.marginCapital, 0);
  const emi = calculateEMI(loanAmount, interestRate, tenureMonths);

  const monthlyIncome = estimateMonthlyIncome(inputs.marginCapital, marginPercent, costMultiplier);
  const riskRatio = calculateRiskRatio(0, city.disasterRiskIndex, business.riskFactor, emi, monthlyIncome);

  return {
    totalProjectCost,
    loanAmount,
    marginPercent,
    emi,
    interestRate,
    tenureMonths,
    tier: city.tier,
    disasterRisk: city.disasterRiskIndex,
    costMultiplier,
    businessRiskFactor: business.riskFactor,
    riskRatio,
    city,
    business,
  };
}

/**
 * Recalculate risk with a disaster-impact slider value (0–1).
 * Called live from the dashboard as the user drags the slider.
 */
export function recalculateWithDisaster(
  result: ProjectResult,
  disasterImpact: number,
  marginCapital: number,
): { emi: number; riskRatio: number; adjustedLoan: number } {
  const adjustedLoan = result.loanAmount * (1 + disasterImpact * result.disasterRisk);
  const emi = calculateEMI(adjustedLoan, result.interestRate, result.tenureMonths);
  const monthlyIncome = estimateMonthlyIncome(
    marginCapital,
    result.marginPercent,
    result.costMultiplier,
  );
  const riskRatio = calculateRiskRatio(
    disasterImpact,
    result.disasterRisk,
    result.businessRiskFactor,
    emi,
    monthlyIncome,
  );
  return { emi, riskRatio, adjustedLoan };
}

// ─── Formatting helpers (pure, no Intl dependency) ─────────────

/** Format a number as ₹ with Indian comma grouping (12,34,567) */
export function formatINR(n: number): string {
  const rounded = Math.round(n);
  const s = rounded.toString();
  if (s.length <= 3) return '₹' + s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return '₹' + grouped + ',' + last3;
}

/** Tier label for display */
export function tierLabel(tier: CityTier): string {
  switch (tier) {
    case 'tier1': return 'Tier 1 (Metro)';
    case 'tier2': return 'Tier 2 (City)';
    case 'tier3': return 'Tier 3 (Town)';
    case 'rural': return 'Rural';
  }
}
