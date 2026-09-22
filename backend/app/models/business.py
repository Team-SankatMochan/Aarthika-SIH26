from datetime import datetime
from typing import List, Optional
from sqlalchemy import String, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, SyncableMixin, generate_uuid_str, utc_now


class Business(Base, SyncableMixin):
    __tablename__ = "businesses"

    id: Mapped[str] = mapped_column(
        String(64), primary_key=True, default=generate_uuid_str
    )
    user_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    location_id: Mapped[Optional[str]] = mapped_column(
        String(64), ForeignKey("locations.id", ondelete="SET NULL"), nullable=True, index=True
    )
    business_name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    business_category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(50), default="DRAFT", nullable=False, index=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="businesses")
    location: Mapped[Optional["Location"]] = relationship("Location", back_populates="businesses")
    market_data: Mapped[List["MarketData"]] = relationship(
        "MarketData", back_populates="business", cascade="all, delete-orphan"
    )
    assumptions: Mapped[List["BusinessAssumption"]] = relationship(
        "BusinessAssumption", back_populates="business", cascade="all, delete-orphan"
    )
    stress_tests: Mapped[List["StressTest"]] = relationship(
        "StressTest", back_populates="business", cascade="all, delete-orphan"
    )
    pilots: Mapped[List["Pilot"]] = relationship(
        "Pilot", back_populates="business", cascade="all, delete-orphan"
    )
    finance_assessments: Mapped[List["FinanceAssessment"]] = relationship(
        "FinanceAssessment", back_populates="business", cascade="all, delete-orphan"
    )
    evidence: Mapped[List["Evidence"]] = relationship(
        "Evidence", back_populates="business", cascade="all, delete-orphan"
    )
    decisions: Mapped[List["Decision"]] = relationship(
        "Decision", back_populates="business", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_businesses_user_category", "user_id", "business_category"),
    )
