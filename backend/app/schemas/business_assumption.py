from datetime import datetime
from typing import Optional
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field


class BusinessAssumptionBase(BaseModel):
    business_id: str = Field(..., max_length=64)
    expected_customers: int = Field(..., ge=0, examples=[25])
    selling_price: Decimal = Field(..., ge=0, examples=[55.00])
    production_volume: Decimal = Field(..., ge=0, examples=[100.00])
    raw_material_cost: Decimal = Field(..., ge=0, examples=[32.00])
    labour_cost: Decimal = Field(default=Decimal("0.00"), ge=0, examples=[5000.00])
    rent: Decimal = Field(default=Decimal("0.00"), ge=0, examples=[2000.00])
    transport_cost: Decimal = Field(default=Decimal("0.00"), ge=0, examples=[1500.00])
    working_capital: Decimal = Field(default=Decimal("0.00"), ge=0, examples=[15000.00])
    proposed_loan_amount: Decimal = Field(default=Decimal("0.00"), ge=0, examples=[100000.00])
    other_operating_cost: Decimal = Field(default=Decimal("0.00"), ge=0, examples=[1000.00])
    assumption_source: str = Field(default="ENTREPRENEUR", examples=["ENTREPRENEUR", "AI_BENCHMARK", "PILOT_DERIVED"])
    confidence: Decimal = Field(default=Decimal("0.70"), ge=0, le=1, examples=[0.75])


class BusinessAssumptionCreate(BusinessAssumptionBase):
    id: Optional[str] = Field(None, min_length=1, max_length=64)


class BusinessAssumptionResponse(BusinessAssumptionBase):
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
