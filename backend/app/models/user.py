from datetime import datetime
from typing import List, Optional, Any, Dict
from decimal import Decimal
from sqlalchemy import String, Numeric, Integer, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, SyncableMixin, generate_uuid_str, utc_now


class User(Base, SyncableMixin):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(64), primary_key=True, default=generate_uuid_str
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, index=True)
    location_id: Mapped[Optional[str]] = mapped_column(
        String(64), ForeignKey("locations.id", ondelete="SET NULL"), nullable=True, index=True
    )
    available_capital: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )
    skills: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    experience: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    assets: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    family_workforce: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    preferences: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    risk_tolerance: Mapped[str] = mapped_column(
        String(50), default="MODERATE", nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )

    # Relationships
    location: Mapped[Optional["Location"]] = relationship("Location", back_populates="users")
    businesses: Mapped[List["Business"]] = relationship(
        "Business", back_populates="user", cascade="all, delete-orphan"
    )
