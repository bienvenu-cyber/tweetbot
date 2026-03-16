"""
Encryption utilities for storing sensitive data (passwords) in the database.
Uses Fernet symmetric encryption with a key derived from BOT_ENCRYPTION_KEY env var.
"""

import os
import base64
import hashlib
import logging
from typing import Optional
from cryptography.fernet import Fernet

logger = logging.getLogger("instagram_bot")

_KEY: Optional[str] = os.environ.get("BOT_ENCRYPTION_KEY")


def _get_fernet() -> Fernet:
    """Derive a Fernet key from the env var (any string → 32-byte base64 key)."""
    if not _KEY:
        raise RuntimeError(
            "BOT_ENCRYPTION_KEY env var is required for password encryption. "
            "Set any random string (e.g. 'openssl rand -hex 32')."
        )
    # Derive a consistent 32-byte key from any string
    key_bytes = hashlib.sha256(_KEY.encode()).digest()
    fernet_key = base64.urlsafe_b64encode(key_bytes)
    return Fernet(fernet_key)


def encrypt_password(password: str) -> str:
    """Encrypt a password. Returns a base64-encoded token string."""
    f = _get_fernet()
    return f.encrypt(password.encode()).decode()


def decrypt_password(token: str) -> str:
    """Decrypt a password token back to plaintext."""
    f = _get_fernet()
    return f.decrypt(token.encode()).decode()
