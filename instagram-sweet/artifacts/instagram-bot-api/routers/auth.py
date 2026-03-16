import logging
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, Dict
from instagram_client import ig_manager

logger = logging.getLogger("instagram_bot")
router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


class ChallengeCodeRequest(BaseModel):
    code: str


class CookieImportRequest(BaseModel):
    # Paste the full cookie string from browser DevTools OR individual fields
    cookie_string: Optional[str] = None  # e.g. "sessionid=abc; csrftoken=xyz; ds_user_id=123"
    sessionid: Optional[str] = None
    csrftoken: Optional[str] = None
    ds_user_id: Optional[str] = None
    mid: Optional[str] = None
    ig_did: Optional[str] = None
    rur: Optional[str] = None
    username: Optional[str] = None  # provide if known


@router.post("/login")
def login(req: LoginRequest):
    logger.info(f"[AUTH] Login endpoint called for '{req.username}'")
    result = ig_manager.login(req.username, req.password)
    logger.info(f"[AUTH] Login result: success={result.get('success')}, challenge={result.get('challenge', False)}")
    return result


@router.post("/challenge")
def submit_challenge(req: ChallengeCodeRequest):
    logger.info(f"[AUTH] Challenge code submission")
    return ig_manager.submit_challenge_code(req.code)


@router.post("/import-cookies")
def import_cookies(req: CookieImportRequest):
    """
    Import cookies from a browser session. 
    The user logs in from their own device (trusted by Instagram),
    then copies the cookies here. This bypasses geo-blocking completely.
    """
    logger.info(f"[AUTH] Cookie import request for username='{req.username}'")
    return ig_manager.login_with_cookies(
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
def logout():
    logger.info("[AUTH] Logout endpoint called")
    ig_manager.logout()
    return {"success": True, "message": "Déconnecté avec succès"}


@router.get("/status")
def auth_status():
    return ig_manager.get_auth_status()
