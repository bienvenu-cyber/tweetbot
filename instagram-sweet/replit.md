# Instagram Bot Dashboard

## Overview

Full-stack Instagram automation bot with a React dashboard and Python FastAPI backend. Connects to Instagram via username/password (no official API required) using instagrapi.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5 (Node.js proxy) + FastAPI (Python bot)
- **Database**: PostgreSQL + SQLAlchemy (Python) + Drizzle ORM (Node.js)
- **Validation**: Zod (`zod/v4`), Pydantic
- **API codegen**: Orval (from OpenAPI spec)
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
- **Python version**: 3.11

## Architecture

```
Browser
  └── / (dashboard frontend — React/Vite on port 23183)
  └── /api/* (Node.js Express on port 8080)
        └── /api/bot-api/* ──proxy──> Python FastAPI (port 8000)
        └── /api/healthz, etc. (Express routes)
```

## Structure

```text
artifacts/
├── dashboard/            # React + Vite frontend dashboard
├── api-server/           # Express 5 API server (proxy + health)
├── instagram-bot-api/    # Python FastAPI + instagrapi backend
│   ├── main.py           # FastAPI app entry point
│   ├── database.py       # SQLAlchemy models + DB connection
│   ├── instagram_client.py # instagrapi session manager
│   └── routers/          # Route handlers
│       ├── auth.py       # Login, logout, status
│       ├── account.py    # Account info
│       ├── dm.py         # DMs (send, bulk send, threads)
│       ├── comments.py   # Post comments
│       ├── posts.py      # Create posts
│       ├── queue.py      # Action queue
│       ├── logs.py       # Activity logs
│       └── settings.py   # Bot settings
lib/
├── api-spec/             # OpenAPI spec + Orval codegen config
├── api-client-react/     # Generated React Query hooks
├── api-zod/              # Generated Zod schemas
└── db/                   # Drizzle ORM schema + DB connection
```

## Instagram Bot Features

- **Login**: Username + password via instagrapi (no Meta API needed)
- **Session persistence**: Saves cookies/session to `/tmp/instagram_session.json`
- **Geo-blocking handling**: Challenge UI with "I approved it - Retry" flow; detailed logs explain IP mismatch
- **Proxy support**: Configure SOCKS5/HTTP proxy in Settings to bypass geo-blocking (stored in DB, loaded on startup)
- **DMs**: Send single DMs, bulk send with configurable delays (anti-spam)
- **Comments**: Comment on posts by URL with daily limits
- **Posts**: Upload photos with captions
- **Anti-spam**: Daily limits + random delays for all actions
- **Queue**: Track pending/queued actions
- **Logs**: Full activity log with filtering
- **Settings**: Configure all rate limits, daily limits, and proxy URL

## Known Issues & Workarounds

- **Instagram geo-blocking**: Replit servers are in North Charleston, South Carolina (USA). If the Instagram account is normally used from Africa/Europe, Instagram triggers a security challenge. Fix: configure a SOCKS5 proxy in Settings, OR approve the connection from the Instagram mobile app when the challenge appears.
- **Correct account**: `iamviral304` (not `iamviral309` — that account does not exist)
- **Challenge flow**: When challenge appears, user opens Instagram app, taps "It was me", then clicks "J'ai approuvé" in the dashboard to retry

## API Endpoints (via /api/bot-api/*)

- `GET /auth/status` — check if logged in
- `POST /auth/login` — login with username/password
- `POST /auth/logout` — logout
- `GET /account` — account info
- `GET /dm/threads` — inbox threads
- `POST /dm/send` — send single DM
- `POST /dm/bulk-send` — bulk send with rate limiting
- `POST /comments/post` — comment on a post
- `POST /posts/create` — create a post
- `GET /queue` — action queue
- `DELETE /queue/{id}` — delete queue item
- `GET /logs` — activity logs
- `GET /settings` — bot settings
- `PUT /settings` — update settings (includes proxy_url)
- `POST /settings/proxy/test` — test proxy connectivity
- `POST /auth/challenge` — submit Instagram verification code

## Workflows

- `Instagram Bot Python API` — Python FastAPI on port 8000
- `artifacts/api-server: API Server` — Node.js Express on port 8080
- `artifacts/dashboard: web` — Vite dev server on port 23183

## Running the Python Backend

```bash
cd artifacts/instagram-bot-api && python main.py
```

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build`
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly`
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API clients

## Important Notes

- Instagram session is saved in `/tmp/instagram_session.json` — it persists between restarts
- The bot respects daily limits configured in settings
- All actions are logged to the `bot_logs` PostgreSQL table
- Use a secondary/test Instagram account first to avoid bans
