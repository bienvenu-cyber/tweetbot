import logging
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from instagram_client import account_manager

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
def logout(username: Optional[str] = None):
    if username:
        return account_manager.logout(username)
    return account_manager.logout_all()


@router.get("/status")
def auth_status(username: Optional[str] = None):
    return account_manager.get_auth_status(username)


## Note: Account listing has been moved to /bot-api/account/list
## Account deletion has been moved to /bot-api/account/{username}
