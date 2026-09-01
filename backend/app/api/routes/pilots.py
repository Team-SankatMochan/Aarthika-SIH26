from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select, desc
from app.db.session import get_db
from app.models.business import Business
from app.models.pilot import Pilot, PilotResult
from app.schemas.pilot import PilotCreate, PilotResponse, PilotResultCreate, PilotResultResponse

router = APIRouter(tags=["Pilots & Real-World Validation"])


@router.post(
    "/businesses/{business_id}/pilots",
    response_model=PilotResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_pilot(business_id: str, pilot_in: PilotCreate, db: Session = Depends(get_db)):
    """Create a new low-cost real-world validation pilot experiment."""
    biz = db.get(Business, business_id)
    if not biz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")

    data = pilot_in.model_dump(exclude_unset=True)
    data["business_id"] = business_id
    pilot = Pilot(**data)
    db.add(pilot)
    db.commit()
    db.refresh(pilot)
    return pilot


@router.get("/businesses/{business_id}/pilots", response_model=List[PilotResponse])
def list_business_pilots(business_id: str, db: Session = Depends(get_db)):
    """List all validation pilots planned or executed for a business."""
    biz = db.get(Business, business_id)
    if not biz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")

    return db.scalars(
        select(Pilot)
        .where(Pilot.business_id == business_id)
        .order_by(desc(Pilot.created_at))
    ).all()


@router.get("/pilots/{pilot_id}", response_model=PilotResponse)
def get_pilot(pilot_id: str, db: Session = Depends(get_db)):
    """Retrieve pilot details and recorded results."""
    pilot = db.get(Pilot, pilot_id)
    if not pilot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pilot not found")
    return pilot


@router.post(
    "/pilots/{pilot_id}/results",
    response_model=PilotResultResponse,
    status_code=status.HTTP_201_CREATED,
)
def record_pilot_result(pilot_id: str, result_in: PilotResultCreate, db: Session = Depends(get_db)):
    """Record observed experimental results for a completed/ongoing pilot."""
    pilot = db.get(Pilot, pilot_id)
    if not pilot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pilot not found")

    data = result_in.model_dump(exclude_unset=True)
    data["pilot_id"] = pilot_id
    result = PilotResult(**data)
    db.add(result)

    # Mark pilot completed if results added
    pilot.status = "COMPLETED"
    db.commit()
    db.refresh(result)
    return result
