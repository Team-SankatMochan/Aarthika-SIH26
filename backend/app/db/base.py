import uuid
from datetime import datetime, timezone
from typing import Any, Dict
from sqlalchemy import DateTime, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def generate_uuid_str() -> str:
    """Generate a clean UUID string for primary keys."""
    return uuid.uuid4().hex


def utc_now() -> datetime:
    """Return timezone-aware current UTC datetime."""
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    """Base model class with common fields and serialization helpers."""

    def to_dict(self) -> Dict[str, Any]:
        """Serialize model instance to dictionary."""
        result = {}
        for col in self.__table__.columns:
            val = getattr(self, col.name)
            if isinstance(val, datetime):
                result[col.name] = val.isoformat()
            else:
                result[col.name] = val
        return result
