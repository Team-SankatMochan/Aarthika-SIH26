from datetime import datetime
from typing import Optional, Any, Dict
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field, model_validator


class DecisionBase(BaseModel):
    business_id: str = Field(..., max_length=64)
    decision: str = Field(..., examples=["GO", "MODIFY", "DO_NOT_INVEST_YET"])
    rationale: str = Field(..., min_length=10, examples=["Business demonstrates positive unit economics with 1.8x DSCR under standard crash test."])
    confidence: Decimal = Field(default=Decimal("0.80"), ge=0, le=1, examples=[0.85])
    evidence_summary: Optional[Dict[str, Any]] = Field(default_factory=dict)
    assumptions_summary: Optional[Dict[str, Any]] = Field(default_factory=dict)
    financial_risk_summary: Optional[Dict[str, Any]] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_decision_enum(self):
        valid = {"GO", "MODIFY", "DO_NOT_INVEST_YET"}
        if self.decision.upper() not in valid:
            raise ValueError(f"decision must be one of: {', '.join(sorted(valid))}")
        self.decision = self.decision.upper()
        return self


class DecisionCreate(DecisionBase):
    id: Optional[str] = Field(None, min_length=1, max_length=64)


class DecisionResponse(DecisionBase):
    id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
