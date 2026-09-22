from datetime import datetime
from typing import Optional
from decimal import Decimal
from sqlalchemy import String, Numeric, Integer, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, SyncableMixin, generate_uuid_str, utc_now


class FinanceAssessment(Base, SyncableMixin):
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
    
    # --- New Canonical Assessment Fields ---
    monthly_revenue: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2), nullable=True)
    monthly_variable_cost: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2), nullable=True)
    monthly_fixed_cost: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2), nullable=True)
    monthly_business_surplus: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2), nullable=True)
    
    maximum_scheme_loan_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2), nullable=True)
    affordable_loan_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2), nullable=True)
    
    business_dscr: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2), nullable=True)
    household_existing_debt_ratio: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2), nullable=True)
    household_buffer_ratio: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2), nullable=True)
    break_even_units: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    policy_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    input_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    
    calculation_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # P1: Scheme provenance — snapshot at assessment creation time
    scheme_rule_version: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    scheme_last_verified_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

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
