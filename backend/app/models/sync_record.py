from datetime import datetime
from typing import Optional
from sqlalchemy import String, BigInteger, DateTime, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, generate_uuid_str, utc_now


class SyncRecord(Base):
    __tablename__ = "sync_records"

    id: Mapped[str] = mapped_column(
        String(64), primary_key=True, default=generate_uuid_str
    )
    client_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    entity_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    entity_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    operation: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # CREATE, UPDATE, DELETE
    client_timestamp: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    server_timestamp: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    sync_status: Mapped[str] = mapped_column(
        String(30), default="APPLIED", nullable=False
    )  # APPLIED, CONFLICT_RESOLVED, IGNORED
    payload_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )

    __table_args__ = (
        Index("ix_sync_records_entity_op", "entity_type", "entity_id", "operation"),
        Index("ix_sync_records_server_time", "server_timestamp"),
    )
