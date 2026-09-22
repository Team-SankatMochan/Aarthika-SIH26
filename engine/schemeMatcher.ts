/**
 * Deterministic scheme compatibility matcher — Phase 2 P1.
 *
 * Pure functions. No AI. No network. No EMI/DSCR calculations.
 * Evaluates scheme-rule compatibility based on profile data.
 * Must produce identical results to backend/app/services/scheme_matcher.py.
 */

import { Decimal } from 'decimal.js';

const TWO_PLACES = 2;

// ── Types ───────────────────────────────────────────────────────────────────

export interface MatchProfile {
  project_cost: number | null;
  requested_loan_amount: number | null;
  location_type: string | null;
  business_category: string | null;
}

export interface SchemeRuleInput {
  id: string;
  scheme_id: string;
  rule_version: number;
  min_project_cost: number;
  max_project_cost: number;
  max_loan_amount: number;
  active: boolean;
  effective_from: string | null; // ISO date YYYY-MM-DD
  effective_to: string | null;
  location_type: string | null;
  allowed_business_categories: string[] | string | null; // JSON array or parsed
  last_verified_at: string | null; // ISO datetime
}

export interface FailedRule {
  field: string;
  reason: string;
  actual?: number | string;
  allowed_min?: number;
  allowed_max?: number;
  required?: string;
  allowed?: string[];
}

export interface FreshnessPolicy {
  stale_after_hours: number;
}

export interface MatchResult {
  status: 'COMPATIBLE' | 'NOT_COMPATIBLE' | 'INSUFFICIENT_DATA';
  scheme_id: string;
  scheme_rule_id: string;
  rule_version: number;
  validity: string;
  freshness: string;
  passed_rules: string[];
  failed_rules: FailedRule[];
  missing_fields: string[];
  warnings: string[];
  evaluated_at: string;
  selection_reason?: string;
  specificity?: number;
  competing_rules_count?: number;
}

// ── Validity ────────────────────────────────────────────────────────────────

export function evaluateRuleValidity(
  rule: SchemeRuleInput,
  evaluationDate: string,
): string {
  if (!rule.active) return 'INACTIVE';

  if (rule.effective_from) {
    if (rule.effective_from > evaluationDate) return 'NOT_YET_EFFECTIVE';
  }
  if (rule.effective_to) {
    if (rule.effective_to < evaluationDate) return 'EXPIRED';
  }

  return 'ACTIVE';
}

// ── Freshness ───────────────────────────────────────────────────────────────

export function evaluateRuleFreshness(
  rule: SchemeRuleInput,
  evaluationDt: Date,
  policy: FreshnessPolicy,
): string {
  if (!rule.last_verified_at) return 'UNKNOWN';

  const lastVerified = new Date(rule.last_verified_at);
  if (isNaN(lastVerified.getTime())) return 'UNKNOWN';

  const ageHours = (evaluationDt.getTime() - lastVerified.getTime()) / (1000 * 3600);
  return ageHours <= policy.stale_after_hours ? 'VERIFIED_FRESH' : 'VERIFIED_STALE';
}

// ── Specificity ─────────────────────────────────────────────────────────────

const OPTIONAL_CONSTRAINT_FIELDS = ['location_type', 'allowed_business_categories'] as const;

export function ruleSpecificity(rule: SchemeRuleInput): number {
  let count = 0;
  if (rule.location_type != null) count++;
  if (rule.allowed_business_categories != null) count++;
  return count;
}

// ── Single-rule evaluation ──────────────────────────────────────────────────

export function evaluateSchemeCompatibility(
  profile: MatchProfile,
  schemeRule: SchemeRuleInput,
  evaluationDate: string, // YYYY-MM-DD
  freshnessPolicy: FreshnessPolicy,
): MatchResult {
  const nowUtc = new Date();
  const validity = evaluateRuleValidity(schemeRule, evaluationDate);
  const freshness = evaluateRuleFreshness(schemeRule, nowUtc, freshnessPolicy);

  const passed: string[] = [];
  const failed: FailedRule[] = [];
  const missing: string[] = [];
  const warnings: string[] = [];

  // ── Validity constraints ──
  if (validity === 'INACTIVE') {
    failed.push({ field: 'active', reason: 'RULE_INACTIVE' });
  } else if (validity === 'NOT_YET_EFFECTIVE') {
    failed.push({ field: 'effective_from', reason: 'NOT_YET_EFFECTIVE' });
  } else if (validity === 'EXPIRED') {
    failed.push({ field: 'effective_to', reason: 'EXPIRED' });
  } else {
    passed.push('active_status');
    passed.push('effective_dates');

    // ── Project cost ──
    if (profile.project_cost == null) {
      missing.push('project_cost');
    } else {
      const pc = new Decimal(profile.project_cost).toDecimalPlaces(TWO_PLACES, Decimal.ROUND_HALF_UP);
      const minPc = new Decimal(schemeRule.min_project_cost).toDecimalPlaces(TWO_PLACES, Decimal.ROUND_HALF_UP);
      const maxPc = new Decimal(schemeRule.max_project_cost).toDecimalPlaces(TWO_PLACES, Decimal.ROUND_HALF_UP);

      if (pc.lt(minPc)) {
        failed.push({
          field: 'project_cost', reason: 'BELOW_MINIMUM',
          actual: pc.toNumber(), allowed_min: minPc.toNumber(),
        });
      } else if (pc.gt(maxPc)) {
        failed.push({
          field: 'project_cost', reason: 'ABOVE_MAXIMUM',
          actual: pc.toNumber(), allowed_max: maxPc.toNumber(),
        });
      } else {
        passed.push('project_cost_range');
      }
    }

    // ── Requested loan amount ──
    if (profile.requested_loan_amount == null) {
      missing.push('requested_loan_amount');
    } else {
      const rl = new Decimal(profile.requested_loan_amount).toDecimalPlaces(TWO_PLACES, Decimal.ROUND_HALF_UP);
      const maxLoan = new Decimal(schemeRule.max_loan_amount).toDecimalPlaces(TWO_PLACES, Decimal.ROUND_HALF_UP);
      if (rl.gt(maxLoan)) {
        failed.push({
          field: 'requested_loan_amount', reason: 'ABOVE_MAXIMUM',
          actual: rl.toNumber(), allowed_max: maxLoan.toNumber(),
        });
      } else {
        passed.push('loan_amount');
      }
    }

    // ── Location type (optional constraint) ──
    if (schemeRule.location_type != null) {
      if (profile.location_type == null) {
        missing.push('location_type');
      } else if (profile.location_type.toUpperCase() !== schemeRule.location_type.toUpperCase()) {
        failed.push({
          field: 'location_type', reason: 'LOCATION_MISMATCH',
          actual: profile.location_type, required: schemeRule.location_type,
        });
      } else {
        passed.push('location_type');
      }
    }

    // ── Business category (optional constraint) ──
    const ruleCatsRaw = schemeRule.allowed_business_categories;
    if (ruleCatsRaw != null) {
      const ruleCats: string[] = typeof ruleCatsRaw === 'string'
        ? JSON.parse(ruleCatsRaw)
        : ruleCatsRaw;
      const ruleCatsUpper = ruleCats.map(c => c.toUpperCase());

      if (profile.business_category == null) {
        missing.push('business_category');
      } else if (!ruleCatsUpper.includes(profile.business_category.toUpperCase())) {
        failed.push({
          field: 'business_category', reason: 'CATEGORY_NOT_ALLOWED',
          actual: profile.business_category, allowed: ruleCats,
        });
      } else {
        passed.push('business_category');
      }
    }
  }

  // ── Freshness warnings ──
  if (freshness === 'VERIFIED_STALE') warnings.push('USING_STALE_SCHEME_DATA');
  else if (freshness === 'UNKNOWN') warnings.push('UNKNOWN_FRESHNESS');

  // ── Final status (precedence: FAIL > MISSING > PASS) ──
  let status: 'COMPATIBLE' | 'NOT_COMPATIBLE' | 'INSUFFICIENT_DATA';
  if (failed.length > 0) {
    status = 'NOT_COMPATIBLE';
  } else if (missing.length > 0) {
    status = 'INSUFFICIENT_DATA';
  } else {
    status = 'COMPATIBLE';
  }

  return {
    status,
    scheme_id: schemeRule.scheme_id,
    scheme_rule_id: schemeRule.id,
    rule_version: schemeRule.rule_version,
    validity,
    freshness,
    passed_rules: passed,
    failed_rules: failed,
    missing_fields: missing,
    warnings,
    evaluated_at: nowUtc.toISOString(),
  };
}

// ── Multi-rule selection ────────────────────────────────────────────────────

function effectiveFromOrdinal(rule: SchemeRuleInput): number {
  if (!rule.effective_from) return 0;
  return new Date(rule.effective_from + 'T00:00:00Z').getTime();
}

function ruleSortKey(rule: SchemeRuleInput): [number, number, number, string] {
  return [
    -ruleSpecificity(rule),
    -effectiveFromOrdinal(rule),
    -(rule.rule_version || 0),
    rule.id,
  ];
}

function compareKeys(a: [number, number, number, string], b: [number, number, number, string]): number {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return (a[i] as number) - (b[i] as number);
  }
  return a[3] < b[3] ? -1 : a[3] > b[3] ? 1 : 0;
}

export function selectBestRule(
  compatibleResults: MatchResult[],
  rulesById: Record<string, SchemeRuleInput>,
): MatchResult | null {
  if (compatibleResults.length === 0) return null;

  if (compatibleResults.length === 1) {
    const result = { ...compatibleResults[0] };
    result.selection_reason = 'ONLY_COMPATIBLE_RULE';
    result.specificity = ruleSpecificity(rulesById[result.scheme_rule_id]);
    result.competing_rules_count = 1;
    return result;
  }

  const sorted = [...compatibleResults].sort((a, b) => {
    const ka = ruleSortKey(rulesById[a.scheme_rule_id]);
    const kb = ruleSortKey(rulesById[b.scheme_rule_id]);
    return compareKeys(ka, kb);
  });

  const winner = { ...sorted[0] };
  const winnerRule = rulesById[winner.scheme_rule_id];
  const runnerUpRule = rulesById[sorted[1].scheme_rule_id];

  const wSpec = ruleSpecificity(winnerRule);
  const rSpec = ruleSpecificity(runnerUpRule);

  let reason: string;
  if (wSpec > rSpec) {
    reason = 'HIGHEST_SPECIFICITY';
  } else {
    const wEff = effectiveFromOrdinal(winnerRule);
    const rEff = effectiveFromOrdinal(runnerUpRule);
    if (wEff > rEff) {
      reason = 'NEWEST_EFFECTIVE_FROM';
    } else if ((winnerRule.rule_version || 0) > (runnerUpRule.rule_version || 0)) {
      reason = 'HIGHEST_RULE_VERSION';
    } else {
      reason = 'UUID_TIE_BREAK';
    }
  }

  winner.selection_reason = reason;
  winner.specificity = wSpec;
  winner.competing_rules_count = compatibleResults.length;
  return winner;
}

// ── Multi-scheme evaluation ─────────────────────────────────────────────────

export interface SchemeGroupResult {
  compatible_schemes: Array<{
    scheme_id: string;
    best_rule: MatchResult | null;
    all_compatible_rules_count: number;
  }>;
  incompatible_schemes: Array<{
    scheme_id: string;
    best_result: MatchResult;
  }>;
  insufficient_data_schemes: Array<{
    scheme_id: string;
    best_result: MatchResult;
  }>;
  status?: string;
}

export function evaluateAllSchemes(
  profile: MatchProfile,
  rules: SchemeRuleInput[],
  evaluationDate: string,
  freshnessPolicy: FreshnessPolicy,
): SchemeGroupResult {
  if (!rules || rules.length === 0) {
    return {
      compatible_schemes: [],
      incompatible_schemes: [],
      insufficient_data_schemes: [],
      status: 'INSUFFICIENT_SCHEME_DATA',
    };
  }

  const resultsByScheme: Record<string, MatchResult[]> = {};
  const rulesById: Record<string, SchemeRuleInput> = {};

  for (const rule of rules) {
    rulesById[rule.id] = rule;
    const result = evaluateSchemeCompatibility(profile, rule, evaluationDate, freshnessPolicy);
    const sid = rule.scheme_id;
    if (!resultsByScheme[sid]) resultsByScheme[sid] = [];
    resultsByScheme[sid].push(result);
  }

  const compatible_schemes: SchemeGroupResult['compatible_schemes'] = [];
  const incompatible_schemes: SchemeGroupResult['incompatible_schemes'] = [];
  const insufficient_data_schemes: SchemeGroupResult['insufficient_data_schemes'] = [];

  for (const [schemeId, results] of Object.entries(resultsByScheme)) {
    const compatible = results.filter(r => r.status === 'COMPATIBLE');
    const insufficient = results.filter(r => r.status === 'INSUFFICIENT_DATA');

    if (compatible.length > 0) {
      const best = selectBestRule(compatible, rulesById);
      compatible_schemes.push({
        scheme_id: schemeId,
        best_rule: best,
        all_compatible_rules_count: compatible.length,
      });
    } else if (insufficient.length > 0) {
      insufficient_data_schemes.push({
        scheme_id: schemeId,
        best_result: insufficient[0],
      });
    } else {
      incompatible_schemes.push({
        scheme_id: schemeId,
        best_result: results[0],
      });
    }
  }

  return { compatible_schemes, incompatible_schemes, insufficient_data_schemes };
}
