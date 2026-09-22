import hashlib
import json
from decimal import Decimal
from typing import Any, Dict, Optional


def compute_evidence_content_hash(
    provider_id: str,
    evidence_type: str,
    commodity: Optional[str] = None,
    state: Optional[str] = None,
    district: Optional[str] = None,
    market_id: Optional[str] = None,
    market_name: Optional[str] = None,
    price_type: Optional[str] = None,
    observation_date: Optional[str] = None,
    numeric_value: Optional[Decimal] = None,
    text_value: Optional[str] = None,
    boolean_value: Optional[bool] = None,
    currency: Optional[str] = "INR",
    quantity_unit: Optional[str] = None,
    provider_record_id: Optional[str] = None,
) -> str:
    """Computes a deterministic SHA-256 content hash for an Evidence observation.
    
    Uses canonical JSON serialization:
    - Strict sorted keys
    - Normalized null values (empty string / None consistently handled)
    - Authoritative canonical decimal strings with 4 decimal places
    - Invariant to Python dictionary insertion order
    """
    canonical_dict: Dict[str, Any] = {
        "boolean_value": boolean_value if boolean_value is not None else None,
        "commodity": commodity.strip().upper() if commodity else None,
        "currency": currency.strip().upper() if currency else "INR",
        "district": district.strip().upper() if district else None,
        "evidence_type": evidence_type.strip().upper(),
        "market_id": market_id.strip().upper() if market_id else None,
        "market_name": market_name.strip().upper() if market_name else None,
        "numeric_value": f"{Decimal(str(numeric_value)):.4f}" if numeric_value is not None else None,
        "observation_date": str(observation_date) if observation_date else None,
        "price_type": price_type.strip().upper() if price_type else None,
        "provider_id": provider_id.strip(),
        "provider_record_id": provider_record_id.strip() if provider_record_id else None,
        "quantity_unit": quantity_unit.strip().upper() if quantity_unit else None,
        "state": state.strip().upper() if state else None,
        "text_value": text_value.strip() if text_value else None,
    }

    # Strict JSON serialization with sorted keys and no unnecessary whitespace
    serialized = json.dumps(canonical_dict, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()
