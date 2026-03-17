import logging
from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import Optional
from instagram_client import account_manager
import db_proxy

logger = logging.getLogger("instagram_bot")
router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


class ChallengeCodeRequest(BaseModel):
    username: str
    code: str


class CookieImportRequest(BaseModel):
    cookie_string: Optional[str] = None
    sessionid: Optional[str] = None
    csrftoken: Optional[str] = None
    ds_user_id: Optional[str] = None
    mid: Optional[str] = None
    ig_did: Optional[str] = None
    rur: Optional[str] = None
    username: Optional[str] = None


@router.post("/login")
def login(req: LoginRequest):
    return account_manager.login(req.username, req.password)


@router.post("/challenge")
def submit_challenge(req: ChallengeCodeRequest):
    return account_manager.submit_challenge_code(req.username, req.code)


@router.post("/import-cookies")
def import_cookies(req: CookieImportRequest):
    return account_manager.login_with_cookies(
        cookie_string=req.cookie_string,
        sessionid=req.sessionid,
        csrftoken=req.csrftoken,
        ds_user_id=req.ds_user_id,
        mid=req.mid,
        ig_did=req.ig_did,
        rur=req.rur,
        username=req.username,
    )


@router.post("/logout")
def logout(username: Optional[str] = None, hard: bool = Query(False)):
    """Soft logout (default): removes from memory only.
    Hard logout: also wipes session_data from DB so reimport is needed."""
    if username:
        result = account_manager.logout(username, hard=hard)
        if hard:
            _wipe_session_data(username)
        return result
    # Logout all
    for u in list(account_manager._clients.keys()):
        account_manager.logout(u, hard=hard)
        if hard:
            _wipe_session_data(u)
    return {"success": True, "message": "Tous les comptes déconnectés" + (" (cookies supprimés)" if hard else "")}


def _wipe_session_data(username: str):
    """Clear stored session_data in DB so stale cookies can't be restored."""
    try:
        username = username.lower()
        accounts = db_proxy.select("bot_accounts", filters={"username": username}, limit=1)
        if accounts:
            db_proxy.update("bot_accounts", accounts[0]["id"], {
                "session_data": None,
                "encrypted_password": None,
            })
            logger.info(f"[AUTH] Wiped session_data for @{username}")
    except Exception as e:
        logger.error(f"[AUTH] Failed to wipe session for @{username}: {e}")


@router.get("/status")
def auth_status(username: Optional[str] = None):
    return account_manager.get_auth_status(username)


## Note: Account listing has been moved to /bot-api/account/list
## Account deletion has been moved to /bot-api/account/{username}
