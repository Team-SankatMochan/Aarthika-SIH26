import json
from pathlib import Path
from decimal import Decimal
import sys

# Adjust path to find the spec file relative to this test
SPEC_DIR = Path(__file__).parent.parent.parent / "finance-spec"
GOLDEN_TESTS_FILE = SPEC_DIR / "golden-tests.json"
POLICY_FILE = SPEC_DIR / "calculation-policy.json"

sys.path.append(str(Path(__file__).parent.parent))

from app.services.finance_calculator import calculate_financial_assessment

def load_tests():
    with open(GOLDEN_TESTS_FILE, "r") as f:
        return json.load(f)

def load_policy():
    with open(POLICY_FILE, "r") as f:
        return json.load(f)

def run():
    tests = load_tests()
    policy = load_policy()
    passed = 0
    failed = 0
    
    for test_case in tests:
        inputs = test_case["inputs"]
        expected = test_case["expected"]
        
        result = calculate_financial_assessment(inputs, policy, allow_stage_overrides=True)
        
        test_passed = True
        for key, expected_value in expected.items():
            if expected_value is None:
                if result.get(key) is not None:
                    print(f"[FAIL] {test_case['name']}: Mismatch for {key}: expected None, got {result.get(key)}")
                    test_passed = False
            elif isinstance(expected_value, (str, list)):
                if result.get(key) != expected_value:
                    print(f"[FAIL] {test_case['name']}: Mismatch for {key}: expected {expected_value}, got {result.get(key)}")
                    test_passed = False
            else:
                if key not in result:
                    print(f"[FAIL] {test_case['name']}: Missing key in result: {key}")
                    test_passed = False
                elif result[key] is None:
                    print(f"[FAIL] {test_case['name']}: Mismatch for {key}: expected {expected_value}, got None")
                    test_passed = False
                else:
                    exp_dec = Decimal(str(expected_value))
                    res_dec = Decimal(str(result[key]))
                    if exp_dec != res_dec:
                        print(f"[FAIL] {test_case['name']}: Mismatch for {key}: expected {exp_dec}, got {res_dec}")
                        test_passed = False
        
        if test_passed:
            print(f"[PASS] {test_case['name']}")
            passed += 1
        else:
            failed += 1
            
    print(f"\nTests passed: {passed}, failed: {failed}")
    if failed > 0:
        sys.exit(1)

if __name__ == "__main__":
    run()
