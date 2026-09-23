"""
FastAPI Routes for Multi-Agent RAG Report Generation
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.db.session import get_db
from app.services.groq_rag_pipeline import get_rag_pipeline
from app.models.business import Business
import json

router = APIRouter(prefix="/ai", tags=["AI Reports"])


class ReportRequest(BaseModel):
    """Request body for generating a report"""
    business_id: str


class ReportResponse(BaseModel):
    """Response containing the generated report"""
    business_id: str
    summary: str
    deterministic_findings_explained: str
    caveats: list[str]
    questions_to_validate: list[str]
    suggested_next_steps: list[str]


@router.post("/generate-report", response_model=ReportResponse)
async def generate_business_report(
    request: ReportRequest,
    db: Session = Depends(get_db)
):
    """
    Generate a comprehensive business feasibility explanatory report.

    This endpoint runs the multi-agent RAG pipeline (Context Retrieval → Analysis).
    It does NOT persist a canonical Decision.
    """

    # Fetch business from database
    business = db.query(Business).filter(Business.id == request.business_id).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    # Get user and location info
    if not business.user:
        raise HTTPException(status_code=400, detail="Business has no associated user")

    loc = business.location
    location_str = "Unknown"
    if loc:
        parts = [p for p in [loc.village_or_city, loc.district, loc.state] if p]
        location_str = ", ".join(parts) if parts else "Unknown"

    try:
        pipeline = get_rag_pipeline()
        result = await pipeline.generate_report(
            business_id=business.id,
            business_category=business.business_category,
            location=location_str,
            capital=business.user.available_capital
        )
        
        rec = result["final_recommendation"]

        return ReportResponse(
            business_id=business.id,
            summary=rec["summary"],
            deterministic_findings_explained=rec["deterministic_findings_explained"],
            caveats=rec["caveats"],
            questions_to_validate=rec["questions_to_validate"],
            suggested_next_steps=rec["suggested_next_steps"]
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")


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
