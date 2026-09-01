from datetime import datetime, date
from typing import Optional, Any, Dict
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field, model_validator


class MarketDataBase(BaseModel):
    location_id: str = Field(..., max_length=64)
    business_id: Optional[str] = Field(None, max_length=64)
    data_type: str = Field(..., min_length=2, max_length=100, examples=["COMPETITOR_DENSITY", "DEMAND_GAP", "PRICING_SIGNAL"])
    source: str = Field(..., min_length=2, max_length=150, examples=["Field Survey - Block Coordinator", "District Dairy Union"])
    value: Decimal = Field(..., ge=0, examples=[48.50])
    unit: str = Field(..., min_length=1, max_length=50, examples=["INR/litre", "competitors/sq_km"])
    observation_date: Optional[date] = None
    confidence: Decimal = Field(default=Decimal("1.00"), ge=0, le=1, examples=[0.90])
    is_observed: bool = Field(default=True)
    is_estimated: bool = Field(default=False)
    metadata_json: Optional[Dict[str, Any]] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_observed_or_estimated(self):
        if not self.is_observed and not self.is_estimated:
            raise ValueError("Data point must be marked as either is_observed=True or is_estimated=True")
        return self


class MarketDataCreate(MarketDataBase):
    id: Optional[str] = Field(None, min_length=1, max_length=64)


class MarketDataResponse(MarketDataBase):
    id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
