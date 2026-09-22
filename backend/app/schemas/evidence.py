from datetime import datetime, date
from typing import Optional, List, Any
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field, model_validator, field_serializer


class EvidenceBase(BaseModel):
    business_id: Optional[str] = Field(None, max_length=64)
    evidence_type: str = Field(...)
    source_type: Optional[str] = Field(default="USER_ENTERED")
    source: Optional[str] = Field(None, max_length=150)
    source_name: Optional[str] = None
    source_url: Optional[str] = None
    provider_id: Optional[str] = None
    provider_record_id: Optional[str] = None
    description: Optional[str] = None
    value: Optional[Decimal] = None
    numeric_value: Optional[Decimal] = None
    text_value: Optional[str] = None
    boolean_value: Optional[bool] = None
    observation_date: Optional[date] = None
    state: Optional[str] = None
    district: Optional[str] = None
    commodity: Optional[str] = None
    market_id: Optional[str] = None
    market_name: Optional[str] = None
    price_type: Optional[str] = None
    currency: Optional[str] = "INR"
    quantity_unit: Optional[str] = None
    provider_original_unit: Optional[str] = None
    content_hash: Optional[str] = None
    confidence: Optional[Decimal] = Field(default=Decimal("1.00"), ge=0, le=1)
    is_observed: Optional[bool] = True
    is_estimated: Optional[bool] = False

    @model_validator(mode="after")
    def validate_types(self):
        if self.evidence_type:
            self.evidence_type = self.evidence_type.upper()
        if self.source_type:
            self.source_type = self.source_type.upper()
        return self


class EvidenceCreate(EvidenceBase):
    id: Optional[str] = Field(None, min_length=1, max_length=64)


class EvidenceResponse(EvidenceBase):
    id: str
    created_at: datetime
    server_revision: Optional[int] = None

    @field_serializer("numeric_value")
    def serialize_numeric_value(self, v: Optional[Decimal]) -> Optional[str]:
        if v is not None:
            return f"{Decimal(str(v)):.4f}"
        return None

    @field_serializer("value")
    def serialize_value(self, v: Optional[Decimal]) -> Optional[str]:
        if v is not None:
            return f"{Decimal(str(v)):.4f}"
        return None

    model_config = ConfigDict(from_attributes=True)


class MarketPriceQueryResponse(BaseModel):
    evidence: Optional[EvidenceResponse] = None
    freshness: str
    from_cache: bool
    status: str
    warnings: List[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)
