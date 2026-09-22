import pytest
from decimal import Decimal
from sqlalchemy import select
from app.models.location import Location
from app.models.user import User
from app.models.business import Business
from app.models.finance_assessment import FinanceAssessment
from app.models.scheme import Scheme
from app.models.sync_changes import SyncRequestRecord, SyncChange
from app.schemas.sync import SyncRequest, TableChanges
from app.services.sync_service import process_sync_request

def test_sync_bootstrap_with_existing_rows(db_session):
    # Setup some existing rows
    loc = Location(id="loc_pre_1", state="MH", district="Pune", village_or_city="Pune")
    db_session.add(loc)
    db_session.commit()
    
    # Client pulls with lastPulledAt = 0
    sync_req = SyncRequest(sync_request_id="req_boot_1", changes={}, lastPulledAt=0)
    response = process_sync_request(sync_req, db_session)
    
    assert response.status == "success"
    assert response.timestamp > 0
    
    loc_created = response.changes["locations"].created
    assert len(loc_created) >= 1
    assert any(l["id"] == "loc_pre_1" for l in loc_created)
    assert "sync_revision" in loc_created[0]

def test_sync_push_idempotency(db_session):
    sync_req = SyncRequest(
        sync_request_id="req_idemp_1",
        changes={
            "users": TableChanges(
                created=[{"id": "user_idemp_1", "name": "Test User", "available_capital": 50000}]
            )
        }
    )
    # First sync
    res1 = process_sync_request(sync_req, db_session)
    assert res1.status == "success"
    user_count_1 = len(db_session.scalars(select(User)).all())
    
    # Second sync (same request ID)
    res2 = process_sync_request(sync_req, db_session)
    assert res2.status == "success"
    user_count_2 = len(db_session.scalars(select(User)).all())
    assert user_count_1 == user_count_2

def test_sync_server_owned_reject(db_session):
    sync_req = SyncRequest(
        sync_request_id="req_rej_1",
        changes={
            "locations": TableChanges(created=[{"id": "loc_rej_1", "state": "MH", "district": "Pune", "village_or_city": "Pune"}])
        }
    )
    with pytest.raises(ValueError, match="Unauthorized CREATE on locations"):
        process_sync_request(sync_req, db_session)

def test_sync_optimistic_concurrency_conflict(db_session):
    # 1. Server creates a user (sync revision gets generated)
    u = User(id="user_conf_1", name="Original")
    db_session.add(u)
    db_session.commit()
    db_session.refresh(u)
    server_rev = getattr(u, 'server_revision', 1)
    
    # 2. Client tries to update with a stale revision
    sync_req = SyncRequest(
        sync_request_id="req_conf_1",
        changes={
            "users": TableChanges(updated=[{"id": "user_conf_1", "name": "Hacked", "sync_revision": server_rev - 1}])
        }
    )
    response = process_sync_request(sync_req, db_session)
    
    # Must contain conflict
    assert len(response.conflicts) == 1
    conflict = response.conflicts[0]
    assert conflict.table == "users"
    assert conflict.record_id == "user_conf_1"
    
    # DB must not be modified
    db_session.refresh(u)
    assert u.name == "Original"

def test_sync_update_and_delete_coalescing(db_session):
    # This just ensures we can parse and write sync changes cleanly
    u = User(id="user_ud_1", name="Delete Me")
    db_session.add(u)
    db_session.commit()
    
    # Delete via backend ORM should trigger a DELETE in sync_changes
    db_session.delete(u)
    db_session.commit()
    
    stmt = select(SyncChange).where(SyncChange.record_id == "user_ud_1", SyncChange.operation == "DELETE")
    change = db_session.execute(stmt).scalar_one_or_none()
    assert change is not None
