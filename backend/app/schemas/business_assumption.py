from datetime import datetime
from typing import Optional
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field


class BusinessAssumptionBase(BaseModel):
    business_id: str = Field(..., max_length=64)
    # --- Legacy Fields (Deprecated) ---
    expected_customers: int = Field(default=0, ge=0, examples=[25], json_schema_extra={"deprecated": True})
    selling_price: Decimal = Field(default=Decimal("0.00"), ge=0, examples=[55.00], json_schema_extra={"deprecated": True})
    production_volume: Decimal = Field(default=Decimal("0.00"), ge=0, examples=[100.00], json_schema_extra={"deprecated": True})
    raw_material_cost: Decimal = Field(default=Decimal("0.00"), ge=0, examples=[32.00], json_schema_extra={"deprecated": True})
    labour_cost: Decimal = Field(default=Decimal("0.00"), ge=0, examples=[5000.00], json_schema_extra={"deprecated": True})
    rent: Decimal = Field(default=Decimal("0.00"), ge=0, examples=[2000.00], json_schema_extra={"deprecated": True})
    transport_cost: Decimal = Field(default=Decimal("0.00"), ge=0, examples=[1500.00], json_schema_extra={"deprecated": True})
    working_capital: Decimal = Field(default=Decimal("0.00"), ge=0, examples=[15000.00], json_schema_extra={"deprecated": True})
    proposed_loan_amount: Decimal = Field(default=Decimal("0.00"), ge=0, examples=[100000.00], json_schema_extra={"deprecated": True})
    other_operating_cost: Decimal = Field(default=Decimal("0.00"), ge=0, examples=[1000.00], json_schema_extra={"deprecated": True})
    
    # --- New Canonical Fields ---
    monthly_units_sold: Optional[Decimal] = Field(None, ge=0, examples=[100.5])
    unit_of_measure: Optional[str] = Field(None, examples=["kg", "litres"])
    selling_price_per_unit: Optional[Decimal] = Field(None, ge=0, examples=[55.00])
    variable_cost_per_unit: Optional[Decimal] = Field(None, ge=0, examples=[32.00])
    monthly_labour_cost: Optional[Decimal] = Field(None, ge=0, examples=[5000.00])
    monthly_rent: Optional[Decimal] = Field(None, ge=0, examples=[2000.00])
    monthly_transport_cost: Optional[Decimal] = Field(None, ge=0, examples=[1500.00])
    monthly_other_fixed_cost: Optional[Decimal] = Field(None, ge=0, examples=[1000.00])
    requested_loan_amount: Optional[Decimal] = Field(None, ge=0, examples=[100000.00])
    working_capital_required: Optional[Decimal] = Field(None, ge=0, examples=[15000.00])

    # --- Household Finance Fields ---
    monthly_household_nonbusiness_income: Optional[Decimal] = Field(None, ge=0, examples=[5000.00])
    monthly_household_essential_expenses: Optional[Decimal] = Field(None, ge=0, examples=[2000.00])
    existing_monthly_household_debt_payments: Optional[Decimal] = Field(None, ge=0, examples=[500.00])
    
    assumption_source: str = Field(default="ENTREPRENEUR", examples=["ENTREPRENEUR", "AI_BENCHMARK", "PILOT_DERIVED"])
    confidence: Decimal = Field(default=Decimal("0.70"), ge=0, le=1, examples=[0.75])


class BusinessAssumptionCreate(BusinessAssumptionBase):
    id: Optional[str] = Field(None, min_length=1, max_length=64)


class BusinessAssumptionResponse(BusinessAssumptionBase):
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
