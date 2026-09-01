from datetime import datetime, date
from typing import List, Optional
from decimal import Decimal
from sqlalchemy import String, Text, Numeric, Integer, Boolean, Date, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, generate_uuid_str, utc_now


class Scheme(Base):
    __tablename__ = "schemes"

    id: Mapped[str] = mapped_column(
        String(64), primary_key=True, default=generate_uuid_str
    )
    scheme_name: Mapped[str] = mapped_column(
        String(200), nullable=False, unique=True, index=True
    )
    scheme_type: Mapped[str] = mapped_column(
        String(100), nullable=False, index=True
    )
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )

    # Relationships
    rules: Mapped[List["SchemeRule"]] = relationship(
        "SchemeRule", back_populates="scheme", cascade="all, delete-orphan"
    )
    finance_assessments: Mapped[List["FinanceAssessment"]] = relationship(
        "FinanceAssessment", back_populates="scheme"
    )


class SchemeRule(Base):
    __tablename__ = "scheme_rules"

    id: Mapped[str] = mapped_column(
        String(64), primary_key=True, default=generate_uuid_str
    )
    scheme_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("schemes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    min_project_cost: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )
    max_project_cost: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    financing_percentage: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), default=Decimal("90.00"), nullable=False
    )
    max_loan_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    annual_interest_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    tenure_months: Mapped[int] = mapped_column(Integer, nullable=False)
    moratorium_months: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    effective_from: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    effective_to: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )

    # Relationships
    scheme: Mapped["Scheme"] = relationship("Scheme", back_populates="rules")
    finance_assessments: Mapped[List["FinanceAssessment"]] = relationship(
        "FinanceAssessment", back_populates="scheme_rule"
    )

    __table_args__ = (
        Index("ix_scheme_rules_cost_range", "scheme_id", "min_project_cost", "max_project_cost"),
    )
