from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select, desc
from app.db.session import get_db
from app.models.business import Business
from app.models.business_assumption import BusinessAssumption
from app.models.user import User
from app.schemas.business import BusinessCreate, BusinessUpdate, BusinessResponse
from app.schemas.business_assumption import BusinessAssumptionCreate, BusinessAssumptionResponse

router = APIRouter(prefix="/businesses", tags=["Businesses"])


@router.post("", response_model=BusinessResponse, status_code=status.HTTP_201_CREATED)
def create_business(business_in: BusinessCreate, db: Session = Depends(get_db)):
    """Register a new micro-enterprise idea."""

    user = db.get(User, business_in.user_id)
    if not user:
        # Create prototype dummy user on-the-fly to allow frontend integration to succeed
        user = User(id=business_in.user_id, name="Prototyper", phone="9999999999", available_capital=50000)
        db.add(user)
        try:
            db.commit()
            db.refresh(user)
        except Exception:
            db.rollback()
            raise HTTPException(status_code=400, detail="Failed to mock user. Check schema.")


    db_obj = Business(**business_in.model_dump(exclude_unset=True))
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


@router.get("", response_model=List[BusinessResponse])
def list_businesses(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """List businesses with pagination."""
    return db.scalars(select(Business).offset(skip).limit(limit)).all()


@router.get("/{business_id}", response_model=BusinessResponse)
def get_business(business_id: str, db: Session = Depends(get_db)):
    """Retrieve business profile by ID."""
    biz = db.get(Business, business_id)
    if not biz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    return biz


@router.post("/{business_id}/assumptions", response_model=BusinessAssumptionResponse, status_code=status.HTTP_201_CREATED)
def create_business_assumption(
    business_id: str, assumption_in: BusinessAssumptionCreate, db: Session = Depends(get_db)
):
    """Add a new versioned assumption set to the business (historical versions are preserved)."""
    biz = db.get(Business, business_id)
    if not biz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")

    data = assumption_in.model_dump(exclude_unset=True)
    data["business_id"] = business_id
    db_obj = BusinessAssumption(**data)
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


@router.get("/{business_id}/assumptions", response_model=List[BusinessAssumptionResponse])
def list_business_assumptions(business_id: str, db: Session = Depends(get_db)):
    """Retrieve all historical assumption versions for a business (audit trail)."""
    biz = db.get(Business, business_id)
    if not biz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")

    return db.scalars(
        select(BusinessAssumption)
        .where(BusinessAssumption.business_id == business_id)
        .order_by(desc(BusinessAssumption.created_at))
    ).all()
