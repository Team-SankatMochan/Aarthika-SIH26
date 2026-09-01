from datetime import datetime
from typing import Optional, List, Any, Dict
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field


class UserBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=150, examples=["Ramesh Patil"])
    phone: Optional[str] = Field(None, max_length=20, examples=["+919876543210"])
    location_id: Optional[str] = Field(None, max_length=64)
    available_capital: Decimal = Field(default=Decimal("0.00"), ge=0, examples=[50000.00])
    skills: Optional[List[str]] = Field(default_factory=list, examples=[["dairy_farming", "milk_testing"]])
    experience: Optional[str] = Field(None, max_length=255, examples=["5 years small dairy farming"])
    assets: Optional[List[str]] = Field(default_factory=list, examples=[["1 acre land", "borewell"]])
    family_workforce: int = Field(default=1, ge=0, examples=[2])
    preferences: Optional[Dict[str, Any]] = Field(default_factory=dict)
    risk_tolerance: str = Field(default="MODERATE", examples=["LOW", "MODERATE", "HIGH"])


class UserCreate(UserBase):
    id: Optional[str] = Field(None, min_length=1, max_length=64)


class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=150)
    phone: Optional[str] = Field(None, max_length=20)
    location_id: Optional[str] = Field(None, max_length=64)
    available_capital: Optional[Decimal] = Field(None, ge=0)
    skills: Optional[List[str]] = None
    experience: Optional[str] = Field(None, max_length=255)
    assets: Optional[List[str]] = None
    family_workforce: Optional[int] = Field(None, ge=0)
    preferences: Optional[Dict[str, Any]] = None
    risk_tolerance: Optional[str] = None


class UserResponse(UserBase):
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
