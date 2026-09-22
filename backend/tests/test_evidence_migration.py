from decimal import Decimal
import pytest
from app.models.evidence import Evidence, validate_canonical_evidence
from app.models.evidence_enums import SourceType, EvidenceType


def test_legacy_evidence_row_remains_readable_with_old_value(db_session, sample_business):
    """1, 2, 4: Existing legacy Evidence survives migration, old value retained, row remains readable."""
    biz = sample_business["business"]

    # Emulate legacy row having only legacy fields
    legacy_ev = Evidence(
        business_id=biz.id,
        evidence_type="MARKET",
        source="Mandi Survey",
        description="Local market prices reported by vendor",
        value=Decimal("1850.0000"),
        source_type=SourceType.LEGACY_UNKNOWN.value,
        is_observed=True,
    )
    db_session.add(legacy_ev)
    db_session.commit()
    db_session.refresh(legacy_ev)

    # 1. Row is readable
    assert legacy_ev.id is not None
    # 2. Old value retained
    assert legacy_ev.value == Decimal("1850.0000")
    # 3. Unknown old provenance is LEGACY_UNKNOWN
    assert legacy_ev.source_type == SourceType.LEGACY_UNKNOWN.value
    assert legacy_ev.provider_id is None
    assert legacy_ev.source_name is None


def test_legacy_value_validation_tolerates_legacy_records():
    """3. Legacy value validation accepts legacy records with old value only."""
    # Should not raise for LEGACY_UNKNOWN with legacy_value
    validate_canonical_evidence(
        source_type=SourceType.LEGACY_UNKNOWN,
        evidence_type=EvidenceType.LEGACY_UNKNOWN,
        legacy_value=Decimal("1850.0000"),
        is_legacy=True,
    )
