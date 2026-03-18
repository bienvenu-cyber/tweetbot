import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import db_proxy
from instagram_client import set_global_proxy, get_global_proxy

logger = logging.getLogger("instagram_bot")
router = APIRouter()


class BotSettings(BaseModel):
    dm_daily_limit: int = 50
    dm_delay_min: int = 30
    dm_delay_max: int = 120
    comment_daily_limit: int = 30
    comment_delay_min: int = 20
    comment_delay_max: int = 90
    post_daily_limit: int = 3
    auto_dm_enabled: bool = False
    auto_comment_enabled: bool = False
    proxy_url: Optional[str] = None


def _get_or_create_settings() -> dict:
    row = db_proxy.select_first("bot_settings", {"id": "1"})
    if not row:
        row = db_proxy.insert("bot_settings", {"id": 1})
    return row


def _settings_to_dict(s: dict) -> dict:
    return {
        "dm_daily_limit": s.get("dm_daily_limit", 50),
        "dm_delay_min": s.get("dm_delay_min", 30),
        "dm_delay_max": s.get("dm_delay_max", 120),
        "comment_daily_limit": s.get("comment_daily_limit", 30),
        "comment_delay_min": s.get("comment_delay_min", 20),
        "comment_delay_max": s.get("comment_delay_max", 90),
        "post_daily_limit": s.get("post_daily_limit", 3),
        "auto_dm_enabled": s.get("auto_dm_enabled", False),
        "auto_comment_enabled": s.get("auto_comment_enabled", False),
        "proxy_url": s.get("proxy_url") or "",
        "proxy_active": bool(get_global_proxy()),
    }


@router.get("")
def get_settings():
    settings = _get_or_create_settings()
    if settings.get("proxy_url"):
        set_global_proxy(settings["proxy_url"])
    return _settings_to_dict(settings)


@router.put("")
def update_settings(body: BotSettings):
    _get_or_create_settings()  # ensure row exists

    fields = {
        "dm_daily_limit": body.dm_daily_limit,
        "dm_delay_min": body.dm_delay_min,
        "dm_delay_max": body.dm_delay_max,
        "comment_daily_limit": body.comment_daily_limit,
        "comment_delay_min": body.comment_delay_min,
        "comment_delay_max": body.comment_delay_max,
        "post_daily_limit": body.post_daily_limit,
        "auto_dm_enabled": body.auto_dm_enabled,
        "auto_comment_enabled": body.auto_comment_enabled,
        "proxy_url": body.proxy_url or None,
    }

    updated = db_proxy.update("bot_settings", 1, fields)

    set_global_proxy(body.proxy_url)
    logger.info(f"[SETTINGS] Updated — proxy: {'set' if body.proxy_url else 'none'}")

    return _settings_to_dict(updated if updated else fields)


class ProxyTestRequest(BaseModel):
    proxy_url: Optional[str] = None


@router.post("/proxy/test")
def test_proxy(body: Optional[ProxyTestRequest] = None):
    import requests
    # Use provided proxy_url from body, fallback to global
    proxy = (body.proxy_url.strip() if body and body.proxy_url and body.proxy_url.strip() else None) or get_global_proxy()
    if not proxy:
        return {"success": False, "message": "Aucun proxy configuré. Ajoute un proxy dans les paramètres."}
    try:
        proxies = {"http": proxy, "https": proxy}
        resp = requests.get("https://httpbin.org/ip", proxies=proxies, timeout=15)
        data = resp.json()
        origin_ip = data.get("origin", "unknown")
        logger.info(f"[PROXY TEST] IP via proxy: {origin_ip}")
        return {"success": True, "message": f"Proxy fonctionnel — IP visible: {origin_ip}", "ip": origin_ip}
    except Exception as e:
        logger.error(f"[PROXY TEST] Failed: {e}")
        return {"success": False, "message": f"Proxy inaccessible: {e}"}
