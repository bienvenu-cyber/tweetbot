import logging
import requests
import tempfile
import os
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from instagram_client import ig_manager
from database import get_db, LogEntry, BotSettingsModel
from utils import get_daily_count, log_action, validate_image_url

logger = logging.getLogger(__name__)
router = APIRouter()


class CreatePostRequest(BaseModel):
    image_url: str
    caption: str
    schedule_at: Optional[str] = None


@router.post("/create")
def create_post(req: CreatePostRequest, db: Session = Depends(get_db)):
    cl = ig_manager.get_client()
    if not cl:
        raise HTTPException(status_code=401, detail="Not logged in")

    # Validate image URL against whitelist (SSRF protection)
    try:
        validate_image_url(req.image_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    settings = db.query(BotSettingsModel).filter(BotSettingsModel.id == 1).first()
    daily_limit = settings.post_daily_limit if settings else 3
    daily_count = get_daily_count(db, "post")

    if daily_count >= daily_limit:
        log_action(db, "post", "photo", "blocked", f"Daily limit reached ({daily_limit})")
        raise HTTPException(status_code=429, detail=f"Daily post limit reached ({daily_limit})")

    tmp_path = None
    try:
        response = requests.get(req.image_url, timeout=30)
        response.raise_for_status()

        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            tmp.write(response.content)
            tmp_path = tmp.name

        cl.photo_upload(tmp_path, req.caption)

        log_action(db, "post", "photo", "success", f"Post created: {req.caption[:80]}")
        return {"success": True, "message": "Post created successfully"}
    except Exception as e:
        log_action(db, "post", "photo", "error", str(e))
        logger.error(f"Error creating post: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
