from datetime import datetime, timezone
from typing import Any, Dict


def get_utc_timestamp_ms() -> int:
    """Get current UTC timestamp in milliseconds."""
    return int(datetime.now(timezone.utc).timestamp() * 1000)


def format_inr(amount: float) -> str:
    """Format numerical value as Indian Rupee currency string."""
    return f"₹{amount:,.2f}"
