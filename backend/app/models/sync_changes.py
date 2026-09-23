from datetime import datetime
from typing import Optional
from sqlalchemy import String, BigInteger, DateTime, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, generate_uuid_str, utc_now

class SyncChange(Base):
    __tablename__ = "sync_changes"

    sequence: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    table_name: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    record_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    operation: Mapped[str] = mapped_column(String(20), nullable=False) # CREATE, UPDATE, DELETE
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    __table_args__ = (
        Index("ix_sync_changes_table_op", "table_name", "operation"),
    )

class SyncRequestRecord(Base):
    __tablename__ = "sync_requests"

    sync_request_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="PENDING", nullable=False) # PENDING, SUCCESS, FAILED
    payload_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    
