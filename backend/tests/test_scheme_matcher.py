import json
from pathlib import Path
from datetime import datetime, timezone
from app.services.scheme_matcher import (
    evaluate_scheme_compatibility,
    evaluate_all_schemes
)

def test_golden_scheme_matches():
    """
    Test Python scheme_matcher against the shared golden fixtures.
    Ensures Phase 2 P1 deterministic matching contract is fulfilled.
    """
    repo_root = Path(__file__).parent.parent.parent
    golden_path = repo_root / "scheme-spec" / "golden-scheme-matches.json"
    
    with open(golden_path, "r") as f:
        data = json.load(f)
        
    for case in data["cases"]:
        print(f"Testing case: {case['id']} - {case['description']}")
        
        profile = case["profile"]
        evaluation_date = case["evaluation_date"]
        freshness_policy = case["freshness_policy"]
        
        if "scheme_rule" in case:
            # Single rule evaluation
            rule = case["scheme_rule"]
            if rule is None:
                # no cached rule case
                result = evaluate_all_schemes(profile, [], evaluation_date, freshness_policy)
                assert result["status"] == case["expected"]["status"]
                continue
                
            result = evaluate_scheme_compatibility(profile, rule, evaluation_date, freshness_policy)
            
            expected = case["expected"]
            assert result["status"] == expected["status"]
            assert result["validity"] == expected["validity"]
            
            if "freshness" in expected and expected["freshness"]:
                assert result["freshness"] == expected["freshness"]
                
            assert set(result["passed_rules"]) == set(expected["passed_rules"])
            
            # Verify failed rules
            actual_failed_fields = [f["field"] for f in result["failed_rules"]]
            expected_failed_fields = [f["field"] for f in expected["failed_rules"]]
            assert set(actual_failed_fields) == set(expected_failed_fields)
            
            # Verify missing fields
            assert set(result["missing_fields"]) == set(expected["missing_fields"])
            
            # Verify warnings
            assert set(result["warnings"]) == set(expected["warnings"])
            
        elif "rules" in case:
            # Multi-rule selection evaluation
            rules = case["rules"]
            result = evaluate_all_schemes(profile, rules, evaluation_date, freshness_policy)
            
            if "expected_selected_rule_id" in case:
                # Expecting one compatible scheme with a specific selected rule
                assert len(result["compatible_schemes"]) == 1
                scheme_result = result["compatible_schemes"][0]
                assert scheme_result["best_rule"]["scheme_rule_id"] == case["expected_selected_rule_id"]
                assert scheme_result["best_rule"]["selection_reason"] == case["expected_selection_reason"]
                
            elif "expected_compatible_scheme_ids" in case:
                # Expecting multiple compatible schemes
                expected_ids = case["expected_compatible_scheme_ids"]
                actual_ids = [s["scheme_id"] for s in result["compatible_schemes"]]
                assert set(actual_ids) == set(expected_ids)
