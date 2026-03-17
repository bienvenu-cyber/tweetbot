"""Shared utilities for the Instagram bot API — HTTP proxy version."""

import re
import logging
from datetime import datetime, timezone
from urllib.parse import urlparse
from typing import Optional

import db_proxy

logger = logging.getLogger("instagram_bot")

# ---------------------------------------------------------------------------
# Daily action counter
# ---------------------------------------------------------------------------

def get_daily_count(action_type: str) -> int:
    """Return the number of successful actions of *action_type* today (UTC)."""
    return db_proxy.count_today("bot_logs", action_type, "success")


def log_action(action_type: str, target: str, status: str, message: str, account_username: Optional[str] = None):
    """Write a log entry via proxy."""
    db_proxy.insert("bot_logs", {
        "action_type": action_type,
        "target": target,
        "status": status,
        "message": message,
        "account_username": account_username,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


# ---------------------------------------------------------------------------
# Image URL validation (whitelist)
# ---------------------------------------------------------------------------

ALLOWED_IMAGE_HOSTS = {
    "i.imgur.com",
    "imgur.com",
    "pbs.twimg.com",
    "upload.wikimedia.org",
    "images.unsplash.com",
    "cdn.pixabay.com",
    "res.cloudinary.com",
    "storage.googleapis.com",
    "s3.amazonaws.com",
}

_PRIVATE_IP_PATTERNS = [
    re.compile(r"^127\."),
    re.compile(r"^10\."),
    re.compile(r"^172\.(1[6-9]|2\d|3[01])\."),
    re.compile(r"^192\.168\."),
    re.compile(r"^0\."),
    re.compile(r"^169\.254\."),
]


def validate_image_url(url: str, extra_hosts: Optional[set] = None) -> str:
    try:
        parsed = urlparse(url)
    except Exception:
        raise ValueError("URL invalide")

    if parsed.scheme not in ("http", "https"):
        raise ValueError("Seuls http/https sont autorisés")

    host = (parsed.hostname or "").lower()
    if not host:
        raise ValueError("Hôte manquant dans l'URL")

    for pat in _PRIVATE_IP_PATTERNS:
        if pat.match(host):
            raise ValueError("URLs internes interdites")
    if host in ("localhost", "0.0.0.0", "metadata.google.internal"):
        raise ValueError("URLs internes interdites")

    allowed = ALLOWED_IMAGE_HOSTS | (extra_hosts or set())
    if host not in allowed:
        raise ValueError(
            f"Domaine '{host}' non autorisé. Domaines acceptés : {', '.join(sorted(allowed))}"
        )

    return url
