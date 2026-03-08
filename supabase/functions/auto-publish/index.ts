import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

function percentEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/\*/g, '%2A')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
}

async function generateOAuthHeader(
  method: string,
  url: string,
  consumerKey: string,
  consumerSecret: string,
  accessToken: string,
  accessTokenSecret: string,
): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: accessToken,
    oauth_version: '1.0',
  };
  const sortedKeys = Object.keys(oauthParams).sort();
  const paramString = sortedKeys.map(k => `${percentEncode(k)}=${percentEncode(oauthParams[k])}`).join('&');
  const signatureBase = `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(paramString)}`;
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(accessTokenSecret)}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(signingKey), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signatureBase));
  const signature = btoa(String.fromCharCode(...new Uint8Array(sig)));
  oauthParams['oauth_signature'] = signature;
  const headerString = Object.keys(oauthParams).sort().map(k => `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`).join(', ');
  return `OAuth ${headerString}`;
}

async function postTweet(content: string, account: { consumer_key: string; consumer_secret: string; access_token: string; access_token_secret: string }) {
  const url = 'https://api.x.com/2/tweets';
  const authHeader = await generateOAuthHeader('POST', url, account.consumer_key, account.consumer_secret, account.access_token, account.access_token_secret);
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: content }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Twitter API error [${response.status}]: ${JSON.stringify(data)}`);
  return data;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    // Step 1: Get active accounts
    const { data: accounts, error: accErr } = await supabase
      .from('twitter_accounts')
      .select('*')
      .eq('is_active', true);

    if (accErr || !accounts?.length) {
      // Fallback: use env vars if no accounts in DB
      const ck = Deno.env.get('TWITTER_CONSUMER_KEY');
      const cs = Deno.env.get('TWITTER_CONSUMER_SECRET');
      const at = Deno.env.get('TWITTER_ACCESS_TOKEN');
      const ats = Deno.env.get('TWITTER_ACCESS_TOKEN_SECRET');
      
      if (!ck || !cs || !at || !ats) {
        return new Response(JSON.stringify({ error: 'No active accounts and no env credentials' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Use env-based account
      const envAccount = { id: null, consumer_key: ck, consumer_secret: cs, access_token: at, access_token_secret: ats };
      await processAccount(supabase, envAccount, LOVABLE_API_KEY);

      return new Response(JSON.stringify({ success: true, message: 'Published via env credentials' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Process each active account
    const results = [];
    for (const account of accounts) {
      try {
        const result = await processAccount(supabase, account, LOVABLE_API_KEY);
        results.push({ account: account.name, ...result });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        results.push({ account: account.name, error: msg });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Auto-publish error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function processAccount(supabase: ReturnType<typeof createClient>, account: any, lovableApiKey: string | undefined) {
  // Strategy 1: Check for scheduled tweets that are due
  const { data: scheduled } = await supabase
    .from('scheduled_tweets')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(1);

  if (scheduled?.length) {
    const tweet = scheduled[0];
    try {
      const result = await postTweet(tweet.content, account);
      await supabase.from('scheduled_tweets').update({
        status: 'posted',
        tweet_id: result.data?.id,
      }).eq('id', tweet.id);
      return { action: 'posted_scheduled', tweet_id: result.data?.id };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      await supabase.from('scheduled_tweets').update({
        status: 'failed',
        error_message: msg,
      }).eq('id', tweet.id);
      throw err;
    }
  }

  // Strategy 2: Pick a template with rotation (least recently used)
  const { data: templates } = await supabase
    .from('tweet_templates')
    .select('*')
    .eq('is_active', true)
    .or(account.id ? `account_id.eq.${account.id},account_id.is.null` : 'account_id.is.null')
    .order('last_used_at', { ascending: true, nullsFirst: true })
    .order('use_count', { ascending: true })
    .limit(1);

  if (templates?.length) {
    const template = templates[0];
    const content = template.hashtags?.length
      ? `${template.content} ${template.hashtags.join(' ')}`
      : template.content;

    const result = await postTweet(content, account);

    // Update template usage
    await supabase.from('tweet_templates').update({
      last_used_at: new Date().toISOString(),
      use_count: (template.use_count || 0) + 1,
    }).eq('id', template.id);

    // Log in scheduled_tweets
    await supabase.from('scheduled_tweets').insert({
      content,
      status: 'posted',
      tweet_id: result.data?.id,
      account_id: account.id || null,
      category: template.category,
    });

    return { action: 'posted_template', template_id: template.id, tweet_id: result.data?.id };
  }

  // Strategy 3: AI-generate if no templates available and AI key exists
  if (lovableApiKey) {
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `Génère UN seul tweet viral et engageant (max 280 chars). Inclus 1-2 hashtags populaires. Varie entre: tech, motivation, business, lifestyle. Réponds UNIQUEMENT avec le texte du tweet, rien d'autre.`
          },
          { role: 'user', content: `Génère un tweet pour ${new Date().toISOString()}` }
        ],
      }),
    });

    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      const tweetContent = aiData.choices?.[0]?.message?.content?.trim();
      
      if (tweetContent && tweetContent.length <= 280) {
        const result = await postTweet(tweetContent, account);

        await supabase.from('scheduled_tweets').insert({
          content: tweetContent,
          status: 'posted',
          tweet_id: result.data?.id,
          account_id: account.id || null,
          category: 'ai_generated',
        });

        await supabase.from('content_generation_log').insert({
          account_id: account.id || null,
          prompt: 'auto_cron',
          generated_content: tweetContent,
          status: 'published',
          published_at: new Date().toISOString(),
          tweet_id: result.data?.id,
        });

        return { action: 'posted_ai', tweet_id: result.data?.id };
      }
    }
  }

  return { action: 'nothing_to_post' };
}
