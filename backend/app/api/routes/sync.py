import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.sync import SyncRequest, SyncResponse
from app.services.sync_service import process_sync_request

logger = logging.getLogger(__name__)

router = APIRouter(tags=["WatermelonDB Synchronization"])


@router.post(
    "/sync",
    response_model=SyncResponse,
    status_code=status.HTTP_200_OK,
    summary="WatermelonDB Sync Endpoint",
)
def sync_database(sync_req: SyncRequest, db: Session = Depends(get_db)):
    """
    Synchronize mobile client database (WatermelonDB) with PostgreSQL backend.
    - Transactional: Entire sync is executed in a single atomic transaction.
    - Idempotent: Tracks payload hashes and handles updates/upserts gracefully.
    - Respects foreign-key topological dependency hierarchy.
    """
    try:
        response = process_sync_request(sync_req, db)
        return response
    except ValueError as ve:
        logger.warning(f"Sync validation error: {ve}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Synchronization validation error: {str(ve)}",
        )
    except Exception as e:
        logger.error(f"Sync error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Synchronization failed: {str(e)}",
        )
