import logging
import requests
import tempfile
import os
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from instagram_client import ig_manager
from database import get_db, LogEntry, BotSettingsModel

logger = logging.getLogger(__name__)
router = APIRouter()


class CreatePostRequest(BaseModel):
    image_url: str
    caption: str
    schedule_at: Optional[str] = None


def get_daily_count(db: Session, action_type: str) -> int:
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    count = db.query(func.count(LogEntry.id)).filter(
        LogEntry.action_type == action_type,
        LogEntry.status == "success",
        LogEntry.created_at >= today_start,
    ).scalar()
    return count or 0


@router.post("/create")
def create_post(req: CreatePostRequest, db: Session = Depends(get_db)):
    cl = ig_manager.get_client()
    if not cl:
        raise HTTPException(status_code=401, detail="Not logged in")

    settings = db.query(BotSettingsModel).filter(BotSettingsModel.id == 1).first()
    daily_limit = settings.post_daily_limit if settings else 3
    daily_count = get_daily_count(db, "post")

    if daily_count >= daily_limit:
        entry = LogEntry(action_type="post", target="photo", status="blocked",
                         message=f"Daily limit reached ({daily_limit})", created_at=datetime.now(timezone.utc))
        db.add(entry)
        db.commit()
        raise HTTPException(status_code=429, detail=f"Daily post limit reached ({daily_limit})")

    tmp_path = None
    try:
        response = requests.get(req.image_url, timeout=30)
        response.raise_for_status()

        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            tmp.write(response.content)
            tmp_path = tmp.name

        cl.photo_upload(tmp_path, req.caption)

        entry = LogEntry(action_type="post", target="photo", status="success",
                         message=f"Post created: {req.caption[:80]}", created_at=datetime.now(timezone.utc))
        db.add(entry)
        db.commit()
        return {"success": True, "message": "Post created successfully"}
    except Exception as e:
        entry = LogEntry(action_type="post", target="photo", status="error",
                         message=str(e), created_at=datetime.now(timezone.utc))
        db.add(entry)
        db.commit()
        logger.error(f"Error creating post: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
