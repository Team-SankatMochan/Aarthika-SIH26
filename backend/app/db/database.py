import logging
from sqlalchemy import text
from app.db.session import engine, SessionLocal
from app.db.base import Base

logger = logging.getLogger(__name__)


def check_db_connection() -> bool:
    """Verify database connectivity."""
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logger.error(f"Database connection error: {e}")
        return False


def init_db() -> None:
    """Create database tables if they do not exist (useful for testing and initial dev)."""
    Base.metadata.create_all(bind=engine)
