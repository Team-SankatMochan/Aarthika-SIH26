from datetime import datetime
from typing import Optional
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field, model_validator


class EvidenceBase(BaseModel):
    business_id: str = Field(..., max_length=64)
    evidence_type: str = Field(
        ...,
        examples=["MARKET", "COMPETITION", "PRICING", "COST", "DEMAND", "PILOT", "LOCATION", "FINANCIAL"],
    )
    source: str = Field(..., min_length=2, max_length=150, examples=["Direct Household Survey", "Latur Mandi Price Report"])
    description: str = Field(..., min_length=5, examples=["Surveyed 45 local households, 38 expressed daily fresh milk purchase willingness"])
    value: Optional[Decimal] = Field(None, examples=[38.00])
    confidence: Decimal = Field(default=Decimal("1.00"), ge=0, le=1, examples=[0.85])
    is_observed: bool = Field(default=True)
    is_estimated: bool = Field(default=False)

    @model_validator(mode="after")
    def validate_evidence_source_type(self):
        valid_types = {"MARKET", "COMPETITION", "PRICING", "COST", "DEMAND", "PILOT", "LOCATION", "FINANCIAL"}
        if self.evidence_type.upper() not in valid_types:
            raise ValueError(f"evidence_type must be one of: {', '.join(sorted(valid_types))}")
        self.evidence_type = self.evidence_type.upper()
        if not self.is_observed and not self.is_estimated:
            raise ValueError("Evidence must be either is_observed=True or is_estimated=True")
        return self


class EvidenceCreate(EvidenceBase):
    id: Optional[str] = Field(None, min_length=1, max_length=64)


class EvidenceResponse(EvidenceBase):
    id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
