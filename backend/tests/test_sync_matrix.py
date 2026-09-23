import pytest
from decimal import Decimal
from sqlalchemy import select, text
import uuid
import time
from app.models.location import Location
from app.models.user import User
from app.models.business import Business
from app.models.finance_assessment import FinanceAssessment
from app.models.scheme import Scheme
from app.models.sync_changes import SyncRequestRecord, SyncChange
from app.schemas.sync import SyncRequest, TableChanges
from app.services.sync_service import process_sync_request, get_current_upper_bound

def mock_uuid():
    return str(uuid.uuid4())

# Case 1: bootstrap sync with existing rows
def test_sync_matrix_01_bootstrap(db_session):
    loc = Location(id=mock_uuid(), state="MH", district="Pune", village_or_city="Pune")
    db_session.add(loc)
    db_session.commit()
    db_session.refresh(loc)
    
    sync_req = SyncRequest(sync_request_id=mock_uuid(), changes={}, lastPulledAt=0)
    response = process_sync_request(sync_req, db_session)
    
    assert response.status == "success"
    assert response.timestamp > 0
    
    loc_created = response.changes["locations"].created
    assert len(loc_created) >= 1
    assert any(l["id"] == loc.id for l in loc_created)
    assert "sync_revision" in loc_created[0]

# Case 2: no-op second pull
def test_sync_matrix_02_noop_pull(db_session):
    upper = get_current_upper_bound(db_session)
    sync_req = SyncRequest(sync_request_id=mock_uuid(), changes={}, lastPulledAt=upper)
    response = process_sync_request(sync_req, db_session)
    assert sum(len(c.created) + len(c.updated) + len(c.deleted) for c in response.changes.values()) == 0

# Case 3: server-created row pulled
def test_sync_matrix_03_server_created_pull(db_session):
    upper1 = get_current_upper_bound(db_session)
    loc = Location(id=mock_uuid(), state="MH", district="Pune", village_or_city="Pune")
    db_session.add(loc)
    db_session.commit()
    
    sync_req = SyncRequest(sync_request_id=mock_uuid(), changes={}, lastPulledAt=upper1)
    response = process_sync_request(sync_req, db_session)
    assert any(l["id"] == loc.id for l in response.changes["locations"].created)

# Case 4: server-updated row pulled
def test_sync_matrix_04_server_updated_pull(db_session):
    loc = Location(id=mock_uuid(), state="MH", district="Pune", village_or_city="Pune")
    db_session.add(loc)
    db_session.commit()
    upper1 = get_current_upper_bound(db_session)
    
    loc.district = "Pune"
    db_session.commit()
    
    sync_req = SyncRequest(sync_request_id=mock_uuid(), changes={}, lastPulledAt=upper1)
    response = process_sync_request(sync_req, db_session)
    assert any(l["id"] == loc.id for l in response.changes["locations"].updated)

# Case 5: server-deleted row pulled
def test_sync_matrix_05_server_deleted_pull(db_session):
    loc = Location(id=mock_uuid(), state="MH", district="Pune", village_or_city="Pune")
    db_session.add(loc)
    db_session.commit()
    upper1 = get_current_upper_bound(db_session)
    
    db_session.delete(loc)
    db_session.commit()
    
    sync_req = SyncRequest(sync_request_id=mock_uuid(), changes={}, lastPulledAt=upper1)
    response = process_sync_request(sync_req, db_session)
    assert loc.id in response.changes["locations"].deleted

# Case 6: client-created offline row pushed
def test_sync_matrix_06_client_create_push(db_session):
    uid = mock_uuid()
    sync_req = SyncRequest(
        sync_request_id=mock_uuid(),
        changes={"users": TableChanges(created=[{"id": uid, "name": "Offline User"}])}
    )
    process_sync_request(sync_req, db_session)
    assert db_session.get(User, uid) is not None

# Case 7, 8, 3rd check: client update with correct base revision, strict equality semantics
def test_sync_matrix_07_08_optimistic_concurrency_strict_equality(db_session):
    u = User(id=mock_uuid(), name="Base")
    db_session.add(u)
    db_session.commit()
    db_session.refresh(u)
    server_rev = getattr(u, 'server_revision', 1)
    
    # base < current -> Conflict
    sync_req1 = SyncRequest(
        sync_request_id=mock_uuid(),
        changes={"users": TableChanges(updated=[{"id": u.id, "name": "Stale", "base_server_revision": server_rev - 1}])}
    )
    res1 = process_sync_request(sync_req1, db_session)
    assert len(res1.conflicts) == 1
    
    # base > current -> Conflict (Client shouldn't have a future revision)
    sync_req2 = SyncRequest(
        sync_request_id=mock_uuid(),
        changes={"users": TableChanges(updated=[{"id": u.id, "name": "Future", "base_server_revision": server_rev + 1}])}
    )
    res2 = process_sync_request(sync_req2, db_session)
    assert len(res2.conflicts) == 1
    
    # base == current -> Success
    sync_req3 = SyncRequest(
        sync_request_id=mock_uuid(),
        changes={"users": TableChanges(updated=[{"id": u.id, "name": "Success", "base_server_revision": server_rev}])}
    )
    res3 = process_sync_request(sync_req3, db_session)
    assert len(res3.conflicts) == 0
    db_session.refresh(u)
    assert u.name == "Success"

# Cases 9, 10, 11: server-owned rejection + atomicity
def test_sync_matrix_09_10_11_server_owned_reject_atomic(db_session):
    # Attempting to CREATE a server-owned location alongside a valid User CREATE
    uid = mock_uuid()
    sync_req = SyncRequest(
        sync_request_id=mock_uuid(),
        changes={
            "users": TableChanges(created=[{"id": uid, "name": "Valid"}]),
            "locations": TableChanges(created=[{"id": mock_uuid(), "state": "MH"}])
        }
    )
    with pytest.raises(ValueError, match="Unauthorized CREATE on locations"):
        process_sync_request(sync_req, db_session)
        
    # Verify atomicity (user was NOT created because transaction rolled back)
    assert db_session.get(User, uid) is None

# Cases 12, 13, 14: append-only
def test_sync_matrix_12_13_14_append_only(db_session):
    if db_session.bind.dialect.name == 'sqlite':
        db_session.execute(text("PRAGMA foreign_keys=OFF;"))
        db_session.commit()
    aid = mock_uuid()
    fa_mock = {
        "id": aid,
        "business_id": mock_uuid(),
        "project_cost": 50000,
        "margin_contribution": 10000,
        "maximum_loan": 40000,
        "recommended_loan": 40000,
        "annual_interest_rate": 8.5,
        "total_tenure_months": 60,
        "moratorium_months": 6,
        "active_repayment_months": 54,
        "capitalized_principal": 41000,
        "emi": 900,
        "total_interest": 7000,
        "debt_affordability_status": "AFFORDABLE",
        "debt_service_burden": 20,
        "working_capital_requirement": 0
    }
    # 12. CREATE accepted
    sync_req1 = SyncRequest(
        sync_request_id=mock_uuid(),
        changes={"finance_assessments": TableChanges(created=[fa_mock])}
    )
    process_sync_request(sync_req1, db_session)
    
    # 13. UPDATE rejected
    sync_req2 = SyncRequest(
        sync_request_id=mock_uuid(),
        changes={"finance_assessments": TableChanges(updated=[fa_mock])}
    )
    with pytest.raises(ValueError, match="Unauthorized UPDATE"):
        process_sync_request(sync_req2, db_session)
        
    # 14. DELETE rejected
    sync_req3 = SyncRequest(
        sync_request_id=mock_uuid(),
        changes={"finance_assessments": TableChanges(deleted=[aid])}
    )
    with pytest.raises(ValueError, match="Unauthorized DELETE"):
        process_sync_request(sync_req3, db_session)

# Case 15 & 8: duplicate successful sync_request_id retry & idempotency failure handling
def test_sync_matrix_15_idempotency_retry(db_session):
    req_id = mock_uuid()
    uid = mock_uuid()
    
    sync_req = SyncRequest(
        sync_request_id=req_id,
        changes={"users": TableChanges(created=[{"id": uid, "name": "A"}])}
    )
    process_sync_request(sync_req, db_session)
    
    u_count1 = len(db_session.scalars(select(User).where(User.id == uid)).all())
    assert u_count1 == 1
    
    # Retry exactly same
    process_sync_request(sync_req, db_session)
    u_count2 = len(db_session.scalars(select(User).where(User.id == uid)).all())
    assert u_count2 == 1

# Case 19: CREATE -> UPDATE coalesce
def test_sync_matrix_19_create_update_coalesce(db_session):
    upper1 = get_current_upper_bound(db_session)
    u = User(id=mock_uuid(), name="V1")
    db_session.add(u)
    db_session.commit()
    u.name = "V2"
    db_session.commit()
    
    sync_req = SyncRequest(sync_request_id=mock_uuid(), changes={}, lastPulledAt=upper1)
    res = process_sync_request(sync_req, db_session)
    
    # Should only appear in created, with V2
    assert any(x["id"] == u.id and x["name"] == "V2" for x in res.changes["users"].created)
    assert not any(x["id"] == u.id for x in res.changes["users"].updated)

# Case 20: UPDATE -> UPDATE coalesce
def test_sync_matrix_20_update_update_coalesce(db_session):
    u = User(id=mock_uuid(), name="V1")
    db_session.add(u)
    db_session.commit()
    upper1 = get_current_upper_bound(db_session)
    
    u.name = "V2"
    db_session.commit()
    u.name = "V3"
    db_session.commit()
    
    sync_req = SyncRequest(sync_request_id=mock_uuid(), changes={}, lastPulledAt=upper1)
    res = process_sync_request(sync_req, db_session)
    
    assert any(x["id"] == u.id and x["name"] == "V3" for x in res.changes["users"].updated)

# Case 21: UPDATE -> DELETE coalesce
def test_sync_matrix_21_update_delete_coalesce(db_session):
    u = User(id=mock_uuid(), name="V1")
    db_session.add(u)
    db_session.commit()
    upper1 = get_current_upper_bound(db_session)
    
    u.name = "V2"
    db_session.commit()
    db_session.delete(u)
    db_session.commit()
    
    sync_req = SyncRequest(sync_request_id=mock_uuid(), changes={}, lastPulledAt=upper1)
    res = process_sync_request(sync_req, db_session)
    
    assert u.id in res.changes["users"].deleted
    assert not any(x["id"] == u.id for x in res.changes["users"].updated)

# Case 22: CREATE -> DELETE coalesce
def test_sync_matrix_22_create_delete_coalesce(db_session):
    upper1 = get_current_upper_bound(db_session)
    u = User(id=mock_uuid(), name="V1")
    db_session.add(u)
    db_session.commit()
    db_session.delete(u)
    db_session.commit()
    
    sync_req = SyncRequest(sync_request_id=mock_uuid(), changes={}, lastPulledAt=upper1)
    res = process_sync_request(sync_req, db_session)
    
    assert not any(x["id"] == u.id for x in res.changes["users"].created)
    assert u.id not in res.changes["users"].deleted

# Case 6 & 7: Verify Delete Log Correctness
def test_sync_delete_log_correctness(db_session):
    u = User(id=mock_uuid(), name="V1")
    db_session.add(u)
    db_session.commit()
    
    db_session.delete(u)
    db_session.commit()
    
    stmt = select(SyncChange).where(SyncChange.record_id == u.id, SyncChange.operation == "DELETE")
    log = db_session.execute(stmt).scalar_one_or_none()
    assert log is not None
    assert log.table_name == "users"

# Transaction atomicity verification
def test_sync_change_log_atomicity(db_session):
    uid = mock_uuid()
    try:
        with db_session.begin_nested():
            u = User(id=uid, name="V1")
            db_session.add(u)
            db_session.flush() # Flushes triggers
            raise Exception("Force rollback")
    except Exception:
        pass
        
    assert db_session.get(User, uid) is None
    stmt = select(SyncChange).where(SyncChange.record_id == uid)
    assert db_session.execute(stmt).scalar_one_or_none() is None
