from datetime import date
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from app.models.evidence import Evidence
from app.models.evidence_enums import EvidenceType


class EvidenceRepository:
    """Repository handling database persistence and querying for Evidence entities.
    
    Contains NO network calls, NO provider selection, and NO freshness rules.
    """

    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, evidence_id: str) -> Optional[Evidence]:
        return self.db.get(Evidence, evidence_id)

    def find_by_content_hash(self, content_hash: str) -> Optional[Evidence]:
        stmt = select(Evidence).where(Evidence.content_hash == content_hash)
        return self.db.execute(stmt).scalars().first()

    def find_market_price_cache(
        self,
        provider_id: str,
        commodity: str,
        price_type: str,
        currency: str = "INR",
        quantity_unit: str = "QUINTAL",
        state: Optional[str] = None,
        district: Optional[str] = None,
        market_id: Optional[str] = None,
        observation_date: Optional[date] = None,
    ) -> Optional[Evidence]:
        """Finds cached market price evidence using strict domain-specific matching.
        
        Guarantees that distinct commodities (e.g. Onion vs Tomato), markets, or units
        never collide in cache.
        """
        stmt = select(Evidence).where(
            Evidence.provider_id == provider_id,
            Evidence.evidence_type == EvidenceType.MARKET_PRICE.value,
            func.lower(Evidence.commodity) == commodity.strip().lower(),
            func.lower(Evidence.price_type) == price_type.strip().lower(),
            Evidence.currency == currency,
            Evidence.quantity_unit == quantity_unit,
        )

        if state:
            stmt = stmt.where(func.lower(Evidence.state) == state.strip().lower())
        if district:
            stmt = stmt.where(func.lower(Evidence.district) == district.strip().lower())
        if market_id:
            stmt = stmt.where(func.lower(Evidence.market_id) == market_id.strip().lower())
        if observation_date:
            stmt = stmt.where(Evidence.observation_date == observation_date)

        # Most recent snapshot first
        stmt = stmt.order_by(Evidence.retrieved_at.desc().nullslast(), Evidence.created_at.desc())
        return self.db.execute(stmt).scalars().first()

    def list_by_business(self, business_id: str) -> List[Evidence]:
        stmt = select(Evidence).where(Evidence.business_id == business_id).order_by(Evidence.created_at.desc())
        return list(self.db.execute(stmt).scalars().all())

    def insert(self, evidence: Evidence) -> Evidence:
        """Inserts a new canonical Evidence record into the database."""
        self.db.add(evidence)
        self.db.flush()
        return evidence
