from fastapi import APIRouter
from app.api.routes import (
    health,
    locations,
    users,
    businesses,
    schemes,
    stress_tests,
    pilots,
    finance,
    evidence,
    decisions,
    sync,
    ai_reports,
)

api_router = APIRouter()

# Include subrouters
api_router.include_router(health.router)
api_router.include_router(locations.router)
api_router.include_router(users.router)
api_router.include_router(businesses.router)
api_router.include_router(schemes.router)
api_router.include_router(stress_tests.router)
api_router.include_router(pilots.router)
api_router.include_router(finance.router)
api_router.include_router(evidence.router)
api_router.include_router(decisions.router)
api_router.include_router(sync.router)
api_router.include_router(ai_reports.router)  # Multi-Agent RAG Pipeline
