from datetime import datetime
from typing import List, Optional
from decimal import Decimal
from sqlalchemy import String, Numeric, DateTime, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, generate_uuid_str, utc_now


class Location(Base):
    __tablename__ = "locations"

    id: Mapped[str] = mapped_column(
        String(64), primary_key=True, default=generate_uuid_str
    )
    state: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    district: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    block: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    village_or_city: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    latitude: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 7), nullable=True)
    longitude: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 7), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )

    # Relationships
    users: Mapped[List["User"]] = relationship("User", back_populates="location")
    businesses: Mapped[List["Business"]] = relationship("Business", back_populates="location")
    market_data: Mapped[List["MarketData"]] = relationship("MarketData", back_populates="location")

    __table_args__ = (
        Index("ix_locations_state_district", "state", "district"),
    )
