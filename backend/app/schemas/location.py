from datetime import datetime
from typing import Optional
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field, field_validator


class LocationBase(BaseModel):
    state: str = Field(..., min_length=2, max_length=100, examples=["Maharashtra"])
    district: str = Field(..., min_length=2, max_length=100, examples=["Latur"])
    block: Optional[str] = Field(None, max_length=100, examples=["Ausa"])
    village_or_city: str = Field(..., min_length=2, max_length=100, examples=["Latur City"])
    latitude: Optional[Decimal] = Field(None, ge=-90, le=90, examples=[18.4088])
    longitude: Optional[Decimal] = Field(None, ge=-180, le=180, examples=[76.5604])


class LocationCreate(LocationBase):
    id: Optional[str] = Field(None, min_length=1, max_length=64)


class LocationUpdate(BaseModel):
    state: Optional[str] = Field(None, min_length=2, max_length=100)
    district: Optional[str] = Field(None, min_length=2, max_length=100)
    block: Optional[str] = Field(None, max_length=100)
    village_or_city: Optional[str] = Field(None, min_length=2, max_length=100)
    latitude: Optional[Decimal] = Field(None, ge=-90, le=90)
    longitude: Optional[Decimal] = Field(None, ge=-180, le=180)


class LocationResponse(LocationBase):
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
