from datetime import datetime
from typing import List, Optional
from decimal import Decimal
from sqlalchemy import String, Numeric, Integer, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, generate_uuid_str, utc_now


class BusinessAssumption(Base):
    __tablename__ = "business_assumptions"

    id: Mapped[str] = mapped_column(
        String(64), primary_key=True, default=generate_uuid_str
    )
    business_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    expected_customers: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    selling_price: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )
    production_volume: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )
    raw_material_cost: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )
    labour_cost: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )
    rent: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )
    transport_cost: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )
    working_capital: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )
    proposed_loan_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )
    other_operating_cost: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )
    assumption_source: Mapped[str] = mapped_column(
        String(100), default="ENTREPRENEUR", nullable=False
    )
    confidence: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), default=Decimal("0.70"), nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )

    # Relationships
    business: Mapped["Business"] = relationship("Business", back_populates="assumptions")
    stress_tests: Mapped[List["StressTest"]] = relationship("StressTest", back_populates="base_assumption")

    __table_args__ = (
        Index("ix_business_assumptions_biz_created", "business_id", "created_at"),
    )
