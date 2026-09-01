from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select, desc
from app.db.session import get_db
from app.models.business import Business
from app.models.finance_assessment import FinanceAssessment
from app.schemas.finance_assessment import (
    FinanceAssessmentRequest,
    FinanceAssessmentResponse,
)
from app.services.finance_service import assess_business_finance

router = APIRouter(tags=["Financial Assessment & Loan Affordability"])


@router.post(
    "/businesses/{business_id}/finance-assessment",
    response_model=FinanceAssessmentResponse,
    status_code=status.HTTP_201_CREATED,
)
def compute_finance_assessment(
    business_id: str,
    request: FinanceAssessmentRequest,
    db: Session = Depends(get_db),
):
    """
    Perform deterministic financial calculation:
    - Project Cost & 90% Financing Cap
    - Maximum Permitted Loan vs Recommended Loan
    - Moratorium Interest Accrual & Capitalized Principal
    - Reducing Balance EMI & Total Interest
    - Debt Affordability Status & Versioned Audit Record
    """
    biz = db.get(Business, business_id)
    if not biz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")

    try:
        assessment = assess_business_finance(business_id, request, db)
        return assessment
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get(
    "/businesses/{business_id}/finance-assessment",
    response_model=FinanceAssessmentResponse,
)
def get_latest_finance_assessment(business_id: str, db: Session = Depends(get_db)):
    """Retrieve the latest audited financial assessment for a business."""
    biz = db.get(Business, business_id)
    if not biz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")

    assessment = db.scalars(
        select(FinanceAssessment)
        .where(FinanceAssessment.business_id == business_id)
        .order_by(desc(FinanceAssessment.calculation_version))
    ).first()

    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No financial assessment found for this business. Please trigger POST /finance-assessment first.",
        )
    return assessment


@router.get(
    "/businesses/{business_id}/finance-assessments",
    response_model=List[FinanceAssessmentResponse],
)
def list_finance_assessments(business_id: str, db: Session = Depends(get_db)):
    """Retrieve complete calculation audit trail for all financial assessments."""
    biz = db.get(Business, business_id)
    if not biz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")

    return db.scalars(
        select(FinanceAssessment)
        .where(FinanceAssessment.business_id == business_id)
        .order_by(desc(FinanceAssessment.calculation_version))
    ).all()
