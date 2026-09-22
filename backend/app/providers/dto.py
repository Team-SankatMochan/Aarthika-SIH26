from datetime import datetime, date, timezone
from decimal import Decimal
from typing import Optional, List, Generic, TypeVar
from pydantic import BaseModel, Field, ConfigDict
from app.models.evidence_enums import SourceType, ProviderStatus


T = TypeVar("T")


class MarketPriceObservation(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    provider_id: str
    provider_record_id: Optional[str] = None
    commodity: str
    market_id: Optional[str] = None
    market_name: Optional[str] = None
    state: str
    district: str
    observation_date: date
    price_type: str  # MIN, MAX, MODAL
    currency: str = "INR"
    quantity_unit: str  # KG, QUINTAL, LITRE, UNIT
    numeric_value: Decimal
    provider_original_unit: Optional[str] = None


class ProviderResult(BaseModel, Generic[T]):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    provider_id: str
    source_type: SourceType
    source_name: Optional[str] = None
    source_url: Optional[str] = None
    retrieved_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: ProviderStatus
    warnings: List[str] = Field(default_factory=list)
    observations: List[T] = Field(default_factory=list)


def normalize_market_unit(raw_unit: Optional[str]) -> tuple[str, str]:
    """Deterministically normalizes currency and quantity unit from provider strings.
    
    Returns (currency, quantity_unit).
    Preserves provider semantics: does not cross-convert units (e.g. quintal to kg).
    Supported quantity units: KG, QUINTAL, LITRE, UNIT.
    """
    if not raw_unit:
        return ("INR", "UNIT")

    u = raw_unit.strip().lower()

    # Detect currency
    currency = "INR"
    if "$" in u or "usd" in u:
        currency = "USD"
    elif "eur" in u or "€" in u:
        currency = "EUR"

    # Detect quantity unit
    if any(q in u for q in ["quintal", "qtl"]):
        quantity_unit = "QUINTAL"
    elif any(k in u for k in ["/kg", "per kg", "kg"]):
        quantity_unit = "KG"
    elif any(l in u for l in ["litre", "liter", "/l"]):
        quantity_unit = "LITRE"
    else:
        quantity_unit = "UNIT"

    return (currency, quantity_unit)
