from datetime import datetime
from typing import Optional
from decimal import Decimal
from sqlalchemy import String, Text, Numeric, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, generate_uuid_str, utc_now


class Evidence(Base):
    __tablename__ = "evidence"

    id: Mapped[str] = mapped_column(
        String(64), primary_key=True, default=generate_uuid_str
    )
    business_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    evidence_type: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )
    source: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    value: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 4), nullable=True)
    confidence: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), default=Decimal("1.00"), nullable=False
    )
    is_observed: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_estimated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )

    # Relationships
    business: Mapped["Business"] = relationship("Business", back_populates="evidence")

    __table_args__ = (
        Index("ix_evidence_biz_type", "business_id", "evidence_type"),
    )
