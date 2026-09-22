from datetime import datetime, date, timezone
from decimal import Decimal
from app.db.base import Base
from sqlalchemy.orm import mapped_column, Mapped
from sqlalchemy import Integer, String, Date, DateTime, Numeric

class DummyModel(Base):
    __tablename__ = "dummy_models"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    test_date: Mapped[date] = mapped_column(Date)
    test_datetime: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    test_decimal: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    test_null: Mapped[str] = mapped_column(String, nullable=True)

def test_base_to_dict_serialization():
    """Verify to_dict properly stringifies date and datetime, and floats Decimal."""
    d = DummyModel(
        id=1,
        test_date=date(2024, 1, 1),
        test_datetime=datetime(2026, 9, 20, 10, 0, 0, tzinfo=timezone.utc),
        test_decimal=Decimal("125000.50"),
        test_null=None
    )
    result = d.to_dict()
    
    assert result["id"] == 1
    assert result["test_date"] == "2024-01-01"
    assert result["test_datetime"] == "2026-09-20T10:00:00+00:00"
    assert result["test_decimal"] == 125000.5
    assert result["test_null"] is None
