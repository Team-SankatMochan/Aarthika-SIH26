from datetime import datetime
from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field


class StressTestScenarioBase(BaseModel):
    stress_test_id: Optional[str] = Field(None, max_length=64)
    scenario_type: str = Field(..., min_length=2, max_length=100, examples=["DEMAND_DROP_20", "PRICE_DROP_10", "RAW_MATERIAL_UP_20"])
    parameter_name: str = Field(..., min_length=1, max_length=100, examples=["demand_volume", "selling_price", "raw_material_cost"])
    change_percentage: Optional[Decimal] = Field(None, examples=[-20.00])
    change_absolute: Optional[Decimal] = Field(None, examples=[0.00])
    revenue: Decimal = Field(..., ge=0, examples=[44000.00])
    operating_cost: Decimal = Field(..., ge=0, examples=[32000.00])
    cash_surplus: Decimal = Field(..., examples=[12000.00])
    debt_repayment_burden: Decimal = Field(..., ge=0, examples=[4120.00])
    working_capital_pressure: Decimal = Field(..., ge=0, examples=[18000.00])
    break_even: Decimal = Field(..., ge=0, examples=[62.50])
    resilience_score: Decimal = Field(..., ge=0, le=100, examples=[78.50])
    result_status: str = Field(..., examples=["SURVIVES", "AT_RISK", "INSOLVENT"])


class StressTestScenarioCreate(StressTestScenarioBase):
    id: Optional[str] = Field(None, min_length=1, max_length=64)


class StressTestScenarioResponse(StressTestScenarioBase):
    id: str
    stress_test_id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class StressTestBase(BaseModel):
    business_id: str = Field(..., max_length=64)
    base_assumption_id: Optional[str] = Field(None, max_length=64)
    name: str = Field(..., min_length=2, max_length=150, examples=["Standard Crash Test Session"])
    description: Optional[str] = None
    status: str = Field(default="COMPLETED", examples=["IN_PROGRESS", "COMPLETED", "FAILED"])


class StressTestCreate(StressTestBase):
    id: Optional[str] = Field(None, min_length=1, max_length=64)
    scenarios: Optional[List[StressTestScenarioCreate]] = Field(default_factory=list)


class StressTestRunRequest(BaseModel):
    assumption_id: Optional[str] = None
    monthly_emi: Optional[Decimal] = Field(None, ge=0)
    scenarios_to_run: Optional[List[str]] = Field(
        default_factory=lambda: [
            "DEMAND_DROP_20",
            "PRICE_DROP_10",
            "RAW_MATERIAL_UP_20",
            "LOST_MAJOR_CUSTOMER",
            "TRANSPORT_COST_SPIKE",
            "DELAYED_PAYMENTS",
        ]
    )


class StressTestResponse(StressTestBase):
    id: str
    created_at: datetime
    updated_at: datetime
    scenarios: List[StressTestScenarioResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)
