import uuid
from decimal import Decimal
import pytest
from app.models.evidence import Evidence
from app.models.evidence_enums import SourceType, EvidenceType
from app.models.business import Business
from app.schemas.sync import SyncRequest, TableChanges
from app.services.sync_service import process_sync_request


@pytest.fixture
def sync_business(db_session, sample_business):
    return sample_business["business"]


def test_client_user_entered_create_accepted(db_session, sync_business):
    """15. Client USER_ENTERED create accepted."""
    ev_id = uuid.uuid4().hex
    sync_req = SyncRequest(
        sync_request_id=f"test_sync_{uuid.uuid4().hex}",
        lastPulledAt=0,
        changes={
            "evidence": TableChanges(
                created=[
                    {
                        "id": ev_id,
                        "business_id": sync_business.id,
                        "evidence_type": "MARKET_PRICE",
                        "source_type": "USER_ENTERED",
                        "numeric_value": "150.0000",
                    }
                ],
                updated=[],
                deleted=[],
            )
        },
    )

    resp = process_sync_request(sync_req, db_session)
    assert resp.status == "success"
    created = db_session.get(Evidence, ev_id)
    assert created is not None
    assert created.source_type == "USER_ENTERED"


def test_server_forces_user_entered_when_omitted(db_session, sync_business):
    """16. Server forces USER_ENTERED provenance when omitted by client."""
    ev_id = uuid.uuid4().hex
    sync_req = SyncRequest(
        sync_request_id=f"test_sync_{uuid.uuid4().hex}",
        lastPulledAt=0,
        changes={
            "evidence": TableChanges(
                created=[
                    {
                        "id": ev_id,
                        "business_id": sync_business.id,
                        "evidence_type": "MARKET_PRICE",
                        # source_type omitted
                        "numeric_value": "200.0000",
                    }
                ],
                updated=[],
                deleted=[],
            )
        },
    )

    resp = process_sync_request(sync_req, db_session)
    assert resp.status == "success"
    created = db_session.get(Evidence, ev_id)
    assert created is not None
    assert created.source_type == "USER_ENTERED"


@pytest.mark.parametrize("spoofed_type", [
    "GOVERNMENT",
    "MARKET_PROVIDER",
    "MOCK_DEMO",
    "DERIVED",
    "PILOT_OBSERVED",
    "ESTIMATED",
    "LEGACY_UNKNOWN",
])
def test_client_spoofed_provenance_rejected(db_session, sync_business, spoofed_type):
    """17-20. Client spoofing trusted provenance is rejected with ValueError."""
    ev_id = uuid.uuid4().hex
    sync_req = SyncRequest(
        sync_request_id=f"test_sync_{uuid.uuid4().hex}",
        lastPulledAt=0,
        changes={
            "evidence": TableChanges(
                created=[
                    {
                        "id": ev_id,
                        "business_id": sync_business.id,
                        "evidence_type": "MARKET_PRICE",
                        "source_type": spoofed_type,
                        "numeric_value": "5000.0000",
                    }
                ],
                updated=[],
                deleted=[],
            )
        },
    )

    with pytest.raises(ValueError, match="non-user source_type"):
        process_sync_request(sync_req, db_session)


def test_client_update_user_entered_accepted(db_session, sync_business):
    """21. Client update USER_ENTERED with correct revision accepted."""
    ev = Evidence(
        business_id=sync_business.id,
        evidence_type="MARKET_PRICE",
        source_type="USER_ENTERED",
        numeric_value=Decimal("100.0000"),
    )
    db_session.add(ev)
    db_session.commit()
    db_session.refresh(ev)

    current_rev = ev.server_revision

    sync_req = SyncRequest(
        sync_request_id=f"test_sync_{uuid.uuid4().hex}",
        lastPulledAt=0,
        changes={
            "evidence": TableChanges(
                created=[],
                updated=[
                    {
                        "id": ev.id,
                        "base_server_revision": current_rev,
                        "numeric_value": "120.0000",
                    }
                ],
                deleted=[],
            )
        },
    )

    resp = process_sync_request(sync_req, db_session)
    assert resp.status == "success"
    assert len(resp.conflicts) == 0
    updated_ev = db_session.get(Evidence, ev.id)
    assert updated_ev.numeric_value == Decimal("120.0000")


def test_provider_evidence_update_from_client_rejected(db_session, sync_business):
    """22. Provider Evidence update from client rejected."""
    ev = Evidence(
        business_id=sync_business.id,
        evidence_type="MARKET_PRICE",
        source_type="MOCK_DEMO",
        provider_id="MOCK_AGMARKNET_PROVIDER",
        numeric_value=Decimal("2200.0000"),
    )
    db_session.add(ev)
    db_session.commit()
    db_session.refresh(ev)

    sync_req = SyncRequest(
        sync_request_id=f"test_sync_{uuid.uuid4().hex}",
        lastPulledAt=0,
        changes={
            "evidence": TableChanges(
                created=[],
                updated=[
                    {
                        "id": ev.id,
                        "sync_revision": ev.server_revision,
                        "numeric_value": "9999.0000",
                    }
                ],
                deleted=[],
            )
        },
    )

    with pytest.raises(ValueError, match="cannot mutate"):
        process_sync_request(sync_req, db_session)


def test_provider_evidence_delete_from_client_rejected(db_session, sync_business):
    """23. Provider Evidence delete from client rejected."""
    ev = Evidence(
        business_id=sync_business.id,
        evidence_type="MARKET_PRICE",
        source_type="GOVERNMENT",
        provider_id="LIVE_AGMARKNET_PROVIDER",
        numeric_value=Decimal("3000.0000"),
    )
    db_session.add(ev)
    db_session.commit()
    db_session.refresh(ev)

    sync_req = SyncRequest(
        sync_request_id=f"test_sync_{uuid.uuid4().hex}",
        lastPulledAt=0,
        changes={
            "evidence": TableChanges(
                created=[],
                updated=[],
                deleted=[ev.id],
            )
        },
    )

    with pytest.raises(ValueError, match="cannot delete"):
        process_sync_request(sync_req, db_session)
