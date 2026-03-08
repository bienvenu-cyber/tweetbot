
-- Twitter accounts table for multi-account support
CREATE TABLE public.twitter_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  username text,
  consumer_key text NOT NULL,
  consumer_secret text NOT NULL,
  access_token text NOT NULL,
  access_token_secret text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.twitter_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to twitter_accounts" ON public.twitter_accounts FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER update_twitter_accounts_updated_at
  BEFORE UPDATE ON public.twitter_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tweet templates table with categories
CREATE TABLE public.tweet_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.twitter_accounts(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'general',
  content text NOT NULL,
  hashtags text[] DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  use_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tweet_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to tweet_templates" ON public.tweet_templates FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER update_tweet_templates_updated_at
  BEFORE UPDATE ON public.tweet_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Content generation log
CREATE TABLE public.content_generation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.twitter_accounts(id) ON DELETE SET NULL,
  prompt text,
  generated_content text NOT NULL,
  ai_optimized_prompt text,
  status text NOT NULL DEFAULT 'generated',
  category text DEFAULT 'general',
  hashtags text[] DEFAULT '{}',
  published_at timestamptz,
  tweet_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.content_generation_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to content_generation_log" ON public.content_generation_log FOR ALL USING (true) WITH CHECK (true);

-- Add account_id to scheduled_tweets for multi-account
ALTER TABLE public.scheduled_tweets ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.twitter_accounts(id) ON DELETE SET NULL;

-- Add category column to scheduled_tweets
ALTER TABLE public.scheduled_tweets ADD COLUMN IF NOT EXISTS category text DEFAULT 'general';
