from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from instagram_client import account_manager

router = APIRouter()


# ---------------------------------------------------------------------------
# GET /bot-api/account — Single account info (existing)
# ---------------------------------------------------------------------------
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


# ---------------------------------------------------------------------------
# GET /bot-api/account/list — All accounts with status
# ---------------------------------------------------------------------------
@router.get("/list")
def list_accounts():
    """Return all bot accounts with their connection status."""
    accounts = account_manager.list_accounts()
    return {"accounts": accounts, "total": len(accounts)}


# ---------------------------------------------------------------------------
# PATCH /bot-api/account/{username}/toggle — Enable/disable an account
# ---------------------------------------------------------------------------
class ToggleRequest(BaseModel):
    is_active: bool


@router.patch("/{username}/toggle")
def toggle_account(username: str, req: ToggleRequest):
    """Toggle an account's active status. Inactive accounts are skipped by round-robin."""
    from database import SessionLocal, BotAccount

    username = username.strip().lstrip("@").lower()
    db = SessionLocal()
    try:
        account = db.query(BotAccount).filter(BotAccount.username == username).first()
        if not account:
            raise HTTPException(status_code=404, detail=f"Account @{username} not found")

        account.is_active = req.is_active
        db.commit()

        return {
            "success": True,
            "message": f"@{username} {'activé' if req.is_active else 'désactivé'}",
            "username": username,
            "is_active": req.is_active,
        }
    finally:
        db.close()


# ---------------------------------------------------------------------------
# DELETE /bot-api/account/{username} — Remove an account completely
# ---------------------------------------------------------------------------
@router.delete("/{username}")
def remove_account(username: str):
    """Completely remove an account (logout + delete from DB)."""
    username = username.strip().lstrip("@").lower()
    return account_manager.remove_account(username)
