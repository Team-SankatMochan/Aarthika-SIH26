from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class BusinessBase(BaseModel):
    user_id: str = Field(..., max_length=64, examples=["user_123456"])
    location_id: Optional[str] = Field(None, max_length=64, examples=["loc_123456"])
    business_name: str = Field(..., min_length=2, max_length=200, examples=["Samruddhi Dairy Enterprise"])
    business_category: str = Field(..., min_length=2, max_length=100, examples=["Dairy & Livestock"])
    description: Optional[str] = Field(None, examples=["Procurement and distribution of fresh cow and buffalo milk in Ausa block"])
    status: str = Field(default="DRAFT", examples=["DRAFT", "TESTING", "CRASH_TESTING", "VALIDATING", "FINANCE_READY", "DECIDED"])


class BusinessCreate(BusinessBase):
    id: Optional[str] = Field(None, min_length=1, max_length=64)


class BusinessUpdate(BaseModel):
    user_id: Optional[str] = Field(None, max_length=64)
    location_id: Optional[str] = Field(None, max_length=64)
    business_name: Optional[str] = Field(None, min_length=2, max_length=200)
    business_category: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = None
    status: Optional[str] = None


class BusinessResponse(BusinessBase):
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
