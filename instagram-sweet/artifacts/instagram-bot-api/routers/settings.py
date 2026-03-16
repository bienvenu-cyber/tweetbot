import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from database import get_db, BotSettingsModel
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


def _settings_to_dict(settings: BotSettingsModel) -> dict:
    return {
        "dm_daily_limit": settings.dm_daily_limit,
        "dm_delay_min": settings.dm_delay_min,
        "dm_delay_max": settings.dm_delay_max,
        "comment_daily_limit": settings.comment_daily_limit,
        "comment_delay_min": settings.comment_delay_min,
        "comment_delay_max": settings.comment_delay_max,
        "post_daily_limit": settings.post_daily_limit,
        "auto_dm_enabled": settings.auto_dm_enabled,
        "auto_comment_enabled": settings.auto_comment_enabled,
        "proxy_url": settings.proxy_url or "",
        "proxy_active": bool(get_global_proxy()),
    }


@router.get("")
def get_settings(db: Session = Depends(get_db)):
    settings = db.query(BotSettingsModel).filter(BotSettingsModel.id == 1).first()
    if not settings:
        settings = BotSettingsModel(id=1)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    if settings.proxy_url:
        set_global_proxy(settings.proxy_url)
    return _settings_to_dict(settings)


@router.put("")
def update_settings(body: BotSettings, db: Session = Depends(get_db)):
    settings = db.query(BotSettingsModel).filter(BotSettingsModel.id == 1).first()
    if not settings:
        settings = BotSettingsModel(id=1)
        db.add(settings)

    settings.dm_daily_limit = body.dm_daily_limit
    settings.dm_delay_min = body.dm_delay_min
    settings.dm_delay_max = body.dm_delay_max
    settings.comment_daily_limit = body.comment_daily_limit
    settings.comment_delay_min = body.comment_delay_min
    settings.comment_delay_max = body.comment_delay_max
    settings.post_daily_limit = body.post_daily_limit
    settings.auto_dm_enabled = body.auto_dm_enabled
    settings.auto_comment_enabled = body.auto_comment_enabled
    settings.proxy_url = body.proxy_url or None

    db.commit()
    db.refresh(settings)

    set_global_proxy(settings.proxy_url)
    logger.info(f"[SETTINGS] Updated — proxy: {'set' if settings.proxy_url else 'none'}")

    return _settings_to_dict(settings)


@router.post("/proxy/test")
def test_proxy(db: Session = Depends(get_db)):
    """Test the currently configured proxy by making a simple request."""
    import requests
    proxy = get_global_proxy()
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
