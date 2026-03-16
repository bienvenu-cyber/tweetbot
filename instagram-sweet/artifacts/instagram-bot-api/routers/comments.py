import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from instagram_client import ig_manager
from database import get_db, LogEntry, BotSettingsModel

logger = logging.getLogger(__name__)
router = APIRouter()


class PostCommentRequest(BaseModel):
    post_url: str
    comment: str


def get_daily_count(db: Session, action_type: str) -> int:
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    count = db.query(func.count(LogEntry.id)).filter(
        LogEntry.action_type == action_type,
        LogEntry.status == "success",
        LogEntry.created_at >= today_start,
    ).scalar()
    return count or 0


@router.post("/post")
def post_comment(req: PostCommentRequest, db: Session = Depends(get_db)):
    cl = ig_manager.get_client()
    if not cl:
        raise HTTPException(status_code=401, detail="Not logged in")

    settings = db.query(BotSettingsModel).filter(BotSettingsModel.id == 1).first()
    daily_limit = settings.comment_daily_limit if settings else 30
    daily_count = get_daily_count(db, "comment")

    if daily_count >= daily_limit:
        entry = LogEntry(action_type="comment", target=req.post_url[:100], status="blocked",
                         message=f"Daily limit reached ({daily_limit})", created_at=datetime.now(timezone.utc))
        db.add(entry)
        db.commit()
        raise HTTPException(status_code=429, detail=f"Daily comment limit reached ({daily_limit})")

    try:
        media_pk = cl.media_pk_from_url(req.post_url)
        cl.media_comment(media_pk, req.comment)
        entry = LogEntry(action_type="comment", target=req.post_url[:100], status="success",
                         message=f"Comment: {req.comment[:100]}", created_at=datetime.now(timezone.utc))
        db.add(entry)
        db.commit()
        return {"success": True, "message": "Comment posted successfully"}
    except Exception as e:
        entry = LogEntry(action_type="comment", target=req.post_url[:100], status="error",
                         message=str(e), created_at=datetime.now(timezone.utc))
        db.add(entry)
        db.commit()
        logger.error(f"Error posting comment: {e}")
        raise HTTPException(status_code=500, detail=str(e))
