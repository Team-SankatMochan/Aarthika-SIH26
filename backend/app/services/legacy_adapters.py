from typing import Dict, Any

def normalize_legacy_business_assumption(latest_assumption) -> Dict[str, Any]:
    """
    Map legacy mobile business assumption data to canonical format without guessing magnitudes.
    """
    inputs = {}
    
    if latest_assumption.monthly_units_sold is not None:
        inputs["monthly_units_sold"] = float(latest_assumption.monthly_units_sold)
    elif latest_assumption.production_volume is not None:
        inputs["monthly_units_sold"] = float(latest_assumption.production_volume)
    
    if latest_assumption.selling_price_per_unit is not None:
        inputs["selling_price_per_unit"] = float(latest_assumption.selling_price_per_unit)
    elif latest_assumption.selling_price is not None:
        inputs["selling_price_per_unit"] = float(latest_assumption.selling_price)
        
    if latest_assumption.variable_cost_per_unit is not None:
        inputs["variable_cost_per_unit"] = float(latest_assumption.variable_cost_per_unit)
    elif latest_assumption.raw_material_cost is not None:
        inputs["variable_cost_per_unit"] = float(latest_assumption.raw_material_cost)
        
    inputs["monthly_fixed_cost"] = float(
        (latest_assumption.monthly_labour_cost if latest_assumption.monthly_labour_cost is not None else (latest_assumption.labour_cost or 0))
        + (latest_assumption.monthly_rent if latest_assumption.monthly_rent is not None else (latest_assumption.rent or 0))
        + (latest_assumption.monthly_transport_cost if latest_assumption.monthly_transport_cost is not None else (latest_assumption.transport_cost or 0))
        + (latest_assumption.monthly_other_fixed_cost if latest_assumption.monthly_other_fixed_cost is not None else (latest_assumption.other_operating_cost or 0))
    )
    
    inputs["monthly_household_nonbusiness_income"] = float(latest_assumption.monthly_household_nonbusiness_income) if latest_assumption.monthly_household_nonbusiness_income is not None else 0
    inputs["monthly_household_essential_expenses"] = float(latest_assumption.monthly_household_essential_expenses) if latest_assumption.monthly_household_essential_expenses is not None else 0
    inputs["existing_monthly_household_debt_payments"] = float(latest_assumption.existing_monthly_household_debt_payments) if latest_assumption.existing_monthly_household_debt_payments is not None else 0
    
    return inputs
