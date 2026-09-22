from datetime import datetime, date
from typing import Optional, Dict, Any, List
from decimal import Decimal
from sqlalchemy import String, Text, Numeric, Boolean, DateTime, Date, ForeignKey, Index, JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, SyncableMixin, generate_uuid_str, utc_now
from app.models.evidence_enums import SourceType, EvidenceType


def validate_canonical_evidence(
    source_type: str | SourceType,
    evidence_type: str | EvidenceType,
    numeric_value: Optional[Decimal] = None,
    text_value: Optional[str] = None,
    boolean_value: Optional[bool] = None,
    derivation_type: Optional[str] = None,
    derivation_version: Optional[str] = None,
    parent_evidence_ids: Optional[Any] = None,
    is_legacy: bool = False,
    legacy_value: Optional[Decimal] = None,
) -> None:
    """Validates invariant for Evidence records.
    
    1. For canonical records: exactly ONE of numeric_value, text_value, boolean_value must be non-null.
    2. For DERIVED records: derivation_type, derivation_version, and parent_evidence_ids (len >= 1) required.
    3. Legacy records retaining only legacy `value` are permitted if marked legacy or source_type=LEGACY_UNKNOWN.
    """
    # Check valid enums
    st_val = source_type.value if isinstance(source_type, SourceType) else str(source_type)
    et_val = evidence_type.value if isinstance(evidence_type, EvidenceType) else str(evidence_type)
    
    valid_source_types = {e.value for e in SourceType}
    if st_val not in valid_source_types:
        raise ValueError(f"Invalid source_type: {st_val}. Must be one of {valid_source_types}")

    valid_evidence_types = {e.value for e in EvidenceType}
    if et_val not in valid_evidence_types:
        raise ValueError(f"Invalid evidence_type: {et_val}. Must be one of {valid_evidence_types}")

    # Check typed-value invariant
    has_numeric = numeric_value is not None
    has_text = text_value is not None
    has_boolean = boolean_value is not None
    count_typed = sum(1 for x in (has_numeric, has_text, has_boolean) if x)

    if count_typed == 0:
        if (is_legacy or st_val == SourceType.LEGACY_UNKNOWN.value) and legacy_value is not None:
            # Valid legacy row
            return
        raise ValueError("Canonical Evidence must have exactly one of numeric_value, text_value, or boolean_value; none provided")

    if count_typed > 1:
        raise ValueError(
            f"Canonical Evidence must have exactly one of numeric_value, text_value, or boolean_value; "
            f"provided numeric={has_numeric}, text={has_text}, boolean={has_boolean}"
        )

    # Check DERIVED contract
    if st_val == SourceType.DERIVED.value:
        if not derivation_type or not str(derivation_type).strip():
            raise ValueError("DERIVED evidence requires derivation_type")
        if not derivation_version or not str(derivation_version).strip():
            raise ValueError("DERIVED evidence requires derivation_version")
        
        parent_ids = parent_evidence_ids
        if isinstance(parent_ids, dict):
            parent_ids = parent_ids.get("ids", list(parent_ids.values()))
        if not parent_ids or not isinstance(parent_ids, (list, tuple)) or len(parent_ids) < 1:
            raise ValueError("DERIVED evidence requires parent_evidence_ids with at least one parent ID")


class Evidence(Base, SyncableMixin):
    __tablename__ = "evidence"

    # server_revision: Mapped[int] is inherited from SyncableMixin as BigInteger!

    id: Mapped[str] = mapped_column(
        String(64), primary_key=True, default=generate_uuid_str
    )
    business_id: Mapped[Optional[str]] = mapped_column(
        String(64), ForeignKey("businesses.id", ondelete="CASCADE"), nullable=True, index=True
    )
    provider_id: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, index=True
    )
    provider_record_id: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True
    )
    evidence_type: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )
    source_type: Mapped[str] = mapped_column(
        String(50), default="USER_ENTERED", nullable=False, index=True
    )
    source_name: Mapped[Optional[str]] = mapped_column(
        String(300), nullable=True
    )
    source_url: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True
    )
    metric_name: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True
    )
    numeric_value: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(14, 4), nullable=True
    )
    text_value: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )
    boolean_value: Mapped[Optional[bool]] = mapped_column(
        Boolean, nullable=True
    )
    observation_date: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True
    )
    reference_period_start: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True
    )
    reference_period_end: Mapped[Optional[date]] = mapped_column(
        Date, nullable=True
    )
    retrieved_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    provider_last_updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    state: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, index=True
    )
    district: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, index=True
    )
    commodity: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, index=True
    )
    business_category: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True
    )
    market_id: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, index=True
    )
    market_name: Mapped[Optional[str]] = mapped_column(
        String(200), nullable=True
    )
    price_type: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True
    )
    currency: Mapped[Optional[str]] = mapped_column(
        String(10), nullable=True, default="INR"
    )
    quantity_unit: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True
    )
    provider_original_unit: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True
    )
    content_hash: Mapped[Optional[str]] = mapped_column(
        String(64), nullable=True, index=True
    )
    derivation_type: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True
    )
    derivation_version: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True
    )
    parent_evidence_ids: Mapped[Optional[Any]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), nullable=True
    )
    raw_reference: Mapped[Optional[Any]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )

    # Legacy fields preserved for backward compatibility
    value: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 4), nullable=True)
    source: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    confidence: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(5, 2), default=Decimal("1.00"), nullable=True
    )
    is_observed: Mapped[Optional[bool]] = mapped_column(Boolean, default=True, nullable=True)
    is_estimated: Mapped[Optional[bool]] = mapped_column(Boolean, default=False, nullable=True)

    # Relationships
    business: Mapped[Optional["Business"]] = relationship("Business", back_populates="evidence")

    __table_args__ = (
        Index("ix_evidence_biz_type", "business_id", "evidence_type"),
        Index("ix_evidence_cache_lookup", "provider_id", "evidence_type", "commodity", "state", "district"),
    )

    def to_dict(self) -> Dict[str, Any]:
        """Serialize model instance with canonical decimal string representation for evidence."""
        result = super().to_dict()
        if self.numeric_value is not None:
            result["numeric_value"] = f"{Decimal(str(self.numeric_value)):.4f}"
        if self.value is not None:
            result["value"] = f"{Decimal(str(self.value)):.4f}"
        return result
