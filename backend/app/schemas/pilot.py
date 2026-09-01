from datetime import datetime, date
from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field


class PilotResultBase(BaseModel):
    pilot_id: Optional[str] = Field(None, max_length=64)
    target_customers: int = Field(default=0, ge=0, examples=[50])
    actual_customers: int = Field(default=0, ge=0, examples=[42])
    repeat_purchase_rate: Decimal = Field(default=Decimal("0.00"), ge=0, le=100, examples=[65.00])
    price_acceptance: Decimal = Field(default=Decimal("0.00"), ge=0, le=100, examples=[88.00])
    delivery_cost: Decimal = Field(default=Decimal("0.00"), ge=0, examples=[450.00])
    conversion_rate: Decimal = Field(default=Decimal("0.00"), ge=0, le=100, examples=[84.00])
    actual_revenue: Decimal = Field(default=Decimal("0.00"), ge=0, examples=[18500.00])
    actual_cost: Decimal = Field(default=Decimal("0.00"), ge=0, examples=[12200.00])
    customer_feedback: Optional[str] = Field(None, examples=["Good freshness, demand in morning hours is high"])
    observations: Optional[str] = Field(None, examples=["Morning delivery completed within 1.5 hours"])


class PilotResultCreate(PilotResultBase):
    id: Optional[str] = Field(None, min_length=1, max_length=64)


class PilotResultResponse(PilotResultBase):
    id: str
    pilot_id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PilotBase(BaseModel):
    business_id: str = Field(..., max_length=64)
    objective: str = Field(..., min_length=5, examples=["Validate morning milk demand and customer price acceptance at Rs 55/L"])
    hypothesis: str = Field(..., min_length=5, examples=["At least 30 local households will purchase fresh milk daily at Rs 55/L"])
    duration_days: int = Field(default=14, gt=0, examples=[14])
    status: str = Field(default="PLANNED", examples=["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"])
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class PilotCreate(PilotBase):
    id: Optional[str] = Field(None, min_length=1, max_length=64)


class PilotResponse(PilotBase):
    id: str
    created_at: datetime
    updated_at: datetime
    results: List[PilotResultResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)
