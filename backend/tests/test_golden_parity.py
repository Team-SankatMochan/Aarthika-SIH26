import json
import os
import pytest
from decimal import Decimal, ROUND_HALF_UP, getcontext
from pathlib import Path

# Adjust path to find the spec file relative to this test
SPEC_DIR = Path(__file__).parent.parent.parent / "finance-spec"
GOLDEN_TESTS_FILE = SPEC_DIR / "golden-tests.json"
POLICY_FILE = SPEC_DIR / "calculation-policy.json"

# We will import our new pure calculator here
from app.services.finance_calculator import calculate_financial_assessment

def load_tests():
    with open(GOLDEN_TESTS_FILE, "r") as f:
        return json.load(f)

def load_policy():
    with open(POLICY_FILE, "r") as f:
        return json.load(f)

GOLDEN_TESTS = load_tests()
POLICY = load_policy()

def calculate_golden_test_wrapper(inputs, policy):
    # Scenario logic moved to test harness
    scenario = inputs.get("scenario")
    
    units = inputs.get("monthly_units_sold")
    var_cost = inputs.get("variable_cost_per_unit")
    fixed_cost = inputs.get("monthly_fixed_cost", 0)
    transport = inputs.get("monthly_transport_cost", 0)
    labour = inputs.get("monthly_labour_cost", 0)
    rent = inputs.get("monthly_rent", 0)
    other_fixed = inputs.get("monthly_other_fixed_cost", 0)
    
    sim_outputs = {}
    
    if scenario == "DEMAND_DROP_20" and units is not None:
        inputs["monthly_units_sold"] = int(units * 0.8)
        sim_outputs["simulated_monthly_units_sold"] = inputs["monthly_units_sold"]
        
    elif scenario == "RAW_MATERIAL_UP_20" and var_cost is not None:
        inputs["variable_cost_per_unit"] = float(Decimal(str(var_cost)) * Decimal("1.20"))
        sim_outputs["simulated_variable_cost_per_unit"] = inputs["variable_cost_per_unit"]
        if units is not None:
            sim_outputs["simulated_monthly_units_sold"] = units
            
    elif scenario == "TRANSPORT_COST_SPIKE_50":
        new_transport = float(Decimal(str(transport)) * Decimal("1.50"))
        inputs["monthly_fixed_cost"] = labour + rent + new_transport + other_fixed
        sim_outputs["simulated_monthly_transport_cost"] = new_transport
        if units is not None:
            sim_outputs["simulated_monthly_units_sold"] = units

    res = calculate_financial_assessment(inputs, policy)
    
    if scenario:
        for k in ["monthly_revenue", "monthly_variable_cost", "monthly_fixed_cost", "monthly_operating_surplus"]:
            if k in res:
                res[f"simulated_{k}"] = res[k]
                
    res.update(sim_outputs)
    return res

@pytest.mark.parametrize("test_case", GOLDEN_TESTS, ids=lambda tc: tc["name"])
def test_golden_parity(test_case):
    inputs = test_case["inputs"]
    expected = test_case["expected"]
    
    # Run the deterministic python engine
    result = calculate_golden_test_wrapper(inputs, POLICY)
    
    # Assert all expected fields match the result exactly
    for key, expected_value in expected.items():
        if expected_value is None:
            assert result.get(key) is None, f"Expected None for {key}, got {result.get(key)}"
        elif isinstance(expected_value, str):
            assert result.get(key) == expected_value, f"Mismatch for {key}: expected {expected_value}, got {result.get(key)}"
        elif isinstance(expected_value, list):
            assert result.get(key) == expected_value, f"Mismatch for {key}: expected {expected_value}, got {result.get(key)}"
        else:
            # Numeric comparison
            assert key in result, f"Missing key in result: {key}"
            res_val = result[key]
            if res_val is None:
                assert expected_value is None, f"Mismatch for {key}: expected {expected_value}, got None"
            else:
                expected_dec = Decimal(str(expected_value))
                res_dec = Decimal(str(res_val))
                assert expected_dec == res_dec, f"Mismatch for {key}: expected {expected_dec}, got {res_dec}"

