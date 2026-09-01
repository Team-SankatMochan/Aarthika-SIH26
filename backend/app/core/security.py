import hashlib
import secrets
from typing import Optional


def generate_idempotency_key(payload_bytes: bytes) -> str:
    """Generate SHA-256 hash for idempotent request verification."""
    return hashlib.sha256(payload_bytes).hexdigest()


def generate_secure_token(length: int = 32) -> str:
    """Generate cryptographically secure random token."""
    return secrets.token_urlsafe(length)
