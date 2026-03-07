import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function percentEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/\*/g, '%2A')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
}

function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): string {
  const sortedKeys = Object.keys(params).sort();
  const paramString = sortedKeys.map(k => `${percentEncode(k)}=${percentEncode(params[k])}`).join('&');
  const signatureBase = `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(paramString)}`;
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
  
  const encoder = new TextEncoder();
  const keyData = encoder.encode(signingKey);
  const messageData = encoder.encode(signatureBase);
  
  // Use Web Crypto API for HMAC-SHA1
  return "";  // placeholder, we'll use a different approach
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

  // Create signature base string (no POST body params for JSON requests)
  const sortedKeys = Object.keys(oauthParams).sort();
  const paramString = sortedKeys.map(k => `${percentEncode(k)}=${percentEncode(oauthParams[k])}`).join('&');
  const signatureBase = `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(paramString)}`;
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(accessTokenSecret)}`;

  // HMAC-SHA1
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(signingKey),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signatureBase));
  const signature = btoa(String.fromCharCode(...new Uint8Array(sig)));

  oauthParams['oauth_signature'] = signature;

  const headerString = Object.keys(oauthParams)
    .sort()
    .map(k => `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`)
    .join(', ');

  return `OAuth ${headerString}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const consumerKey = Deno.env.get('TWITTER_CONSUMER_KEY');
    const consumerSecret = Deno.env.get('TWITTER_CONSUMER_SECRET');
    const accessToken = Deno.env.get('TWITTER_ACCESS_TOKEN');
    const accessTokenSecret = Deno.env.get('TWITTER_ACCESS_TOKEN_SECRET');

    if (!consumerKey || !consumerSecret || !accessToken || !accessTokenSecret) {
      return new Response(
        JSON.stringify({ error: 'Twitter API credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, content, reply_to_tweet_id, tweet_db_id } = await req.json();

    const TWITTER_API = 'https://api.x.com/2';

    if (action === 'post_tweet') {
      const url = `${TWITTER_API}/tweets`;
      const body: Record<string, unknown> = { text: content };
      if (reply_to_tweet_id) {
        body.reply = { in_reply_to_tweet_id: reply_to_tweet_id };
      }

      const authHeader = await generateOAuthHeader(
        'POST', url, consumerKey, consumerSecret, accessToken, accessTokenSecret
      );

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        // Update DB status to failed
        if (tweet_db_id) {
          const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
          );
          await supabase.from('scheduled_tweets').update({
            status: 'failed',
            error_message: JSON.stringify(data),
          }).eq('id', tweet_db_id);
        }
        throw new Error(`Twitter API error [${response.status}]: ${JSON.stringify(data)}`);
      }

      // Update DB with success
      if (tweet_db_id) {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        await supabase.from('scheduled_tweets').update({
          status: 'posted',
          tweet_id: data.data?.id,
        }).eq('id', tweet_db_id);
      }

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get_me') {
      const url = `${TWITTER_API}/users/me`;
      const authHeader = await generateOAuthHeader(
        'GET', url, consumerKey, consumerSecret, accessToken, accessTokenSecret
      );
      const response = await fetch(url, {
        headers: { 'Authorization': authHeader },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(`Twitter API error [${response.status}]: ${JSON.stringify(data)}`);
      }
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
