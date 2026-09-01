from datetime import datetime
from typing import List, Optional
from decimal import Decimal
from sqlalchemy import String, Text, Numeric, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, generate_uuid_str, utc_now


class StressTest(Base):
    __tablename__ = "stress_tests"

    id: Mapped[str] = mapped_column(
        String(64), primary_key=True, default=generate_uuid_str
    )
    business_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    base_assumption_id: Mapped[Optional[str]] = mapped_column(
        String(64), ForeignKey("business_assumptions.id", ondelete="SET NULL"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(50), default="COMPLETED", nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )

    # Relationships
    business: Mapped["Business"] = relationship("Business", back_populates="stress_tests")
    base_assumption: Mapped[Optional["BusinessAssumption"]] = relationship("BusinessAssumption", back_populates="stress_tests")
    scenarios: Mapped[List["StressTestScenario"]] = relationship(
        "StressTestScenario", back_populates="stress_test", cascade="all, delete-orphan"
    )


class StressTestScenario(Base):
    __tablename__ = "stress_test_scenarios"

    id: Mapped[str] = mapped_column(
        String(64), primary_key=True, default=generate_uuid_str
    )
    stress_test_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("stress_tests.id", ondelete="CASCADE"), nullable=False, index=True
    )
    scenario_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    parameter_name: Mapped[str] = mapped_column(String(100), nullable=False)
    change_percentage: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2), nullable=True)
    change_absolute: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2), nullable=True)
    revenue: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    operating_cost: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    cash_surplus: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    debt_repayment_burden: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    working_capital_pressure: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    break_even: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    resilience_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    result_status: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )

    # Relationships
    stress_test: Mapped["StressTest"] = relationship("StressTest", back_populates="scenarios")

    __table_args__ = (
        Index("ix_stress_scenarios_test_type", "stress_test_id", "scenario_type"),
    )
