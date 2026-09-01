from datetime import datetime
from typing import Optional, Any
from decimal import Decimal
from sqlalchemy import String, Text, Numeric, DateTime, ForeignKey, JSON, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, generate_uuid_str, utc_now


class Decision(Base):
    __tablename__ = "decisions"

    id: Mapped[str] = mapped_column(
        String(64), primary_key=True, default=generate_uuid_str
    )
    business_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    decision: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # GO, MODIFY, DO_NOT_INVEST_YET
    rationale: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), default=Decimal("0.80"), nullable=False
    )
    evidence_summary: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    assumptions_summary: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    financial_risk_summary: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )

    # Relationships
    business: Mapped["Business"] = relationship("Business", back_populates="decisions")

    __table_args__ = (
        Index("ix_decisions_biz_created", "business_id", "created_at"),
    )
