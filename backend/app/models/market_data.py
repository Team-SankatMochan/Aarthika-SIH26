from datetime import datetime, date
from typing import Optional, Any
from decimal import Decimal
from sqlalchemy import String, Numeric, Boolean, Date, DateTime, ForeignKey, JSON, Index, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, SyncableMixin, generate_uuid_str, utc_now


class MarketData(Base, SyncableMixin):
    __tablename__ = "market_data"

    id: Mapped[str] = mapped_column(
        String(64), primary_key=True, default=generate_uuid_str
    )
    location_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("locations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    business_id: Mapped[Optional[str]] = mapped_column(
        String(64), ForeignKey("businesses.id", ondelete="SET NULL"), nullable=True, index=True
    )
    data_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    source: Mapped[str] = mapped_column(String(150), nullable=False)
    value: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    unit: Mapped[str] = mapped_column(String(50), nullable=False)
    observation_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    confidence: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), default=Decimal("1.00"), nullable=False
    )
    is_observed: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_estimated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    metadata_json: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )

    # Relationships
    location: Mapped["Location"] = relationship("Location", back_populates="market_data")
    business: Mapped[Optional["Business"]] = relationship("Business", back_populates="market_data")

    __table_args__ = (
        Index("ix_market_data_loc_type", "location_id", "data_type"),
        CheckConstraint(
            "(is_observed = true AND is_estimated = false) OR (is_observed = false AND is_estimated = true) OR (is_observed = true AND is_estimated = true)",
            name="check_observed_estimated_validity",
        ),
    )
