
-- Bot Instagram tables for the Python bot API
-- These mirror the SQLAlchemy models in database.py

-- bot_accounts: multi-account Instagram management
CREATE TABLE public.bot_accounts (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    encrypted_password TEXT,
    session_data TEXT,
    is_active BOOLEAN DEFAULT true,
    is_logged_in BOOLEAN DEFAULT false,
    last_login_at TIMESTAMPTZ,
    last_action_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- bot_queue: action queue (DMs, comments, etc.)
CREATE TABLE public.bot_queue (
    id SERIAL PRIMARY KEY,
    action_type VARCHAR(50) NOT NULL,
    target VARCHAR(255) NOT NULL,
    payload TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    scheduled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    processed_at TIMESTAMPTZ
);

-- bot_logs: activity logs
CREATE TABLE public.bot_logs (
    id SERIAL PRIMARY KEY,
    action_type VARCHAR(50) NOT NULL,
    target VARCHAR(255),
    status VARCHAR(20) NOT NULL,
    message TEXT,
    account_username VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- bot_settings: singleton config row
CREATE TABLE public.bot_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    dm_daily_limit INTEGER DEFAULT 50,
    dm_delay_min INTEGER DEFAULT 30,
    dm_delay_max INTEGER DEFAULT 120,
    comment_daily_limit INTEGER DEFAULT 30,
    comment_delay_min INTEGER DEFAULT 20,
    comment_delay_max INTEGER DEFAULT 90,
    post_daily_limit INTEGER DEFAULT 3,
    auto_dm_enabled BOOLEAN DEFAULT false,
    auto_comment_enabled BOOLEAN DEFAULT false,
    proxy_url VARCHAR(500)
);

-- bot_bulk_jobs: bulk action tracking
CREATE TABLE public.bot_bulk_jobs (
    id SERIAL PRIMARY KEY,
    job_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'running',
    total INTEGER DEFAULT 0,
    processed INTEGER DEFAULT 0,
    succeeded INTEGER DEFAULT 0,
    failed INTEGER DEFAULT 0,
    message TEXT,
    account_username VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- bot_scheduled_posts: scheduled post publishing
CREATE TABLE public.bot_scheduled_posts (
    id SERIAL PRIMARY KEY,
    account_username VARCHAR(100) NOT NULL,
    image_url TEXT NOT NULL,
    caption TEXT NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    published_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX idx_bot_queue_status ON public.bot_queue(status);
CREATE INDEX idx_bot_logs_created ON public.bot_logs(created_at DESC);
CREATE INDEX idx_bot_scheduled_posts_status ON public.bot_scheduled_posts(status, scheduled_at);
CREATE INDEX idx_bot_bulk_jobs_status ON public.bot_bulk_jobs(status);

-- Auto-update updated_at triggers
CREATE TRIGGER update_bot_accounts_updated_at
    BEFORE UPDATE ON public.bot_accounts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bot_bulk_jobs_updated_at
    BEFORE UPDATE ON public.bot_bulk_jobs
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default settings
INSERT INTO public.bot_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- RLS: These tables are accessed by the Python bot via DATABASE_URL (service role),
-- NOT via the Supabase JS client. Disable RLS so the bot can CRUD freely.
-- The bot API is protected by its own API key middleware.
ALTER TABLE public.bot_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_bulk_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_scheduled_posts ENABLE ROW LEVEL SECURITY;

-- Service role bypass policies (the bot connects with the DB connection string which uses the postgres role)
-- The postgres role bypasses RLS, so these policies are for the anon/authenticated roles if needed later
CREATE POLICY "Bot tables: service access only" ON public.bot_accounts FOR ALL USING (false);
CREATE POLICY "Bot tables: service access only" ON public.bot_queue FOR ALL USING (false);
CREATE POLICY "Bot tables: service access only" ON public.bot_logs FOR ALL USING (false);
CREATE POLICY "Bot tables: service access only" ON public.bot_settings FOR ALL USING (false);
CREATE POLICY "Bot tables: service access only" ON public.bot_bulk_jobs FOR ALL USING (false);
CREATE POLICY "Bot tables: service access only" ON public.bot_scheduled_posts FOR ALL USING (false);
