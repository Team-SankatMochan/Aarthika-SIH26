import time
import json
import logging
import hashlib
from datetime import datetime, timezone, date
from decimal import Decimal
from typing import Dict, Any, List, Optional, Set
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError

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
from app.models.scheme import Scheme, SchemeRule
from app.models.sync_changes import SyncChange, SyncRequestRecord
from app.db.base import global_sync_sequence
from app.schemas.sync import SyncRequest, SyncResponse, TableChanges, SyncConflict

logger = logging.getLogger(__name__)

# Topological table ordering
CREATION_TABLE_ORDER = [
    "users",
    "locations",
    "schemes",
    "scheme_rules",
    "market_data",
    "businesses",
    "business_assumptions",
    "evidence",
    "stress_tests",
    "stress_test_scenarios",
    "pilots",
    "pilot_results",
    "finance_assessments",
    "decisions",
]
DELETION_TABLE_ORDER = list(reversed(CREATION_TABLE_ORDER))

TABLE_MODEL_MAP = {
    "users": User,
    "locations": Location,
    "schemes": Scheme,
    "scheme_rules": SchemeRule,
    "market_data": MarketData,
    "businesses": Business,
    "business_assumptions": BusinessAssumption,
    "evidence": Evidence,
    "stress_tests": StressTest,
    "stress_test_scenarios": StressTestScenario,
    "pilots": Pilot,
    "pilot_results": PilotResult,
    "finance_assessments": FinanceAssessment,
    "decisions": Decision,
}

SERVER_OWNED = {"locations", "schemes", "scheme_rules", "market_data"}
APPEND_ONLY = {"finance_assessments", "stress_tests", "stress_test_scenarios", "pilot_results"}


def sanitize_row_data(model_cls, data: Dict[str, Any]) -> Dict[str, Any]:
    sanitized = {}
    col_names = {col.name: col for col in model_cls.__table__.columns}
    for k, v in data.items():
        if k in col_names and k not in ('server_revision', 'sync_revision', 'base_server_revision'):
            col = col_names[k]
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


def get_current_upper_bound(db: Session) -> int:
    if db.bind.dialect.name == 'sqlite':
        from app.db.events import _sqlite_seq
        return _sqlite_seq
    val = db.scalar(global_sync_sequence.next_value())
    return val


def compute_payload_hash(sync_req: SyncRequest) -> Optional[str]:
    # Custom serialization for TableChanges objects
    changes_dict = {}
    for table_name, table_changes in sync_req.changes.items():
        # Exclude empty changes entirely
        if table_changes.created or table_changes.updated or table_changes.deleted:
            changes_dict[table_name] = table_changes.model_dump(exclude_unset=True)
            
    if not changes_dict:
        return None
        
    serialized = json.dumps(changes_dict, sort_keys=True)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def process_sync_request(sync_req: SyncRequest, db: Session) -> SyncResponse:
    payload_hash = compute_payload_hash(sync_req)
    
    # 1. Check Idempotency
    existing_request = db.get(SyncRequestRecord, sync_req.sync_request_id)
    records_processed = 0
    conflicts: List[SyncConflict] = []
    skip_mutations = False
    
    if payload_hash is None:
        # PULL ONLY
        skip_mutations = True
    else:
        # PUSH Phase
        if existing_request:
            if existing_request.status == "SUCCESS":
                if existing_request.payload_hash != payload_hash:
                    raise ValueError(f"Sync request ID {sync_req.sync_request_id} reused with different payload.")
                # Idempotent retry: do not re-apply
                skip_mutations = True
            else:
                # Failed/Pending with same or different hash? If it failed, let's just retry.
                pass
        else:
            # Create idempotency record
            existing_request = SyncRequestRecord(
                sync_request_id=sync_req.sync_request_id,
                status="PENDING",
                payload_hash=payload_hash
            )
            db.add(existing_request)
            db.commit() # Save pending record so we have it
            
    if not skip_mutations:
        active_ids: Set[str] = set()
        req_record = db.get(SyncRequestRecord, sync_req.sync_request_id)

        try:
            # 1. Deletions
            for table_name in DELETION_TABLE_ORDER:
                table_changes = sync_req.changes.get(table_name)
                if not table_changes or not table_changes.deleted: continue
                if table_name in SERVER_OWNED or table_name in APPEND_ONLY:
                    raise ValueError(f"Unauthorized DELETE on {table_name}")
                    
                model_cls = TABLE_MODEL_MAP.get(table_name)
                for entity_id in table_changes.deleted:
                    instance = db.get(model_cls, entity_id)
                    if instance:
                        if table_name == "evidence":
                            source_type = getattr(instance, "source_type", None)
                            if source_type != "USER_ENTERED":
                                raise ValueError(
                                    f"Unauthorized DELETE on evidence {entity_id}: client cannot delete "
                                    f"evidence with source_type '{source_type}'"
                                )
                        db.delete(instance)
                        records_processed += 1

            # 2. Creations
            for table_name in CREATION_TABLE_ORDER:
                table_changes = sync_req.changes.get(table_name)
                if not table_changes or not table_changes.created: continue
                if table_name in SERVER_OWNED:
                    raise ValueError(f"Unauthorized CREATE on {table_name}")
                
                model_cls = TABLE_MODEL_MAP.get(table_name)
                for row_dict in table_changes.created:
                    entity_id = row_dict.get("id")
                    if not entity_id: continue
                    active_ids.add(entity_id)

                    if table_name == "evidence":
                        client_st = row_dict.get("source_type")
                        if client_st is not None and client_st != "" and client_st != "USER_ENTERED":
                            raise ValueError(
                                f"Client cannot create evidence with non-user source_type '{client_st}'."
                            )
                        row_dict["source_type"] = "USER_ENTERED"

                    existing = db.get(model_cls, entity_id)
                    if existing:
                        # Append only - idempotent ignore if exists
                        if table_name in APPEND_ONLY:
                            continue
                        if table_name == "evidence":
                            source_type = getattr(existing, "source_type", None)
                            if source_type != "USER_ENTERED":
                                raise ValueError(f"Unauthorized UPDATE on evidence {entity_id}")
                        cleaned_data = sanitize_row_data(model_cls, row_dict)
                        for key, val in cleaned_data.items():
                            if key != "id":
                                setattr(existing, key, val)
                    else:
                        cleaned_data = sanitize_row_data(model_cls, row_dict)
                        new_instance = model_cls(**cleaned_data)
                        db.add(new_instance)
                    records_processed += 1

            # 3. Updates
            for table_name in CREATION_TABLE_ORDER:
                table_changes = sync_req.changes.get(table_name)
                if not table_changes or not table_changes.updated: continue
                if table_name in SERVER_OWNED or table_name in APPEND_ONLY:
                    raise ValueError(f"Unauthorized UPDATE on {table_name}")
                
                model_cls = TABLE_MODEL_MAP.get(table_name)
                for row_dict in table_changes.updated:
                    entity_id = row_dict.get("id")
                    if not entity_id: continue
                    active_ids.add(entity_id)
                    
                    existing = db.get(model_cls, entity_id)
                    if not existing:
                        # Convert to create if it doesn't exist
                        if table_name == "evidence":
                            client_st = row_dict.get("source_type")
                            if client_st is not None and client_st != "" and client_st != "USER_ENTERED":
                                raise ValueError(f"Client cannot create evidence with non-user source_type '{client_st}'.")
                            row_dict["source_type"] = "USER_ENTERED"
                        cleaned_data = sanitize_row_data(model_cls, row_dict)
                        new_instance = model_cls(**cleaned_data)
                        db.add(new_instance)
                        records_processed += 1
                        continue
                        
                    if table_name == "evidence":
                        source_type = getattr(existing, "source_type", None)
                        if source_type != "USER_ENTERED":
                            raise ValueError(f"Unauthorized UPDATE on evidence {entity_id}")
                        client_st = row_dict.get("source_type")
                        if client_st is not None and client_st != "" and client_st != "USER_ENTERED":
                            raise ValueError(f"Client cannot update evidence to non-user source_type '{client_st}'")
                        row_dict["source_type"] = "USER_ENTERED"

                    # Optimistic Concurrency Check
                    client_base = row_dict.get('base_server_revision', 0)
                    server_rev = getattr(existing, 'server_revision', 0)
                    if server_rev > 0 and client_base != server_rev:
                        # Conflict!
                        conflicts.append(SyncConflict(
                            table=table_name,
                            record_id=entity_id,
                            client_base_revision=client_base,
                            server_revision=server_rev,
                            server_record=existing.to_dict()
                        ))
                        continue
                        
                    cleaned_data = sanitize_row_data(model_cls, row_dict)
                    for key, val in cleaned_data.items():
                        if key != "id":
                            setattr(existing, key, val)
                    records_processed += 1

            if conflicts:
                # User correction #2: Conflict rolls back ENTIRE push transaction.
                db.rollback()
                records_processed = 0
                # Do not mark SUCCESS.
                # Re-fetch the record and mark FAILED? Wait, the transaction rollback just wiped out any pending changes
                # to the sync record if it was done in the same transaction. But I did db.commit() above for the PENDING state.
                # So we can just leave it as PENDING (or set to FAILED if we want to be explicit).
                req_record_again = db.get(SyncRequestRecord, sync_req.sync_request_id)
                if req_record_again:
                    req_record_again.status = "FAILED"
                    db.commit()
            else:
                # Complete transaction
                db.flush()
                req_record.status = "SUCCESS"
                req_record.completed_at = func.now()
                req_record.payload_hash = payload_hash
                db.commit()

        except Exception as e:
            db.rollback()
            req_record_again = db.get(SyncRequestRecord, sync_req.sync_request_id)
            if req_record_again:
                req_record_again.status = "FAILED"
                db.commit()
            raise e

    # PULL Phase
    last_pulled_at = sync_req.lastPulledAt or 0
    upper_bound = get_current_upper_bound(db)
    
    server_changes: Dict[str, TableChanges] = {}
    for table_name in CREATION_TABLE_ORDER:
        server_changes[table_name] = TableChanges(created=[], updated=[], deleted=[])
        
    if last_pulled_at == 0:
        # Bootstrap Sync
        for table_name in CREATION_TABLE_ORDER:
            model_cls = TABLE_MODEL_MAP.get(table_name)
            if not model_cls: continue
            rows = db.execute(select(model_cls)).scalars().all()
            for row in rows:
                d = row.to_dict()
                d['sync_revision'] = getattr(row, 'server_revision', 0)
                server_changes[table_name].created.append(d)
    else:
        # Incremental Sync using sync_changes
        stmt = select(SyncChange).where(
            SyncChange.sequence > last_pulled_at,
            SyncChange.sequence <= upper_bound
        ).order_by(SyncChange.sequence)
        
        changes_list = db.execute(stmt).scalars().all()
        
        # Coalescing map: table -> record_id -> (operation, obj)
        coalesced = {}
        for ch in changes_list:
            if ch.table_name not in coalesced:
                coalesced[ch.table_name] = {}
                
            model_cls = TABLE_MODEL_MAP.get(ch.table_name)
            
            if ch.operation == "DELETE":
                prev_op = coalesced[ch.table_name].get(ch.record_id, (None, None))[0]
                if prev_op in ["CREATE", "IGNORE"]:
                    # CREATE -> DELETE = Never existed for client
                    del coalesced[ch.table_name][ch.record_id]
                else:
                    coalesced[ch.table_name][ch.record_id] = ("DELETE", None)
            else:
                # CREATE or UPDATE
                obj = db.get(model_cls, ch.record_id)
                if obj:
                    prev_op = coalesced[ch.table_name].get(ch.record_id, (None, None))[0]
                    op = "CREATE" if prev_op == "CREATE" else ch.operation
                    d = obj.to_dict()
                    d['sync_revision'] = getattr(obj, 'server_revision', 0)
                    coalesced[ch.table_name][ch.record_id] = (op, d)
                else:
                    # Object no longer exists. 
                    prev_op = coalesced[ch.table_name].get(ch.record_id, (None, None))[0]
                    if ch.operation == "CREATE":
                        coalesced[ch.table_name][ch.record_id] = ("IGNORE", None)
                    elif prev_op in ["CREATE", "IGNORE"]:
                        if ch.record_id in coalesced[ch.table_name]:
                            del coalesced[ch.table_name][ch.record_id]
                    else:
                        coalesced[ch.table_name][ch.record_id] = ("DELETE", None)
                    
        for table_name, records in coalesced.items():
            if table_name not in server_changes: continue
            for record_id, (op, data) in records.items():
                if op == "DELETE":
                    server_changes[table_name].deleted.append(record_id)
                elif op == "CREATE":
                    server_changes[table_name].created.append(data)
                elif op == "UPDATE":
                    server_changes[table_name].updated.append(data)
                
    return SyncResponse(
        changes=server_changes,
        timestamp=upper_bound,
        status="success",
        records_processed=records_processed,
        conflicts=conflicts
    )
