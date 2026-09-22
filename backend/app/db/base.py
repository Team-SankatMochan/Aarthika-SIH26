import uuid
from datetime import datetime, date, timezone
from decimal import Decimal
from typing import Any, Dict
from sqlalchemy import DateTime, BigInteger, Sequence
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def generate_uuid_str() -> str:
    """Generate a clean UUID string for primary keys."""
    return uuid.uuid4().hex


def utc_now() -> datetime:
    """Return timezone-aware current UTC datetime."""
    return datetime.now(timezone.utc)

# Global sequence for monotonic revisions
global_sync_sequence = Sequence("global_sync_sequence")


class Base(DeclarativeBase):
    """Base model class with common fields and serialization helpers."""

    def to_dict(self) -> Dict[str, Any]:
        """Serialize model instance to dictionary.
        
        Handles datetime, date, and Decimal types explicitly
        to produce JSON-safe output for sync transport.
        """
        result = {}
        for col in self.__table__.columns:
            val = getattr(self, col.name)
            if isinstance(val, datetime):
                result[col.name] = val.isoformat()
            elif isinstance(val, date):
                result[col.name] = val.isoformat()  # YYYY-MM-DD
            elif isinstance(val, Decimal):
                result[col.name] = float(val)
            else:
                result[col.name] = val
        return result


class SyncableMixin:
    """Mixin for models that participate in offline synchronization."""
    
    server_revision: Mapped[int] = mapped_column(
        BigInteger, default=0, nullable=False, index=True
    )
