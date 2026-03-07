-- Create table for scheduled/sent tweets
CREATE TABLE public.scheduled_tweets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  reply_to_tweet_id TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'posted', 'failed')),
  tweet_id TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduled_tweets ENABLE ROW LEVEL SECURITY;

-- Allow all access (single-user bot dashboard)
CREATE POLICY "Allow all access to scheduled_tweets" ON public.scheduled_tweets FOR ALL USING (true) WITH CHECK (true);

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_scheduled_tweets_updated_at
  BEFORE UPDATE ON public.scheduled_tweets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();