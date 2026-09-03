"""
FastAPI Routes for Multi-Agent RAG Report Generation
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.db.session import get_db
from app.services.groq_rag_pipeline import get_rag_pipeline
from app.models.business import Business
from app.models.decision import Decision
import json

router = APIRouter(prefix="/ai", tags=["AI Reports"])


class ReportRequest(BaseModel):
    """Request body for generating a report"""
    business_id: str


class ReportResponse(BaseModel):
    """Response containing the generated report"""
    business_id: str
    decision: str  # GO, MODIFY, DO_NOT_INVEST_YET
    rationale: str
    confidence: float
    market_analysis: dict
    risk_assessment: dict
    modifications: list[str]
    next_steps: list[str]


@router.post("/generate-report", response_model=ReportResponse)
async def generate_business_report(
    request: ReportRequest,
    db: Session = Depends(get_db)
):
    """
    Generate a comprehensive business feasibility report using Multi-Agent RAG

    This endpoint:
    1. Fetches business details from the database
    2. Runs the multi-agent RAG pipeline (Context Retrieval → Market Analyst → Risk Actuary → Recommendation)
    3. Stores the decision in the database
    4. Returns the complete report

    **Cost**: ~₹0.40 per report with Azure GPT-4o-mini
    **Time**: ~10-15 seconds
    """

    # Fetch business from database
    business = db.query(Business).filter(Business.id == request.business_id).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    # Get user and location info
    if not business.user:
        raise HTTPException(status_code=400, detail="Business has no associated user")

    # Build a location string from the Location model fields
    # (Location has no full_name property; village_or_city/district/state are the columns)
    loc = business.location
    location_str = "Unknown"
    if loc:
        parts = [p for p in [loc.village_or_city, loc.district, loc.state] if p]
        location_str = ", ".join(parts) if parts else "Unknown"

    try:
        # Run the multi-agent pipeline
        pipeline = get_rag_pipeline()
        result = await pipeline.generate_report(
            business_id=business.id,
            business_category=business.business_category,
            location=location_str,
            capital=business.user.available_capital
        )

        # Store the decision in the database
        decision = Decision(
            business_id=business.id,
            decision=result["final_recommendation"]["decision"],
            rationale=result["final_recommendation"]["rationale"],
            confidence=result["final_recommendation"]["confidence"],
            evidence_summary={
                "market_analysis": result["market_analysis"],
                "risk_assessment": result["risk_assessment"],
                "modifications": result["final_recommendation"]["modifications"],
                "next_steps": result["final_recommendation"]["next_steps"]
            }
        )
        db.add(decision)
        db.commit()
        db.refresh(decision)

        return ReportResponse(
            business_id=business.id,
            decision=result["final_recommendation"]["decision"],
            rationale=result["final_recommendation"]["rationale"],
            confidence=result["final_recommendation"]["confidence"],
            market_analysis=result["market_analysis"],
            risk_assessment=result["risk_assessment"],
            modifications=result["final_recommendation"]["modifications"],
            next_steps=result["final_recommendation"]["next_steps"]
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")


@router.get("/reports/{business_id}", response_model=ReportResponse)
async def get_existing_report(
    business_id: str,
    db: Session = Depends(get_db)
):
    """
    Retrieve an existing report for a business

    Returns the most recent decision/report for the given business.
    """

    business = db.query(Business).filter(Business.id == business_id).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    # Get the most recent decision
    decision = db.query(Decision)\
        .filter(Decision.business_id == business_id)\
        .order_by(Decision.created_at.desc())\
        .first()

    if not decision:
        raise HTTPException(status_code=404, detail="No report found for this business")

    # Parse the summary JSON
    summary = decision.evidence_summary if decision.evidence_summary else {}

    return ReportResponse(
        business_id=business_id,
        decision=decision.decision,
        rationale=decision.rationale,
        confidence=float(decision.confidence),
        market_analysis=summary.get("market_analysis", {}),
        risk_assessment=summary.get("risk_assessment", {}),
        modifications=summary.get("modifications", []),
        next_steps=summary.get("next_steps", [])
    )


@router.get("/health")
async def health_check():
    """Check if Groq is configured correctly"""
    from app.core.config import settings

    required_vars = [
        "GROQ_API_KEY"
    ]

    missing = [var for var in required_vars if not getattr(settings, var)]

    if missing:
        return {
            "status": "error",
            "message": f"Missing environment variables: {', '.join(missing)}"
        }

    try:
        pipeline = get_rag_pipeline()
        return {
            "status": "ok",
            "message": "Groq RAG Pipeline is configured and ready",
            "models": {
                "chat": "openai/gpt-oss-120b",
                "embeddings": "sentence-transformers/all-MiniLM-L6-v2"
            }
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Pipeline initialization failed: {str(e)}"
        }
