from datetime import datetime
from typing import Optional, Any, Dict
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field, model_validator


class DecisionBase(BaseModel):
    business_id: str = Field(..., max_length=64)
    decision: str = Field(..., examples=["READY_FOR_FINANCE_REVIEW", "HIGH_RISK", "TEST_FIRST", "MODIFY", "INCOMPLETE", "INSUFFICIENT_DATA"])
    rationale: str = Field(..., min_length=5, examples=["Business demonstrates positive unit economics with DSCR >= 1.25 under standard stress test."])
    confidence: Optional[Decimal] = Field(default=None, ge=0, le=1, examples=[0.85])
    evidence_summary: Optional[Dict[str, Any]] = Field(default_factory=dict)
    assumptions_summary: Optional[Dict[str, Any]] = Field(default_factory=dict)
    financial_risk_summary: Optional[Dict[str, Any]] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_decision_enum(self):
        valid = {
            "READY_FOR_FINANCE_REVIEW",
            "HIGH_RISK",
            "TEST_FIRST",
            "MODIFY",
            "INCOMPLETE",
            "INSUFFICIENT_DATA",
        }
        dec_upper = self.decision.upper()
        if dec_upper not in valid:
            raise ValueError(f"decision must be one of: {', '.join(sorted(valid))}")
        self.decision = dec_upper
        return self


class DecisionCreate(DecisionBase):
    id: Optional[str] = Field(None, min_length=1, max_length=64)


class DecisionResponse(DecisionBase):
    id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
