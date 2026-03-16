import os
import json
import time
import logging
from typing import Optional
from instagrapi import Client
from instagrapi.exceptions import (
    LoginRequired,
    BadPassword,
    TwoFactorRequired,
    ChallengeRequired,
    UserNotFound,
    ClientError,
    ReloginAttemptExceeded,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("instagram_bot")

_proxy_url: Optional[str] = None


def set_global_proxy(proxy: Optional[str]):
    global _proxy_url
    _proxy_url = proxy.strip() if proxy and proxy.strip() else None
    logger.info(f"[PROXY] Proxy configured: {'YES (' + _proxy_url[:40] + '...)' if _proxy_url else 'NONE (direct US connection)'}")


def get_global_proxy() -> Optional[str]:
    return _proxy_url


def _parse_cookie_string(cookie_str: str) -> dict:
    cookies = {}
    for part in cookie_str.split(";"):
        part = part.strip()
        if "=" in part:
            k, _, v = part.partition("=")
            cookies[k.strip()] = v.strip()
    return cookies


class InstagramClientManager:
    def __init__(self):
        self._client: Optional[Client] = None
        self._username: Optional[str] = None
        self._logged_in: bool = False
        self._pending_challenge: bool = False

    def _create_client(self) -> Client:
        cl = Client()
        cl.delay_range = [1, 3]
        cl.set_locale("fr_BJ")
        cl.set_timezone_offset(3600)
        if _proxy_url:
            logger.info(f"[CLIENT] Setting proxy: {_proxy_url[:50]}...")
            cl.set_proxy(_proxy_url)
        else:
            logger.info("[CLIENT] No proxy — direct connection (server IP: USA)")
        return cl

    # ---- Session persistence via DB ----

    def _load_session_from_db(self, cl: Client, username: str) -> bool:
        try:
            from database import SessionLocal, InstagramSession
            db = SessionLocal()
            try:
                row = db.query(InstagramSession).filter(
                    InstagramSession.username == username.lower()
                ).first()
                if not row:
                    return False
                session_data = json.loads(row.session_data)
                logger.info(f"[SESSION-DB] Found saved session for {username}")
                cl.set_settings(session_data.get("settings", {}))
                cl.login(username, "")
                logger.info(f"[SESSION-DB] Session restored OK for {username}")
                return True
            finally:
                db.close()
        except Exception as e:
            logger.warning(f"[SESSION-DB] Failed to load: {e}")
        return False

    def _save_session_to_db(self, cl: Client, username: str):
        try:
            from database import SessionLocal, InstagramSession
            db = SessionLocal()
            try:
                session_json = json.dumps({"username": username, "settings": cl.get_settings()}, default=str)
                row = db.query(InstagramSession).filter(
                    InstagramSession.username == username.lower()
                ).first()
                if row:
                    row.session_data = session_json
                else:
                    db.add(InstagramSession(username=username.lower(), session_data=session_json))
                db.commit()
                logger.info(f"[SESSION-DB] Saved session for {username}")
            finally:
                db.close()
        except Exception as e:
            logger.error(f"[SESSION-DB] Failed to save: {e}")

    def _delete_session_from_db(self, username: Optional[str] = None):
        try:
            from database import SessionLocal, InstagramSession
            db = SessionLocal()
            try:
                q = db.query(InstagramSession)
                if username:
                    q = q.filter(InstagramSession.username == username.lower())
                q.delete()
                db.commit()
            finally:
                db.close()
        except Exception as e:
            logger.warning(f"[SESSION-DB] Failed to delete: {e}")

    def login(self, username: str, password: str) -> dict:
        username = username.strip().lstrip("@").lower()
        logger.info(f"[LOGIN] Login request for '{username}'")
        logger.info(f"[LOGIN] Proxy: {'set' if _proxy_url else 'NONE (geo-block risk)'}")

        self._pending_challenge = False
        cl = self._create_client()

        # Try restoring session from DB first
        if self._load_session_from_db(cl, username):
            try:
                cl.get_timeline_feed()
                self._client = cl
                self._username = username
                self._logged_in = True
                logger.info(f"[LOGIN] Session still valid for {username}")
                return {"success": True, "message": "Session reprise avec succès", "username": username, "requires_2fa": False}
            except (LoginRequired, Exception) as e:
                logger.warning(f"[LOGIN] Session expired: {e}, doing fresh login")
                self._delete_session_from_db(username)
                cl = self._create_client()

        logger.info(f"[LOGIN] Attempting fresh login for '{username}'")
        try:
            cl.login(username, password)
            self._save_session_to_db(cl, username)
            self._client = cl
            self._username = username
            # Password NOT stored — cleared after login
            self._logged_in = True
            self._pending_challenge = False
            logger.info(f"[LOGIN] SUCCESS for {username}")
            return {"success": True, "message": "Connecté avec succès", "username": username, "requires_2fa": False}

        except TwoFactorRequired:
            logger.warning(f"[LOGIN] 2FA required for {username}")
            return {"success": False, "message": "2FA activé — désactive-le temporairement.", "username": username, "requires_2fa": True}

        except BadPassword:
            logger.warning(f"[LOGIN] Bad password for {username}")
            return {"success": False, "message": "Mot de passe incorrect.", "username": username, "requires_2fa": False}

        except ChallengeRequired as e:
            logger.warning(f"[LOGIN] CHALLENGE REQUIRED — likely geo-block (server=USA, account=Benin)")
            self._client = cl
            self._username = username
            self._pending_challenge = True

            challenge_type = "approve"
            try:
                last_json = cl.last_json if hasattr(cl, "last_json") and cl.last_json else {}
                cl.challenge_resolve(last_json)
                challenge_type = "code"
                logger.info("[CHALLENGE] Verification code sent to phone/email")
            except Exception as ce:
                logger.warning(f"[CHALLENGE] Auto-resolve failed: {ce}")

            return {
                "success": False,
                "message": "Instagram bloque la connexion depuis les USA. Approuve depuis l'app OU importe tes cookies de session.",
                "username": username,
                "requires_2fa": False,
                "challenge": True,
                "challenge_type": challenge_type,
                "geo_blocked": not bool(_proxy_url),
            }

        except ReloginAttemptExceeded:
            logger.error(f"[LOGIN] Too many attempts for {username}")
            return {"success": False, "message": "Trop de tentatives. Attends quelques minutes.", "username": username, "requires_2fa": False}

        except Exception as e:
            err_str = str(e)
            logger.error(f"[LOGIN] Error: {type(e).__name__}: {err_str}")
            if "can't find an account" in err_str.lower():
                return {"success": False, "message": f"Compte '{username}' introuvable. Vérifie l'username exact.", "username": username, "requires_2fa": False}
            return {"success": False, "message": err_str, "username": username, "requires_2fa": False}

    def login_with_cookies(
        self,
        cookie_string: Optional[str] = None,
        sessionid: Optional[str] = None,
        csrftoken: Optional[str] = None,
        ds_user_id: Optional[str] = None,
        mid: Optional[str] = None,
        ig_did: Optional[str] = None,
        rur: Optional[str] = None,
        username: Optional[str] = None,
    ) -> dict:
        logger.info("[COOKIE-LOGIN] Cookie import login attempt")
        cookies: dict = {}

        if cookie_string:
            logger.info("[COOKIE-LOGIN] Parsing cookie string from browser")
            cookies = _parse_cookie_string(cookie_string)
        else:
            if sessionid:
                cookies["sessionid"] = sessionid
            if csrftoken:
                cookies["csrftoken"] = csrftoken
            if ds_user_id:
                cookies["ds_user_id"] = ds_user_id
            if mid:
                cookies["mid"] = mid

        if not cookies.get("sessionid"):
            logger.error("[COOKIE-LOGIN] sessionid is required")
            return {"success": False, "message": "Le cookie 'sessionid' est requis. Copie-le depuis ton navigateur."}

        logger.info(f"[COOKIE-LOGIN] Got cookies: {list(cookies.keys())}")
        cl = self._create_client()

        settings = cl.get_settings()
        settings["cookies"] = cookies
        if mid:
            settings["mid"] = mid
        if ig_did:
            settings["uuids"] = settings.get("uuids", {})
            settings["uuids"]["ig_did"] = ig_did
        if rur:
            settings["ig_u_rur"] = rur

        try:
            cl.set_settings(settings)
            logger.info("[COOKIE-LOGIN] Settings injected, verifying session...")
            cl.login(username or cookies.get("ds_user_id", ""), "")
        except Exception as e:
            logger.warning(f"[COOKIE-LOGIN] login() call failed, trying direct account fetch: {e}")

        try:
            user_info = cl.account_info()
            actual_username = user_info.username
            self._save_session_to_db(cl, actual_username)
            self._client = cl
            self._username = actual_username
            self._logged_in = True
            self._pending_challenge = False
            logger.info(f"[COOKIE-LOGIN] SUCCESS — logged in as @{actual_username}")
            return {
                "success": True,
                "message": f"Connecté avec succès via cookies (compte: @{actual_username})",
                "username": actual_username,
                "requires_2fa": False,
            }
        except Exception as e:
            logger.error(f"[COOKIE-LOGIN] Failed to verify session: {e}")
            return {
                "success": False,
                "message": f"Cookies invalides ou expirés. Assure-toi d'être connecté sur Instagram dans ton navigateur et de copier les cookies frais. Erreur: {e}",
            }

    def submit_challenge_code(self, code: str) -> dict:
        if not self._pending_challenge or not self._client:
            return {"success": False, "message": "Aucun challenge en attente. Relance la connexion d'abord."}
        logger.info(f"[CHALLENGE] Submitting code for {self._username}")
        try:
            self._client.challenge_resolve(self._client.last_json, code)
            self._save_session_to_db(self._client, self._username)
            self._logged_in = True
            self._pending_challenge = False
            logger.info(f"[CHALLENGE] Code accepted for {self._username}")
            return {"success": True, "message": "Code accepté — connecté avec succès.", "username": self._username}
        except Exception as e:
            logger.error(f"[CHALLENGE] Code rejected: {e}")
            return {"success": False, "message": f"Code invalide ou expiré: {e}"}

    def resume_session(self, username: str) -> dict:
        """Resume a session from DB on startup."""
        cl = self._create_client()
        if self._load_session_from_db(cl, username):
            try:
                cl.get_timeline_feed()
                self._client = cl
                self._username = username
                self._logged_in = True
                return {"success": True, "message": f"Session restored for {username}"}
            except Exception as e:
                logger.warning(f"[RESUME] Session expired: {e}")
                self._delete_session_from_db(username)
        return {"success": False, "message": "No valid session found"}

    def logout(self):
        logger.info(f"[LOGOUT] Logging out {self._username}")
        if self._client:
            try:
                self._client.logout()
            except Exception as e:
                logger.warning(f"[LOGOUT] Error: {e}")
        self._delete_session_from_db(self._username)
        self._client = None
        self._username = None
        self._logged_in = False
        self._pending_challenge = False
        logger.info("[LOGOUT] Done")

    def get_client(self) -> Optional[Client]:
        return self._client if self._logged_in else None

    def is_logged_in(self) -> bool:
        return self._logged_in and self._client is not None

    def get_username(self) -> Optional[str]:
        return self._username

    def get_auth_status(self) -> dict:
        if not self.is_logged_in():
            return {"logged_in": False, "pending_challenge": self._pending_challenge}
        try:
            user = self._client.account_info()
            return {
                "logged_in": True,
                "username": user.username,
                "full_name": user.full_name,
                "profile_pic_url": str(user.profile_pic_url) if user.profile_pic_url else None,
                "followers": user.follower_count,
                "following": user.following_count,
            }
        except Exception as e:
            logger.error(f"[STATUS] Error: {e}")
            self._logged_in = False
            return {"logged_in": False}


ig_manager = InstagramClientManager()
