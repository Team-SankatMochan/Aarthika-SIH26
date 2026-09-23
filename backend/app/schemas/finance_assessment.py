from datetime import datetime
from typing import Optional
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field, model_validator


class FinanceAssessmentRequest(BaseModel):
    scheme_id: Optional[str] = None
    scheme_rule_id: Optional[str] = None
    financing_mode: str = Field(default="SCHEME")  # "SCHEME" or "MANUAL"
    
    project_cost: Optional[Decimal] = Field(None, ge=0)
    
    monthly_units_sold: Optional[Decimal] = Field(None, ge=0)
    selling_price_per_unit: Optional[Decimal] = Field(None, ge=0)
    variable_cost_per_unit: Optional[Decimal] = Field(None, ge=0)
    
    monthly_labour_cost: Optional[Decimal] = Field(None, ge=0)
    monthly_rent: Optional[Decimal] = Field(None, ge=0)
    monthly_transport_cost: Optional[Decimal] = Field(None, ge=0)
    monthly_other_fixed_cost: Optional[Decimal] = Field(None, ge=0)
    
    requested_loan_amount: Optional[Decimal] = Field(None, ge=0)
    working_capital_required: Optional[Decimal] = Field(None, ge=0)
    
    monthly_household_nonbusiness_income: Optional[Decimal] = Field(None, ge=0)
    monthly_household_essential_expenses: Optional[Decimal] = Field(None, ge=0)
    existing_monthly_household_debt_payments: Optional[Decimal] = Field(None, ge=0)

    # Manual terms
    annual_interest_rate_percent: Optional[Decimal] = Field(None, ge=0)
    repayment_tenure_months: Optional[int] = Field(None, ge=0)
    moratorium_months: Optional[int] = Field(None, ge=0)
    moratorium_interest_method: Optional[str] = Field(None)

class FinanceAssessmentBase(BaseModel):
    business_id: str = Field(..., max_length=64)
    scheme_id: Optional[str] = None
    scheme_rule_id: Optional[str] = None
    
    # Keeping old fields as optional to not break schema entirely, though P2 says remove fallbacks
    project_cost: Optional[Decimal] = Field(None, ge=0)
    margin_contribution: Optional[Decimal] = Field(None, ge=0)
    
    maximum_loan: Optional[Decimal] = Field(None, ge=0)
    recommended_loan: Optional[Decimal] = Field(None, ge=0)
    annual_interest_rate: Optional[Decimal] = Field(None, ge=0)
    total_tenure_months: Optional[int] = Field(None, ge=0)
    moratorium_months: int = Field(default=0, ge=0)
    active_repayment_months: Optional[int] = Field(None, ge=0)
    
    capitalized_principal: Optional[Decimal] = Field(None, ge=0)
    emi: Optional[Decimal] = Field(None, ge=0)
    total_interest: Optional[Decimal] = Field(None, ge=0)
    
    debt_affordability_status: str = Field(..., examples=["INSUFFICIENT_DATA", "HIGH_RISK", "READY_FOR_FINANCE_REVIEW"])
    debt_service_burden: Optional[Decimal] = Field(None, ge=0)
    working_capital_requirement: Optional[Decimal] = Field(None, ge=0)
    calculation_version: int = Field(default=1, ge=1)
    
    # --- Canonical Assessment Fields ---
    monthly_revenue: Optional[Decimal] = Field(None, ge=0)
    monthly_variable_cost: Optional[Decimal] = Field(None, ge=0)
    monthly_fixed_cost: Optional[Decimal] = Field(None, ge=0)
    monthly_business_surplus: Optional[Decimal] = Field(None)
    
    affordable_loan_amount: Optional[Decimal] = Field(None, ge=0)
    
    business_dscr: Optional[Decimal] = Field(None, ge=0)
    household_existing_debt_ratio: Optional[Decimal] = Field(None, ge=0)
    household_buffer_ratio: Optional[Decimal] = Field(None)
    break_even_units: Optional[int] = Field(None)
    
    policy_version: Optional[str] = Field(None, max_length=50)
    engine_version: Optional[str] = Field(None, max_length=50)
    input_hash: Optional[str] = Field(None, max_length=64)


class FinanceAssessmentCreate(FinanceAssessmentBase):
    id: Optional[str] = Field(None, min_length=1, max_length=64)


class FinanceAssessmentResponse(FinanceAssessmentBase):
    id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
