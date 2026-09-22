from typing import Dict, List, Any, Optional
from pydantic import BaseModel, Field


class TableChanges(BaseModel):
    created: List[Dict[str, Any]] = Field(default_factory=list)
    updated: List[Dict[str, Any]] = Field(default_factory=list)
    deleted: List[str] = Field(default_factory=list)


class SyncRequest(BaseModel):
    sync_request_id: str = Field(description="UUID for push idempotency")
    changes: Dict[str, TableChanges] = Field(
        default_factory=dict,
        examples=[
            {
                "users": {"created": [], "updated": [], "deleted": []},
            }
        ],
    )
    lastPulledAt: Optional[int] = Field(None, description="Treated as last_server_revision")


class SyncConflict(BaseModel):
    type: str = "SYNC_CONFLICT"
    table: str
    record_id: str
    client_base_revision: Optional[int]
    server_revision: int
    server_record: Dict[str, Any]


class SyncResponse(BaseModel):
    changes: Dict[str, TableChanges] = Field(default_factory=dict)
    timestamp: int = Field(description="The authoritative server revision cursor (snapshot_upper_bound)")
    status: str = "success"
    records_processed: int = 0
    conflicts: List[SyncConflict] = Field(default_factory=list)
