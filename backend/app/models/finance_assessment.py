from datetime import datetime
from typing import Optional
from decimal import Decimal
from sqlalchemy import String, Numeric, Integer, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, generate_uuid_str, utc_now


class FinanceAssessment(Base):
    __tablename__ = "finance_assessments"

    id: Mapped[str] = mapped_column(
        String(64), primary_key=True, default=generate_uuid_str
    )
    business_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    scheme_id: Mapped[Optional[str]] = mapped_column(
        String(64), ForeignKey("schemes.id", ondelete="SET NULL"), nullable=True, index=True
    )
    scheme_rule_id: Mapped[Optional[str]] = mapped_column(
        String(64), ForeignKey("scheme_rules.id", ondelete="SET NULL"), nullable=True, index=True
    )
    project_cost: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    margin_contribution: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    maximum_loan: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    recommended_loan: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    annual_interest_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    total_tenure_months: Mapped[int] = mapped_column(Integer, nullable=False)
    moratorium_months: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    active_repayment_months: Mapped[int] = mapped_column(Integer, nullable=False)
    capitalized_principal: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    emi: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    total_interest: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    debt_affordability_status: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )
    debt_service_burden: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    working_capital_requirement: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )
    calculation_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )

    # Relationships
    business: Mapped["Business"] = relationship("Business", back_populates="finance_assessments")
    scheme: Mapped[Optional["Scheme"]] = relationship("Scheme", back_populates="finance_assessments")
    scheme_rule: Mapped[Optional["SchemeRule"]] = relationship("SchemeRule", back_populates="finance_assessments")

    __table_args__ = (
        Index("ix_finance_assessments_biz_version", "business_id", "calculation_version"),
    )
