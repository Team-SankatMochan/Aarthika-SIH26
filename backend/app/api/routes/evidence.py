from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select, desc
from app.db.session import get_db
from app.models.business import Business
from app.models.evidence import Evidence
from app.schemas.evidence import EvidenceCreate, EvidenceResponse

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
