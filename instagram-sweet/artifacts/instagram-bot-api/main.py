import os
import sys
import logging
import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import time

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("instagram_bot")

from database import init_db, SessionLocal, BotSettingsModel
from instagram_client import set_global_proxy
from routers import auth, account, dm, comments, posts, queue, logs, settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=" * 60)
    logger.info("Instagram Bot API v1.0 starting up...")
    logger.info("=" * 60)
    try:
        init_db()
        logger.info("[DB] Database initialized successfully")
    except Exception as e:
        logger.error(f"[DB] Database initialization failed: {e}")

    # Load proxy from DB on startup
    try:
        db = SessionLocal()
        s = db.query(BotSettingsModel).filter(BotSettingsModel.id == 1).first()
        if s and s.proxy_url:
            set_global_proxy(s.proxy_url)
            logger.info(f"[STARTUP] Proxy loaded from DB: {s.proxy_url[:40]}...")
        else:
            logger.warning("[STARTUP] No proxy — using direct US connection")
        db.close()
    except Exception as e:
        logger.error(f"[STARTUP] Failed to load proxy: {e}")

    # Auto-restore Instagram session from saved file
    try:
        from instagram_client import ig_manager, SESSION_FILE
        import json as _json
        if SESSION_FILE.exists():
            with open(SESSION_FILE) as f:
                saved = _json.load(f)
            saved_username = saved.get("username", "")
            if saved_username:
                logger.info(f"[STARTUP] Found saved session for '{saved_username}', restoring...")
                result = ig_manager.resume_session(saved_username)
                if result.get("success"):
                    logger.info(f"[STARTUP] ✓ Auto-resumed session for @{saved_username}")
                else:
                    logger.warning(f"[STARTUP] Session restore failed: {result.get('message')}")
        else:
            logger.info("[STARTUP] No saved session found — user needs to log in")
    except Exception as e:
        logger.error(f"[STARTUP] Auto-resume error: {e}")

    yield
    logger.info("Instagram Bot API shutting down...")


app = FastAPI(title="Instagram Bot API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    logger.info(f"[REQ] {request.method} {request.url.path}")
    try:
        response = await call_next(request)
        duration = (time.time() - start) * 1000
        logger.info(f"[RES] {request.method} {request.url.path} -> {response.status_code} ({duration:.0f}ms)")
        return response
    except Exception as e:
        duration = (time.time() - start) * 1000
        logger.error(f"[ERR] {request.method} {request.url.path} -> {e} ({duration:.0f}ms)")
        return JSONResponse(status_code=500, content={"detail": str(e)})


app.include_router(auth.router, prefix="/bot-api/auth", tags=["auth"])
app.include_router(account.router, prefix="/bot-api/account", tags=["account"])
app.include_router(dm.router, prefix="/bot-api/dm", tags=["dm"])
app.include_router(comments.router, prefix="/bot-api/comments", tags=["comments"])
app.include_router(posts.router, prefix="/bot-api/posts", tags=["posts"])
app.include_router(queue.router, prefix="/bot-api/queue", tags=["queue"])
app.include_router(logs.router, prefix="/bot-api/logs", tags=["logs"])
app.include_router(settings.router, prefix="/bot-api/settings", tags=["settings"])


@app.get("/bot-api/health")
def health():
    from database import SessionLocal, LogEntry
    from instagram_client import get_global_proxy
    try:
        db = SessionLocal()
        count = db.query(LogEntry).count()
        db.close()
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {e}"
    return {
        "status": "ok",
        "db": db_status,
        "proxy_configured": bool(get_global_proxy()),
    }


if __name__ == "__main__":
    port = int(os.environ.get("BOT_PORT", 8000))
    logger.info(f"Starting server on port {port}")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True, log_level="info")
