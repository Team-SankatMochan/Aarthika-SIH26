from datetime import datetime
from typing import Optional
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field, model_validator


class FinanceAssessmentRequest(BaseModel):
    scheme_id: Optional[str] = None
    scheme_rule_id: Optional[str] = None
    project_cost: Optional[Decimal] = Field(None, gt=0, examples=[140000.00])
    margin_contribution: Optional[Decimal] = Field(None, gt=0, examples=[14000.00])
    monthly_net_cash_flow: Optional[Decimal] = Field(None, examples=[12500.00])
    working_capital_needed: Optional[Decimal] = Field(None, ge=0, examples=[15000.00])

    @model_validator(mode="after")
    def validate_cost_or_margin_provided(self):
        if self.project_cost is None and self.margin_contribution is None:
            raise ValueError("Either project_cost or margin_contribution must be provided")
        return self


class FinanceAssessmentBase(BaseModel):
    business_id: str = Field(..., max_length=64)
    scheme_id: Optional[str] = None
    scheme_rule_id: Optional[str] = None
    project_cost: Decimal = Field(..., gt=0, examples=[140000.00])
    margin_contribution: Decimal = Field(..., ge=0, examples=[14000.00])
    maximum_loan: Decimal = Field(..., ge=0, examples=[125000.00])
    recommended_loan: Decimal = Field(..., ge=0, examples=[100000.00])
    annual_interest_rate: Decimal = Field(..., gt=0, le=100, examples=[6.50])
    total_tenure_months: int = Field(..., gt=0, examples=[36])
    moratorium_months: int = Field(default=0, ge=0, examples=[3])
    active_repayment_months: int = Field(..., gt=0, examples=[33])
    capitalized_principal: Decimal = Field(..., ge=0, examples=[101625.00])
    emi: Decimal = Field(..., ge=0, examples=[3367.45])
    total_interest: Decimal = Field(..., ge=0, examples=[9500.85])
    debt_affordability_status: str = Field(..., examples=["AFFORDABLE", "STRETCHED", "UNSUSTAINABLE"])
    debt_service_burden: Decimal = Field(..., ge=0, examples=[26.94])
    working_capital_requirement: Decimal = Field(default=Decimal("0.00"), ge=0)
    calculation_version: int = Field(default=1, ge=1)


class FinanceAssessmentCreate(FinanceAssessmentBase):
    id: Optional[str] = Field(None, min_length=1, max_length=64)


class FinanceAssessmentResponse(FinanceAssessmentBase):
    id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
