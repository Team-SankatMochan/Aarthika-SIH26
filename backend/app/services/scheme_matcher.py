"""
Deterministic scheme compatibility matcher — Phase 2 P1.

Pure functions. No AI. No DB. No network. No EMI/DSCR calculations.
Evaluates scheme-rule compatibility based on profile data.
"""
import json
from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Optional, Tuple

TWO_PLACES = Decimal("0.01")

# ── Validity ─────────────────────────────────────────────────────────────────

def evaluate_rule_validity(
    rule: Dict[str, Any],
    evaluation_date: date,
) -> str:
    """Return ACTIVE | NOT_YET_EFFECTIVE | EXPIRED | INACTIVE."""
    if not rule.get("active", True):
        return "INACTIVE"

    eff_from = rule.get("effective_from")
    eff_to = rule.get("effective_to")

    if eff_from:
        if isinstance(eff_from, str):
            eff_from = date.fromisoformat(eff_from)
        if eff_from > evaluation_date:
            return "NOT_YET_EFFECTIVE"

    if eff_to:
        if isinstance(eff_to, str):
            eff_to = date.fromisoformat(eff_to)
        if eff_to < evaluation_date:
            return "EXPIRED"

    return "ACTIVE"


# ── Freshness ────────────────────────────────────────────────────────────────

def evaluate_rule_freshness(
    rule: Dict[str, Any],
    evaluation_dt: datetime,
    freshness_policy: Dict[str, Any],
) -> str:
    """Return VERIFIED_FRESH | VERIFIED_STALE | UNKNOWN."""
    last_verified = rule.get("last_verified_at")
    if last_verified is None:
        return "UNKNOWN"

    if isinstance(last_verified, str):
        last_verified = datetime.fromisoformat(last_verified.replace("Z", "+00:00"))

    if not isinstance(last_verified, datetime):
        return "UNKNOWN"

    stale_hours = freshness_policy.get("stale_after_hours", 720)
    age_hours = (evaluation_dt - last_verified).total_seconds() / 3600.0
    return "VERIFIED_FRESH" if age_hours <= stale_hours else "VERIFIED_STALE"


# ── Specificity ──────────────────────────────────────────────────────────────

OPTIONAL_CONSTRAINT_FIELDS = ("location_type", "allowed_business_categories")

def rule_specificity(rule: Dict[str, Any]) -> int:
    """Count non-null optional constraint fields (not metadata)."""
    return sum(1 for f in OPTIONAL_CONSTRAINT_FIELDS if rule.get(f) is not None)


# ── Single-rule evaluation ───────────────────────────────────────────────────

def evaluate_scheme_compatibility(
    profile: Dict[str, Any],
    scheme_rule: Dict[str, Any],
    evaluation_date: str | date,
    freshness_policy: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Evaluate a single scheme rule against a profile.

    Returns {status, validity, freshness, passed_rules, failed_rules,
             missing_fields, warnings, scheme_id, scheme_rule_id, rule_version,
             evaluated_at}.
    """
    if isinstance(evaluation_date, str):
        evaluation_date = date.fromisoformat(evaluation_date)

    now_utc = datetime.now(timezone.utc)

    validity = evaluate_rule_validity(scheme_rule, evaluation_date)
    freshness = evaluate_rule_freshness(scheme_rule, now_utc, freshness_policy)

    passed: List[str] = []
    failed: List[Dict[str, Any]] = []
    missing: List[str] = []
    warnings: List[str] = []

    # ── Validity constraints (short-circuit) ──
    if validity == "INACTIVE":
        failed.append({"field": "active", "reason": "RULE_INACTIVE"})
    elif validity == "NOT_YET_EFFECTIVE":
        failed.append({"field": "effective_from", "reason": "NOT_YET_EFFECTIVE"})
    elif validity == "EXPIRED":
        failed.append({"field": "effective_to", "reason": "EXPIRED"})
    else:
        passed.append("active_status")
        passed.append("effective_dates")

        # ── Project cost ──
        project_cost_raw = profile.get("project_cost")
        if project_cost_raw is None:
            missing.append("project_cost")
        else:
            pc = Decimal(str(project_cost_raw)).quantize(TWO_PLACES, ROUND_HALF_UP)
            min_pc = Decimal(str(scheme_rule["min_project_cost"])).quantize(TWO_PLACES, ROUND_HALF_UP)
            max_pc = Decimal(str(scheme_rule["max_project_cost"])).quantize(TWO_PLACES, ROUND_HALF_UP)

            if pc < min_pc:
                failed.append({
                    "field": "project_cost", "reason": "BELOW_MINIMUM",
                    "actual": float(pc), "allowed_min": float(min_pc),
                })
            elif pc > max_pc:
                failed.append({
                    "field": "project_cost", "reason": "ABOVE_MAXIMUM",
                    "actual": float(pc), "allowed_max": float(max_pc),
                })
            else:
                passed.append("project_cost_range")

        # ── Requested loan amount ──
        req_loan_raw = profile.get("requested_loan_amount")
        if req_loan_raw is None:
            missing.append("requested_loan_amount")
        else:
            rl = Decimal(str(req_loan_raw)).quantize(TWO_PLACES, ROUND_HALF_UP)
            max_loan = Decimal(str(scheme_rule["max_loan_amount"])).quantize(TWO_PLACES, ROUND_HALF_UP)
            if rl > max_loan:
                failed.append({
                    "field": "requested_loan_amount", "reason": "ABOVE_MAXIMUM",
                    "actual": float(rl), "allowed_max": float(max_loan),
                })
            else:
                passed.append("loan_amount")

        # ── Location type (optional constraint) ──
        rule_loc = scheme_rule.get("location_type")
        if rule_loc is not None:
            profile_loc = profile.get("location_type")
            if profile_loc is None:
                missing.append("location_type")
            elif profile_loc.upper() != rule_loc.upper():
                failed.append({
                    "field": "location_type", "reason": "LOCATION_MISMATCH",
                    "actual": profile_loc, "required": rule_loc,
                })
            else:
                passed.append("location_type")

        # ── Business category (optional constraint) ──
        rule_cats_raw = scheme_rule.get("allowed_business_categories")
        if rule_cats_raw is not None:
            rule_cats = rule_cats_raw if isinstance(rule_cats_raw, list) else json.loads(rule_cats_raw)
            rule_cats_upper = [c.upper() for c in rule_cats]
            profile_cat = profile.get("business_category")
            if profile_cat is None:
                missing.append("business_category")
            elif profile_cat.upper() not in rule_cats_upper:
                failed.append({
                    "field": "business_category", "reason": "CATEGORY_NOT_ALLOWED",
                    "actual": profile_cat, "allowed": rule_cats,
                })
            else:
                passed.append("business_category")

    # ── Freshness warnings ──
    if freshness == "VERIFIED_STALE":
        warnings.append("USING_STALE_SCHEME_DATA")
    elif freshness == "UNKNOWN":
        warnings.append("UNKNOWN_FRESHNESS")

    # ── Final status (precedence: FAIL > MISSING > PASS) ──
    if failed:
        status = "NOT_COMPATIBLE"
    elif missing:
        status = "INSUFFICIENT_DATA"
    else:
        status = "COMPATIBLE"

    return {
        "status": status,
        "scheme_id": scheme_rule.get("scheme_id"),
        "scheme_rule_id": scheme_rule.get("id"),
        "rule_version": scheme_rule.get("rule_version"),
        "validity": validity,
        "freshness": freshness,
        "passed_rules": passed,
        "failed_rules": failed,
        "missing_fields": missing,
        "warnings": warnings,
        "evaluated_at": now_utc.isoformat(),
    }


# ── Multi-rule selection ─────────────────────────────────────────────────────

def _rule_sort_key(rule: Dict[str, Any]) -> Tuple:
    """Sort key for deterministic rule selection (best first)."""
    spec = rule_specificity(rule)
    eff_from = rule.get("effective_from")
    if eff_from:
        if isinstance(eff_from, str):
            eff_from = date.fromisoformat(eff_from).toordinal()
        elif isinstance(eff_from, date):
            eff_from = eff_from.toordinal()
        else:
            eff_from = 0
    else:
        eff_from = 0

    version = rule.get("rule_version", 0)
    rule_id = rule.get("id", "")

    return (-spec, -eff_from, -version, rule_id)


def select_best_rule(
    compatible_results: List[Dict[str, Any]],
    rules_by_id: Dict[str, Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    """Select one representative rule from a list of COMPATIBLE evaluation results."""
    if not compatible_results:
        return None

    if len(compatible_results) == 1:
        result = compatible_results[0]
        result["selection_reason"] = "ONLY_COMPATIBLE_RULE"
        result["specificity"] = rule_specificity(rules_by_id[result["scheme_rule_id"]])
        result["competing_rules_count"] = 1
        return result

    # Sort using the deterministic key
    sorted_results = sorted(
        compatible_results,
        key=lambda r: _rule_sort_key(rules_by_id[r["scheme_rule_id"]]),
    )

    winner = sorted_results[0]
    winner_rule = rules_by_id[winner["scheme_rule_id"]]
    runner_up = sorted_results[1]
    runner_up_rule = rules_by_id[runner_up["scheme_rule_id"]]

    # Determine selection reason
    w_spec = rule_specificity(winner_rule)
    r_spec = rule_specificity(runner_up_rule)
    if w_spec > r_spec:
        reason = "HIGHEST_SPECIFICITY"
    else:
        w_eff = winner_rule.get("effective_from")
        r_eff = runner_up_rule.get("effective_from")
        w_eff_ord = date.fromisoformat(w_eff).toordinal() if isinstance(w_eff, str) and w_eff else 0
        r_eff_ord = date.fromisoformat(r_eff).toordinal() if isinstance(r_eff, str) and r_eff else 0
        if w_eff_ord > r_eff_ord:
            reason = "NEWEST_EFFECTIVE_FROM"
        elif winner_rule.get("rule_version", 0) > runner_up_rule.get("rule_version", 0):
            reason = "HIGHEST_RULE_VERSION"
        else:
            reason = "UUID_TIE_BREAK"

    winner["selection_reason"] = reason
    winner["specificity"] = w_spec
    winner["competing_rules_count"] = len(compatible_results)
    return winner


# ── Multi-scheme evaluation ──────────────────────────────────────────────────

def evaluate_all_schemes(
    profile: Dict[str, Any],
    rules: List[Dict[str, Any]],
    evaluation_date: str | date,
    freshness_policy: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Evaluate profile against all scheme rules, group by scheme.
    Returns {compatible_schemes, incompatible_schemes, insufficient_data_schemes}.
    Does NOT rank schemes against each other.
    """
    if not rules:
        return {
            "compatible_schemes": [],
            "incompatible_schemes": [],
            "insufficient_data_schemes": [],
            "status": "INSUFFICIENT_SCHEME_DATA",
        }

    # Evaluate each rule
    results_by_scheme: Dict[str, List[Dict[str, Any]]] = {}
    rules_by_id: Dict[str, Dict[str, Any]] = {}

    for rule in rules:
        rules_by_id[rule["id"]] = rule
        result = evaluate_scheme_compatibility(profile, rule, evaluation_date, freshness_policy)
        sid = rule.get("scheme_id", "")
        if sid not in results_by_scheme:
            results_by_scheme[sid] = []
        results_by_scheme[sid].append(result)

    compatible_schemes = []
    incompatible_schemes = []
    insufficient_data_schemes = []

    for scheme_id, results in results_by_scheme.items():
        compatible = [r for r in results if r["status"] == "COMPATIBLE"]
        insufficient = [r for r in results if r["status"] == "INSUFFICIENT_DATA"]

        if compatible:
            best = select_best_rule(compatible, rules_by_id)
            compatible_schemes.append({
                "scheme_id": scheme_id,
                "best_rule": best,
                "all_compatible_rules_count": len(compatible),
            })
        elif insufficient:
            insufficient_data_schemes.append({
                "scheme_id": scheme_id,
                "best_result": insufficient[0],
            })
        else:
            incompatible_schemes.append({
                "scheme_id": scheme_id,
                "best_result": results[0],
            })

    return {
        "compatible_schemes": compatible_schemes,
        "incompatible_schemes": incompatible_schemes,
        "insufficient_data_schemes": insufficient_data_schemes,
    }
