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
from datetime import datetime, timezone
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
           order: Optional[str] = None, limit: Optional[int] = None,
           offset: Optional[int] = None) -> List[Dict]:
    """GET rows from a table. Returns list of dicts."""
    params = {}
    if filters:
        for k, v in filters.items():
            params[k] = str(v) if v is not None else ""
    if order:
        params["order"] = order
    if limit:
        params["limit"] = str(limit)
    if offset:
        params["offset"] = str(offset)
    resp = _session.get(_url(table), params=params)
    resp.raise_for_status()
    result = resp.json().get("data", [])
    return result if isinstance(result, list) else [result] if result else []


def select_one(table: str, record_id: int) -> Optional[Dict]:
    """GET single row by id."""
    resp = _session.get(_url(table, record_id))
    if resp.status_code == 400:
        return None
    resp.raise_for_status()
    return resp.json().get("data")


def select_first(table: str, filters: Dict[str, Any]) -> Optional[Dict]:
    """Select the first row matching filters."""
    rows = select(table, filters=filters, limit=1)
    return rows[0] if rows else None


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
    """PATCH rows matching filters."""
    body = {**fields, "_filters": filters}
    resp = _session.patch(_url(table), json=body)
    resp.raise_for_status()
    return resp.json().get("data", [])


def delete(table: str, record_id: int) -> bool:
    """DELETE a row by id."""
    resp = _session.delete(_url(table, record_id))
    resp.raise_for_status()
    return True


def delete_by_filter(table: str, filters: Dict[str, Any]) -> bool:
    """Delete rows matching filters (fetches ids then deletes each)."""
    rows = select(table, filters=filters)
    for row in rows:
        delete(table, row["id"])
    return True


def count(table: str, filters: Optional[Dict[str, Any]] = None) -> int:
    """Count rows."""
    rows = select(table, filters=filters)
    return len(rows)


def count_today(table: str, action_type: str, status: str = "success") -> int:
    """Count today's actions of a given type with given status."""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    rows = select(table, filters={
        "action_type": action_type,
        "status": status,
        "created_at__gte": today_start.isoformat(),
    })
    return len(rows)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

def check_proxy():
    """Verify the proxy is reachable."""
    resp = _session.get(_url("bot_settings"), params={"limit": "1"})
    resp.raise_for_status()
    logger.info(f"[DB_PROXY] Connected to {DB_PROXY_URL}")
