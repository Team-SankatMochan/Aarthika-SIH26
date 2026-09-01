from decimal import Decimal
import pytest
from sqlalchemy import select
from app.models.location import Location
from app.models.user import User
from app.models.business import Business
from app.models.business_assumption import BusinessAssumption
from app.models.sync_record import SyncRecord
from app.schemas.sync import SyncRequest, TableChanges
from app.services.sync_service import process_sync_request


def test_sync_batch_creation(db_session):
    """Test creating hierarchical entities via /sync endpoint."""
    sync_req = SyncRequest(
        changes={
            "locations": TableChanges(
                created=[
                    {
                        "id": "loc_sync_1",
                        "state": "Maharashtra",
                        "district": "Latur",
                        "village_or_city": "Ausa",
                    }
                ]
            ),
            "users": TableChanges(
                created=[
                    {
                        "id": "user_sync_1",
                        "name": "Anil Deshmukh",
                        "location_id": "loc_sync_1",
                        "available_capital": 50000,
                    }
                ]
            ),
            "businesses": TableChanges(
                created=[
                    {
                        "id": "biz_sync_1",
                        "user_id": "user_sync_1",
                        "location_id": "loc_sync_1",
                        "business_name": "Latur Organic Dairy",
                        "business_category": "Dairy",
                    }
                ]
            ),
            "business_assumptions": TableChanges(
                created=[
                    {
                        "id": "asmp_sync_1",
                        "business_id": "biz_sync_1",
                        "expected_customers": 40,
                        "selling_price": 60.0,
                        "production_volume": 120.0,
                        "raw_material_cost": 36.0,
                    }
                ]
            ),
        },
        lastPulledAt=None,
    )

    response = process_sync_request(sync_req, db_session)
    assert response.status == "success"
    assert response.records_processed >= 4

    # Verify rows in database
    loc = db_session.get(Location, "loc_sync_1")
    assert loc is not None
    assert loc.district == "Latur"

    user = db_session.get(User, "user_sync_1")
    assert user is not None
    assert user.name == "Anil Deshmukh"

    biz = db_session.get(Business, "biz_sync_1")
    assert biz is not None
    assert biz.business_name == "Latur Organic Dairy"

    asmp = db_session.get(BusinessAssumption, "asmp_sync_1")
    assert asmp is not None
    assert asmp.expected_customers == 40


def test_sync_idempotency_duplicate_submission(db_session):
    """
    Test submitting the exact same sync payload twice produces
    zero duplicate rows and maintains consistency.
    """
    sync_req = SyncRequest(
        changes={
            "locations": TableChanges(
                created=[
                    {
                        "id": "loc_idemp_1",
                        "state": "Maharashtra",
                        "district": "Pune",
                        "village_or_city": "Baramati",
                    }
                ]
            ),
            "users": TableChanges(
                created=[
                    {
                        "id": "user_idemp_1",
                        "name": "Priya Pawar",
                        "location_id": "loc_idemp_1",
                        "available_capital": 30000,
                    }
                ]
            ),
        }
    )

    # First sync
    res1 = process_sync_request(sync_req, db_session)
    assert res1.status == "success"

    # Count rows
    user_count_1 = len(db_session.scalars(select(User)).all())
    assert user_count_1 == 1

    # Second sync with identical payload
    res2 = process_sync_request(sync_req, db_session)
    assert res2.status == "success"

    user_count_2 = len(db_session.scalars(select(User)).all())
    # No duplicate row created
    assert user_count_2 == 1


def test_sync_update_and_delete(db_session):
    """Test updates and deletions via sync protocol."""
    # 1. Create location and user
    sync_init = SyncRequest(
        changes={
            "locations": TableChanges(
                created=[
                    {"id": "loc_ud_1", "state": "Maharashtra", "district": "Latur", "village_or_city": "Udgir"}
                ]
            ),
            "users": TableChanges(
                created=[
                    {"id": "user_ud_1", "name": "Vikas Jadhav", "location_id": "loc_ud_1", "available_capital": 10000}
                ]
            ),
        }
    )
    process_sync_request(sync_init, db_session)

    # 2. Update user name and delete location/user in next sync
    sync_update = SyncRequest(
        changes={
            "users": TableChanges(
                updated=[
                    {"id": "user_ud_1", "name": "Vikas S. Jadhav", "available_capital": 25000}
                ]
            )
        }
    )
    process_sync_request(sync_update, db_session)

    updated_user = db_session.get(User, "user_ud_1")
    assert updated_user.name == "Vikas S. Jadhav"
    assert updated_user.available_capital == Decimal("25000.00")

    # 3. Delete user
    sync_delete = SyncRequest(
        changes={
            "users": TableChanges(
                deleted=["user_ud_1"]
            )
        }
    )
    process_sync_request(sync_delete, db_session)
    assert db_session.get(User, "user_ud_1") is None


def test_sync_transaction_rollback_on_error(db_session):
    """Test that a failing constraint or invalid foreign key triggers full rollback."""
    # Business referencing non-existent user should fail FK constraint
    sync_bad = SyncRequest(
        changes={
            "businesses": TableChanges(
                created=[
                    {
                        "id": "biz_orphan_1",
                        "user_id": "non_existent_user_999",
                        "business_name": "Ghost Enterprise",
                        "business_category": "Retail",
                    }
                ]
            )
        }
    )

    with pytest.raises(Exception):
        process_sync_request(sync_bad, db_session)

    # Ensure nothing was committed
    assert db_session.get(Business, "biz_orphan_1") is None
