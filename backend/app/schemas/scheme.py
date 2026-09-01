from datetime import datetime, date
from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field, model_validator


class SchemeRuleBase(BaseModel):
    scheme_id: Optional[str] = Field(None, max_length=64)
    min_project_cost: Decimal = Field(default=Decimal("0.00"), ge=0, examples=[0.00])
    max_project_cost: Decimal = Field(..., gt=0, examples=[140000.00])
    financing_percentage: Decimal = Field(default=Decimal("90.00"), gt=0, le=100, examples=[90.00])
    max_loan_amount: Decimal = Field(..., gt=0, examples=[125000.00])
    annual_interest_rate: Decimal = Field(..., gt=0, le=100, examples=[6.50])
    tenure_months: int = Field(..., gt=0, examples=[36])
    moratorium_months: int = Field(default=0, ge=0, examples=[3])
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None
    active: bool = True

    @model_validator(mode="after")
    def validate_rules_consistency(self):
        if self.min_project_cost > self.max_project_cost:
            raise ValueError("min_project_cost cannot be greater than max_project_cost")
        if self.moratorium_months >= self.tenure_months:
            raise ValueError("moratorium_months must be strictly less than total tenure_months")
        return self


class SchemeRuleCreate(SchemeRuleBase):
    id: Optional[str] = Field(None, min_length=1, max_length=64)


class SchemeRuleResponse(SchemeRuleBase):
    id: str
    scheme_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SchemeBase(BaseModel):
    scheme_name: str = Field(..., min_length=2, max_length=200, examples=["Micro Finance Scheme"])
    scheme_type: str = Field(..., min_length=2, max_length=100, examples=["MICRO_FINANCE", "TERM_LOAN"])
    description: Optional[str] = None
    active: bool = True


class SchemeCreate(SchemeBase):
    id: Optional[str] = Field(None, min_length=1, max_length=64)
    rules: Optional[List[SchemeRuleCreate]] = Field(default_factory=list)


class SchemeResponse(SchemeBase):
    id: str
    created_at: datetime
    updated_at: datetime
    rules: List[SchemeRuleResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)
