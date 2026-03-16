import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from instagram_client import account_manager
from database import get_db, BotSettingsModel
from utils import get_daily_count, log_action

logger = logging.getLogger(__name__)
router = APIRouter()


class PostCommentRequest(BaseModel):
    post_url: str
    comment: str
    account_username: Optional[str] = None


@router.post("/post")
def post_comment(req: PostCommentRequest, db: Session = Depends(get_db)):
    cl = account_manager.get_client(req.account_username)
    if not cl:
        raise HTTPException(status_code=401, detail="Not logged in")

    settings = db.query(BotSettingsModel).filter(BotSettingsModel.id == 1).first()
    daily_limit = settings.comment_daily_limit if settings else 30
    daily_count = get_daily_count(db, "comment")

    if daily_count >= daily_limit:
        log_action(db, "comment", req.post_url[:100], "blocked", f"Daily limit reached ({daily_limit})")
        raise HTTPException(status_code=429, detail=f"Daily comment limit reached ({daily_limit})")

    try:
        media_pk = cl.media_pk_from_url(req.post_url)
        cl.media_comment(media_pk, req.comment)
        log_action(db, "comment", req.post_url[:100], "success", f"Comment: {req.comment[:100]}")
        return {"success": True, "message": "Comment posted successfully"}
    except Exception as e:
        log_action(db, "comment", req.post_url[:100], "error", str(e))
        logger.error(f"Error posting comment: {e}")
        raise HTTPException(status_code=500, detail=str(e))
