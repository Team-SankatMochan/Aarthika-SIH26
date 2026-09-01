from typing import Dict, List, Any, Optional
from pydantic import BaseModel, Field


class TableChanges(BaseModel):
    created: List[Dict[str, Any]] = Field(default_factory=list)
    updated: List[Dict[str, Any]] = Field(default_factory=list)
    deleted: List[str] = Field(default_factory=list)


class SyncRequest(BaseModel):
    changes: Dict[str, TableChanges] = Field(
        default_factory=dict,
        examples=[
            {
                "users": {"created": [], "updated": [], "deleted": []},
                "locations": {"created": [], "updated": [], "deleted": []},
                "businesses": {"created": [], "updated": [], "deleted": []},
                "business_assumptions": {"created": [], "updated": [], "deleted": []},
                "market_data": {"created": [], "updated": [], "deleted": []},
                "stress_tests": {"created": [], "updated": [], "deleted": []},
                "stress_test_scenarios": {"created": [], "updated": [], "deleted": []},
                "pilots": {"created": [], "updated": [], "deleted": []},
                "pilot_results": {"created": [], "updated": [], "deleted": []},
                "evidence": {"created": [], "updated": [], "deleted": []},
            }
        ],
    )
    lastPulledAt: Optional[int] = Field(None, examples=[1724920000000])


class SyncResponse(BaseModel):
    changes: Dict[str, TableChanges] = Field(default_factory=dict)
    timestamp: int
    status: str = "success"
    records_processed: int = 0
