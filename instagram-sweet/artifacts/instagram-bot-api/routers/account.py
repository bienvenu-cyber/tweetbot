import logging
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from instagram_client import account_manager
import db_proxy

logger = logging.getLogger("instagram_bot")
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


@router.get("/list")
def list_accounts():
    accounts = account_manager.list_accounts()
    return {"accounts": accounts, "total": len(accounts)}


@router.get("/followers")
def get_followers(
    amount: int = Query(50, ge=1, le=500),
    account_username: Optional[str] = Query(None),
):
    """Fetch followers of any account. Uses the active logged-in client to make the request.
    If account_username is provided, fetches followers of THAT account using the active client.
    If not provided, fetches followers of the active account itself."""
    # Always use the active (logged-in) client to make the API call
    cl = account_manager.get_client()
    if not cl:
        raise HTTPException(status_code=401, detail="No active Instagram session. Log in first.")

    try:
        if account_username:
            # Fetch followers of a different account using the active client
            target_username = account_username.strip().lstrip("@").lower()
            logger.info(f"[FOLLOWERS] Looking up @{target_username} via active client")
            target_user = cl.user_info_by_username(target_username)
            user_id = target_user.pk
            display_name = target_username
        else:
            # Fetch followers of the active account itself
            user_info = cl.account_info()
            user_id = user_info.pk
            display_name = user_info.username

        logger.info(f"[FOLLOWERS] Fetching up to {amount} followers for @{display_name} (pk={user_id})")
        followers = cl.user_followers(user_id, amount=amount)
        result = []
        for uid, user in followers.items():
            result.append({
                "user_id": str(uid),
                "username": user.username,
                "full_name": user.full_name or "",
                "profile_pic_url": str(user.profile_pic_url) if user.profile_pic_url else None,
            })
        logger.info(f"[FOLLOWERS] Got {len(result)} followers")
        return {"followers": result, "total": len(result)}
    except Exception as e:
        logger.error(f"[FOLLOWERS] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class ToggleRequest(BaseModel):
    is_active: bool


@router.patch("/{username}/toggle")
def toggle_account(username: str, req: ToggleRequest):
    username = username.strip().lstrip("@").lower()

    account = db_proxy.select_first("bot_accounts", {"username": username})
    if not account:
        raise HTTPException(status_code=404, detail=f"Account @{username} not found")

    db_proxy.update("bot_accounts", account["id"], {"is_active": req.is_active})

    return {
        "success": True,
        "message": f"@{username} {'activé' if req.is_active else 'désactivé'}",
        "username": username,
        "is_active": req.is_active,
    }


@router.delete("/{username}")
def remove_account(username: str):
    username = username.strip().lstrip("@").lower()
    return account_manager.remove_account(username)
