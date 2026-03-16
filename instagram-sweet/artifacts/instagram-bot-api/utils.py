"""Shared utilities for the Instagram bot API."""

import re
import logging
from datetime import datetime, timezone
from urllib.parse import urlparse
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from database import LogEntry

logger = logging.getLogger("instagram_bot")

# ---------------------------------------------------------------------------
# Daily action counter (shared across routers)
# ---------------------------------------------------------------------------

def get_daily_count(db: Session, action_type: str) -> int:
    """Return the number of successful actions of *action_type* today (UTC)."""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    count = db.query(func.count(LogEntry.id)).filter(
        LogEntry.action_type == action_type,
        LogEntry.status == "success",
        LogEntry.created_at >= today_start,
    ).scalar()
    return count or 0


def log_action(db: Session, action_type: str, target: str, status: str, message: str):
    """Write a log entry and commit."""
    entry = LogEntry(
        action_type=action_type,
        target=target,
        status=status,
        message=message,
        created_at=datetime.now(timezone.utc),
    )
    db.add(entry)
    db.commit()


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
    """
    Validate an image URL against a whitelist.
    Raises ValueError if the URL is not allowed.
    Returns the validated URL.
    """
    try:
        parsed = urlparse(url)
    except Exception:
        raise ValueError("URL invalide")

    if parsed.scheme not in ("http", "https"):
        raise ValueError("Seuls http/https sont autorisés")

    host = (parsed.hostname or "").lower()
    if not host:
        raise ValueError("Hôte manquant dans l'URL")

    # Block private/internal IPs
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
