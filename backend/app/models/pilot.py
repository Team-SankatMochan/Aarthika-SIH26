from datetime import datetime, date
from typing import List, Optional
from decimal import Decimal
from sqlalchemy import String, Text, Numeric, Integer, Date, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, generate_uuid_str, utc_now


class Pilot(Base):
    __tablename__ = "pilots"

    id: Mapped[str] = mapped_column(
        String(64), primary_key=True, default=generate_uuid_str
    )
    business_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    objective: Mapped[str] = mapped_column(Text, nullable=False)
    hypothesis: Mapped[str] = mapped_column(Text, nullable=False)
    duration_days: Mapped[int] = mapped_column(Integer, default=14, nullable=False)
    status: Mapped[str] = mapped_column(
        String(50), default="PLANNED", nullable=False, index=True
    )
    start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )

    # Relationships
    business: Mapped["Business"] = relationship("Business", back_populates="pilots")
    results: Mapped[List["PilotResult"]] = relationship(
        "PilotResult", back_populates="pilot", cascade="all, delete-orphan"
    )


class PilotResult(Base):
    __tablename__ = "pilot_results"

    id: Mapped[str] = mapped_column(
        String(64), primary_key=True, default=generate_uuid_str
    )
    pilot_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("pilots.id", ondelete="CASCADE"), nullable=False, index=True
    )
    target_customers: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    actual_customers: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    repeat_purchase_rate: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), default=Decimal("0.00"), nullable=False
    )
    price_acceptance: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), default=Decimal("0.00"), nullable=False
    )
    delivery_cost: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )
    conversion_rate: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), default=Decimal("0.00"), nullable=False
    )
    actual_revenue: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )
    actual_cost: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )
    customer_feedback: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    observations: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )

    # Relationships
    pilot: Mapped["Pilot"] = relationship("Pilot", back_populates="results")
