from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from instagram_client import account_manager

router = APIRouter()


@router.get("")
def get_account(username: Optional[str] = Query(None)):
    cl = account_manager.get_client(username)
    if not cl:
        raise HTTPException(status_code=401, detail="Not logged in")
    try:
        user = cl.account_info()
        return {
            "username": user.username,
            "full_name": user.full_name,
            "biography": user.biography or "",
            "profile_pic_url": str(user.profile_pic_url) if user.profile_pic_url else None,
            "followers_count": user.follower_count,
            "following_count": user.following_count,
            "media_count": user.media_count,
            "is_private": user.is_private,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
