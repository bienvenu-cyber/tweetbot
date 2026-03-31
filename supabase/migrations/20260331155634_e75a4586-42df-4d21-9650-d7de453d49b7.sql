ALTER TABLE public.bot_accounts 
  ADD COLUMN IF NOT EXISTS warmup_status text DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS warmup_started_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS warmup_day integer DEFAULT 0;