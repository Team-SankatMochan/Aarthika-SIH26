from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select, desc
from app.db.session import get_db
from app.models.business import Business
from app.models.evidence import Evidence, validate_canonical_evidence
from app.schemas.evidence import EvidenceCreate, EvidenceResponse, MarketPriceQueryResponse
from app.services.evidence_service import EvidenceService

router = APIRouter(tags=["Evidence & Traceability"])


@router.post(
    "/businesses/{business_id}/evidence",
    response_model=EvidenceResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_business_evidence(
    business_id: str, evidence_in: EvidenceCreate, db: Session = Depends(get_db)
):
    """Add traceable evidence point (Market, Competition, Pricing, Pilot, etc.)."""
    biz = db.get(Business, business_id)
    if not biz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
        
    if evidence_in.source_type and evidence_in.source_type != "USER_ENTERED":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Clients can only create evidence with source_type USER_ENTERED via REST API"
        )
    evidence_in.source_type = "USER_ENTERED"
    
    try:
        validate_canonical_evidence(
            source_type=evidence_in.source_type,
            evidence_type=evidence_in.evidence_type,
            numeric_value=evidence_in.numeric_value,
            text_value=evidence_in.text_value,
            boolean_value=evidence_in.boolean_value,
            is_legacy=False,
            legacy_value=evidence_in.value
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    data = evidence_in.model_dump(exclude_unset=True)
    data["business_id"] = business_id
    evidence = Evidence(**data)
    db.add(evidence)
    db.commit()
    db.refresh(evidence)
    return evidence


@router.get("/businesses/{business_id}/evidence", response_model=List[EvidenceResponse])
def list_business_evidence(business_id: str, db: Session = Depends(get_db)):
    """List all traceable evidence items supporting a business evaluation."""
    biz = db.get(Business, business_id)
    if not biz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")

    return db.scalars(
        select(Evidence)
        .where(Evidence.business_id == business_id)
        .order_by(desc(Evidence.created_at))
    ).all()


@router.get("/evidence/market-price", response_model=MarketPriceQueryResponse)
def get_market_price(
    commodity: str,
    price_type: str = "MODAL",
    currency: str = "INR",
    quantity_unit: str = "QUINTAL",
    state: Optional[str] = None,
    district: Optional[str] = None,
    market: Optional[str] = None,
    force_refresh: bool = False,
    db: Session = Depends(get_db),
):
    """Retrieve verified/cached market price evidence via EvidenceService."""
    service = EvidenceService(db)
    result = service.get_market_price(
        commodity=commodity,
        price_type=price_type,
        currency=currency,
        quantity_unit=quantity_unit,
        state=state,
        district=district,
        market_id=market,
        force_refresh=force_refresh,
    )
    db.commit()
    return MarketPriceQueryResponse(
        evidence=result.evidence,
        freshness=result.freshness.value,
        from_cache=result.from_cache,
        status=result.status.value,
        warnings=result.warnings,
    )
