from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select, desc
from app.db.session import get_db
from app.models.business import Business
from app.models.stress_test import StressTest
from app.schemas.stress_test import StressTestResponse, StressTestRunRequest
from app.services.stress_test_service import run_stress_test_for_business

router = APIRouter(tags=["Crash Tests & Stress Scenarios"])


@router.post(
    "/businesses/{business_id}/stress-tests",
    response_model=StressTestResponse,
    status_code=status.HTTP_201_CREATED,
)
def execute_business_stress_test(
    business_id: str,
    request: StressTestRunRequest = StressTestRunRequest(),
    db: Session = Depends(get_db),
):
    """
    Execute deterministic Vyapar Crash Test simulation.
    Simulates demand drops, price cuts, raw material cost spikes, customer loss, and delayed payments.
    """
    biz = db.get(Business, business_id)
    if not biz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")

    try:
        stress_test = run_stress_test_for_business(business_id, request, db)
        return stress_test
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/stress-tests/{stress_test_id}", response_model=StressTestResponse)
def get_stress_test(stress_test_id: str, db: Session = Depends(get_db)):
    """Retrieve stress test results and scenario breakdown."""
    st = db.get(StressTest, stress_test_id)
    if not st:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stress test not found")
    return st


@router.get("/businesses/{business_id}/stress-tests", response_model=List[StressTestResponse])
def list_business_stress_tests(business_id: str, db: Session = Depends(get_db)):
    """List all stress test sessions conducted for a business."""
    biz = db.get(Business, business_id)
    if not biz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")

    return db.scalars(
        select(StressTest)
        .where(StressTest.business_id == business_id)
        .order_by(desc(StressTest.created_at))
    ).all()
