from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.database import check_db_connection
from app.core.config import settings

router = APIRouter()


@router.get("/health", summary="Health Check")
def health_check(db: Session = Depends(get_db)):
    """Health check endpoint to verify API and database liveness."""
    db_ok = check_db_connection()
    return {
        "status": "healthy" if db_ok else "degraded",
        "app_name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "database_connected": db_ok,
    }
