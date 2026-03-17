"""
Database proxy client – replaces direct SQLAlchemy access with HTTP calls
to the Lovable Cloud Edge Function `bot-db-proxy`.

Usage on Railway:
  Set these env vars:
    DB_PROXY_URL = https://tbgtgbsjkzdvummjxssy.supabase.co/functions/v1/bot-db-proxy
    BOT_API_KEY  = <same key you saved in Lovable secrets>
"""

import os
import logging
import requests
from typing import Optional, List, Dict, Any

logger = logging.getLogger("instagram_bot")

DB_PROXY_URL = os.environ.get(
    "DB_PROXY_URL",
    "https://tbgtgbsjkzdvummjxssy.supabase.co/functions/v1/bot-db-proxy",
)
BOT_API_KEY = os.environ.get("BOT_API_KEY", "")

_session = requests.Session()
_session.headers.update({
    "Content-Type": "application/json",
    "x-bot-api-key": BOT_API_KEY,
})


def _url(table: str, record_id: Optional[int] = None) -> str:
    base = f"{DB_PROXY_URL}/{table}"
    if record_id is not None:
        base += f"/{record_id}"
    return base


# ---------------------------------------------------------------------------
# Generic CRUD helpers
# ---------------------------------------------------------------------------

def select(table: str, filters: Optional[Dict[str, Any]] = None,
           order: Optional[str] = None, limit: Optional[int] = None) -> List[Dict]:
    """GET rows from a table. Returns list of dicts."""
    params = {}
    if filters:
        for k, v in filters.items():
            params[k] = v
    if order:
        params["order"] = order
    if limit:
        params["limit"] = str(limit)
    resp = _session.get(_url(table), params=params)
    resp.raise_for_status()
    return resp.json().get("data", [])


def select_one(table: str, record_id: int) -> Optional[Dict]:
    """GET single row by id."""
    resp = _session.get(_url(table, record_id))
    if resp.status_code == 400:
        return None
    resp.raise_for_status()
    return resp.json().get("data")


def insert(table: str, row: Dict) -> Dict:
    """POST to insert a row. Returns the inserted row."""
    resp = _session.post(_url(table), json=row)
    resp.raise_for_status()
    data = resp.json().get("data", [])
    return data[0] if data else {}


def update(table: str, record_id: int, fields: Dict) -> Dict:
    """PATCH a row by id. Returns the updated row."""
    resp = _session.patch(_url(table, record_id), json=fields)
    resp.raise_for_status()
    data = resp.json().get("data", [])
    return data[0] if data else {}


def update_by_filter(table: str, filters: Dict[str, Any], fields: Dict) -> List[Dict]:
    """PATCH rows matching filters (no record id)."""
    body = {**fields, "_filters": filters}
    resp = _session.patch(_url(table), json=body)
    resp.raise_for_status()
    return resp.json().get("data", [])


def delete(table: str, record_id: int) -> bool:
    """DELETE a row by id."""
    resp = _session.delete(_url(table, record_id))
    resp.raise_for_status()
    return True


def count(table: str, filters: Optional[Dict[str, Any]] = None) -> int:
    """Count rows (fetches all ids, returns len). For small tables."""
    rows = select(table, filters=filters)
    return len(rows) if isinstance(rows, list) else 0


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

def check_proxy():
    """Verify the proxy is reachable."""
    resp = _session.get(_url("bot_settings"), params={"limit": "1"})
    resp.raise_for_status()
    logger.info(f"[DB_PROXY] Connected to {DB_PROXY_URL}")
