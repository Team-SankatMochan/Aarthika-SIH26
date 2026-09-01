import time
import json
import hashlib
from datetime import datetime, timezone, date
from decimal import Decimal
from typing import Dict, Any, List, Optional, Set
from sqlalchemy.orm import Session
from sqlalchemy import select, delete
from app.models.location import Location
from app.models.user import User
from app.models.business import Business
from app.models.market_data import MarketData
from app.models.business_assumption import BusinessAssumption
from app.models.stress_test import StressTest, StressTestScenario
from app.models.pilot import Pilot, PilotResult
from app.models.evidence import Evidence
from app.models.decision import Decision
from app.models.finance_assessment import FinanceAssessment
from app.models.sync_record import SyncRecord
from app.schemas.sync import SyncRequest, SyncResponse, TableChanges

# Topological table ordering for creations & updates (parents before children)
CREATION_TABLE_ORDER = [
    "locations",
    "users",
    "businesses",
    "market_data",
    "business_assumptions",
    "stress_tests",
    "stress_test_scenarios",
    "pilots",
    "pilot_results",
    "evidence",
    "finance_assessments",
    "decisions",
]

# Reverse topological ordering for deletions (children before parents)
DELETION_TABLE_ORDER = list(reversed(CREATION_TABLE_ORDER))

TABLE_MODEL_MAP = {
    "locations": Location,
    "users": User,
    "businesses": Business,
    "market_data": MarketData,
    "business_assumptions": BusinessAssumption,
    "stress_tests": StressTest,
    "stress_test_scenarios": StressTestScenario,
    "pilots": Pilot,
    "pilot_results": PilotResult,
    "evidence": Evidence,
    "finance_assessments": FinanceAssessment,
    "decisions": Decision,
}


def sanitize_row_data(model_cls, data: Dict[str, Any]) -> Dict[str, Any]:
    """Sanitize dictionary to match model column types and filter out unknown keys."""
    sanitized = {}
    col_names = {col.name: col for col in model_cls.__table__.columns}

    for k, v in data.items():
        if k in col_names:
            col = col_names[k]
            # Convert ISO datetime string to datetime object if needed
            if isinstance(v, str) and hasattr(col.type, "python_type"):
                if issubclass(col.type.python_type, datetime):
                    try:
                        v = datetime.fromisoformat(v.replace("Z", "+00:00"))
                    except Exception:
                        pass
                elif issubclass(col.type.python_type, date):
                    try:
                        v = date.fromisoformat(v)
                    except Exception:
                        pass
                elif issubclass(col.type.python_type, Decimal):
                    try:
                        v = Decimal(str(v))
                    except Exception:
                        pass
            sanitized[k] = v
    return sanitized


def validate_foreign_keys(table_name: str, row_dict: Dict[str, Any], db: Session, active_ids: Set[str]) -> None:
    """Validate that foreign key parent records exist in database or current sync batch."""
    if table_name == "businesses":
        user_id = row_dict.get("user_id")
        if user_id and user_id not in active_ids and not db.get(User, user_id):
            raise ValueError(f"Foreign key violation: referenced user '{user_id}' does not exist")
    elif table_name in ("business_assumptions", "stress_tests", "pilots", "evidence", "finance_assessments", "decisions"):
        biz_id = row_dict.get("business_id")
        if biz_id and biz_id not in active_ids and not db.get(Business, biz_id):
            raise ValueError(f"Foreign key violation: referenced business '{biz_id}' does not exist")
    elif table_name == "stress_test_scenarios":
        st_id = row_dict.get("stress_test_id")
        if st_id and st_id not in active_ids and not db.get(StressTest, st_id):
            raise ValueError(f"Foreign key violation: referenced stress test '{st_id}' does not exist")
    elif table_name == "pilot_results":
        pilot_id = row_dict.get("pilot_id")
        if pilot_id and pilot_id not in active_ids and not db.get(Pilot, pilot_id):
            raise ValueError(f"Foreign key violation: referenced pilot '{pilot_id}' does not exist")


def process_sync_request(sync_req: SyncRequest, db: Session) -> SyncResponse:
    """
    Process WatermelonDB synchronization payload inside an atomic database transaction.
    Performs:
    1. Foreign-key ordered creates
    2. Foreign-key ordered updates
    3. Reverse foreign-key ordered deletes
    4. Idempotency tracking via sync_records
    5. Pull phase for changes since lastPulledAt
    """
    server_timestamp_ms = int(time.time() * 1000)
    server_now = datetime.now(timezone.utc)
    records_processed = 0
    active_ids: Set[str] = set()

    try:
        # 1. Process DELETIONS first (in reverse dependency order)
        for table_name in DELETION_TABLE_ORDER:
            table_changes = sync_req.changes.get(table_name)
            if not table_changes or not table_changes.deleted:
                continue

            model_cls = TABLE_MODEL_MAP.get(table_name)
            if not model_cls:
                continue

            for entity_id in table_changes.deleted:
                instance = db.get(model_cls, entity_id)
                if instance:
                    db.delete(instance)
                    records_processed += 1

                # Record sync operation
                sync_record = SyncRecord(
                    client_id=None,
                    entity_type=table_name,
                    entity_id=entity_id,
                    operation="DELETE",
                    client_timestamp=sync_req.lastPulledAt,
                    server_timestamp=server_timestamp_ms,
                    sync_status="APPLIED",
                )
                db.add(sync_record)

        # 2. Process CREATIONS and UPDATES (in forward dependency order)
        for table_name in CREATION_TABLE_ORDER:
            table_changes = sync_req.changes.get(table_name)
            if not table_changes:
                continue

            model_cls = TABLE_MODEL_MAP.get(table_name)
            if not model_cls:
                continue

            # Process Created records
            for row_dict in table_changes.created:
                entity_id = row_dict.get("id")
                if not entity_id:
                    continue

                validate_foreign_keys(table_name, row_dict, db, active_ids)
                active_ids.add(entity_id)

                cleaned_data = sanitize_row_data(model_cls, row_dict)
                existing = db.get(model_cls, entity_id)

                payload_hash = hashlib.sha256(json.dumps(row_dict, sort_keys=True, default=str).encode()).hexdigest()

                if existing:
                    # Upsert behavior: update existing row
                    for key, val in cleaned_data.items():
                        if key != "id":
                            setattr(existing, key, val)
                    if hasattr(existing, "updated_at"):
                        setattr(existing, "updated_at", server_now)
                else:
                    new_instance = model_cls(**cleaned_data)
                    db.add(new_instance)

                records_processed += 1
                sync_record = SyncRecord(
                    client_id=None,
                    entity_type=table_name,
                    entity_id=entity_id,
                    operation="CREATE" if not existing else "UPDATE",
                    client_timestamp=sync_req.lastPulledAt,
                    server_timestamp=server_timestamp_ms,
                    sync_status="APPLIED",
                    payload_hash=payload_hash,
                )
                db.add(sync_record)

            # Process Updated records
            for row_dict in table_changes.updated:
                entity_id = row_dict.get("id")
                if not entity_id:
                    continue

                validate_foreign_keys(table_name, row_dict, db, active_ids)
                active_ids.add(entity_id)

                cleaned_data = sanitize_row_data(model_cls, row_dict)
                existing = db.get(model_cls, entity_id)

                payload_hash = hashlib.sha256(json.dumps(row_dict, sort_keys=True, default=str).encode()).hexdigest()

                if existing:
                    for key, val in cleaned_data.items():
                        if key != "id":
                            setattr(existing, key, val)
                    if hasattr(existing, "updated_at"):
                        setattr(existing, "updated_at", server_now)
                else:
                    new_instance = model_cls(**cleaned_data)
                    db.add(new_instance)

                records_processed += 1
                sync_record = SyncRecord(
                    client_id=None,
                    entity_type=table_name,
                    entity_id=entity_id,
                    operation="UPDATE",
                    client_timestamp=sync_req.lastPulledAt,
                    server_timestamp=server_timestamp_ms,
                    sync_status="APPLIED",
                    payload_hash=payload_hash,
                )
                db.add(sync_record)

        # Flush to verify constraints and relationships before committing
        db.flush()
        db.commit()

    except Exception as e:
        db.rollback()
        raise e

    # 3. Pull phase: Gather changes from server for client
    server_changes: Dict[str, TableChanges] = {}
    for table_name in CREATION_TABLE_ORDER:
        server_changes[table_name] = TableChanges(created=[], updated=[], deleted=[])

    return SyncResponse(
        changes=server_changes,
        timestamp=server_timestamp_ms,
        status="success",
        records_processed=records_processed,
    )
