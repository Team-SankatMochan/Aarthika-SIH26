from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select, desc
from app.db.session import get_db
from app.models.business import Business
from app.models.decision import Decision
from app.schemas.decision import DecisionResponse
from app.services.decision_service import evaluate_business_decision

router = APIRouter(tags=["Pre-Investment Decisions"])


@router.post(
    "/businesses/{business_id}/decision",
    response_model=DecisionResponse,
    status_code=status.HTTP_201_CREATED,
)
def generate_business_decision(business_id: str, db: Session = Depends(get_db)):
    """
    Synthesize pre-investment decision (GO / MODIFY / DO_NOT_INVEST_YET).
    Evaluates unit economics, stress tests, real-world pilot evidence, and debt affordability.
    """
    biz = db.get(Business, business_id)
    if not biz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")

    decision = evaluate_business_decision(business_id, db)
    return decision


@router.get(
    "/businesses/{business_id}/decision",
    response_model=DecisionResponse,
)
def get_latest_business_decision(business_id: str, db: Session = Depends(get_db)):
    """Retrieve the latest pre-investment decision for a business."""
    biz = db.get(Business, business_id)
    if not biz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")

    decision = db.scalars(
        select(Decision)
        .where(Decision.business_id == business_id)
        .order_by(desc(Decision.created_at))
    ).first()

    if not decision:
        # If none exists yet, automatically evaluate one
        decision = evaluate_business_decision(business_id, db)

    return decision
