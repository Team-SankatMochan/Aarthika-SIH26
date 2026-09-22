from datetime import datetime, timezone, timedelta
from typing import Optional, Dict
from app.models.evidence_enums import FreshnessStatus, EvidenceType
from app.models.evidence import Evidence


# Centralized TTL configurations (in seconds)
DEFAULT_FRESHNESS_TTLS: Dict[str, int] = {
    EvidenceType.MARKET_PRICE.value: 86400,        # 24 hours
    EvidenceType.WEATHER_OBSERVATION.value: 21600, # 6 hours
    EvidenceType.WEATHER_WARNING.value: 10800,     # 3 hours
    EvidenceType.DISTRICT_STATISTIC.value: 31536000, # 365 days
    EvidenceType.BUSINESS_CONTEXT.value: 604800,   # 7 days
}


class FreshnessPolicy:
    """Evaluates evidence freshness dynamically.
    
    Freshness status is NOT stored in the database.
    """

    def __init__(self, ttls: Optional[Dict[str, int]] = None):
        self.ttls = ttls or DEFAULT_FRESHNESS_TTLS

    def evaluate(self, evidence: Evidence, now: Optional[datetime] = None) -> FreshnessStatus:
        if not evidence.retrieved_at:
            return FreshnessStatus.UNKNOWN

        current_time = now or datetime.now(timezone.utc)
        retrieved_time = evidence.retrieved_at
        if retrieved_time.tzinfo is None:
            retrieved_time = retrieved_time.replace(tzinfo=timezone.utc)
        if current_time.tzinfo is None:
            current_time = current_time.replace(tzinfo=timezone.utc)

        age_seconds = (current_time - retrieved_time).total_seconds()
        if age_seconds < 0:
            # Clock skew or future timestamp
            return FreshnessStatus.VERIFIED_FRESH

        ttl = self.ttls.get(evidence.evidence_type, 86400)
        if age_seconds <= ttl:
            return FreshnessStatus.VERIFIED_FRESH
        else:
            return FreshnessStatus.VERIFIED_STALE
