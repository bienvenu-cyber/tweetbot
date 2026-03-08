import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const { action, prompt, category, tone, count, account_id } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    if (action === 'optimize_prompt') {
      // User gives a rough idea, AI optimizes it into a perfect tweet prompt
      const response = await fetch(LOVABLE_AI_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            {
              role: 'system',
              content: `Tu es un expert en copywriting Twitter/X. L'utilisateur te donne une idée brute. 
Tu dois:
1. Optimiser le prompt pour générer un tweet viral
2. Générer 3 variations du tweet (max 280 chars chacun)
3. Suggérer des hashtags pertinents et populaires

Réponds UNIQUEMENT en JSON valide avec cette structure:
{
  "optimized_prompt": "le prompt optimisé",
  "tweets": ["tweet1", "tweet2", "tweet3"],
  "hashtags": ["#hash1", "#hash2", "#hash3"],
  "tone": "informatif|humoristique|inspirant|provocateur"
}`
            },
            { role: 'user', content: `Idée: ${prompt}\nCatégorie: ${category || 'general'}\nTon souhaité: ${tone || 'auto'}` }
          ],
          tools: [{
            type: "function",
            function: {
              name: "generate_tweet_suggestions",
              description: "Generate optimized tweet suggestions from a rough idea",
              parameters: {
                type: "object",
                properties: {
                  optimized_prompt: { type: "string", description: "The optimized prompt" },
                  tweets: { type: "array", items: { type: "string" }, description: "3 tweet variations" },
                  hashtags: { type: "array", items: { type: "string" }, description: "Relevant hashtags" },
                  tone: { type: "string", enum: ["informatif", "humoristique", "inspirant", "provocateur"] }
                },
                required: ["optimized_prompt", "tweets", "hashtags", "tone"],
                additionalProperties: false
              }
            }
          }],
          tool_choice: { type: "function", function: { name: "generate_tweet_suggestions" } }
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Limite de requêtes atteinte, réessaye dans quelques instants." }), {
            status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Crédits IA épuisés, recharge ton workspace." }), {
            status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        const errText = await response.text();
        throw new Error(`AI error: ${response.status} ${errText}`);
      }

      const aiData = await response.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      let result;
      if (toolCall) {
        result = JSON.parse(toolCall.function.arguments);
      } else {
        // Fallback: try parsing content as JSON
        const content = aiData.choices?.[0]?.message?.content || '{}';
        result = JSON.parse(content);
      }

      // Log generation
      for (const tweet of (result.tweets || [])) {
        await supabase.from('content_generation_log').insert({
          account_id: account_id || null,
          prompt,
          generated_content: tweet,
          ai_optimized_prompt: result.optimized_prompt,
          category: category || 'general',
          hashtags: result.hashtags || [],
          status: 'generated',
        });
      }

      return new Response(JSON.stringify({ success: true, data: result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'random_generate') {
      // Auto-generate based on trending topics / popular hashtags
      const numTweets = count || 5;
      const response = await fetch(LOVABLE_AI_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            {
              role: 'system',
              content: `Tu es un community manager expert Twitter/X. Génère ${numTweets} tweets originaux et engageants.

Règles:
- Chaque tweet fait max 280 caractères
- Utilise des hashtags populaires et tendance actuels
- Varie les catégories: tech, motivation, business, lifestyle, actualité
- Varie les tons: informatif, humoristique, inspirant, provocateur
- Inclus des hooks accrocheurs (questions, stats choc, affirmations bold)
- Certains tweets doivent inciter à l'engagement (questions, sondages, débats)

Réponds UNIQUEMENT via l'outil fourni.`
            },
            { role: 'user', content: `Génère ${numTweets} tweets variés et viraux pour aujourd'hui. Date: ${new Date().toISOString().split('T')[0]}` }
          ],
          tools: [{
            type: "function",
            function: {
              name: "generate_random_tweets",
              description: "Generate random viral tweets",
              parameters: {
                type: "object",
                properties: {
                  tweets: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        content: { type: "string" },
                        category: { type: "string" },
                        hashtags: { type: "array", items: { type: "string" } },
                        tone: { type: "string" }
                      },
                      required: ["content", "category", "hashtags", "tone"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["tweets"],
                additionalProperties: false
              }
            }
          }],
          tool_choice: { type: "function", function: { name: "generate_random_tweets" } }
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Limite de requêtes atteinte." }), {
            status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Crédits IA épuisés." }), {
            status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        const errText = await response.text();
        throw new Error(`AI error: ${response.status} ${errText}`);
      }

      const aiData = await response.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      let result;
      if (toolCall) {
        result = JSON.parse(toolCall.function.arguments);
      } else {
        const content = aiData.choices?.[0]?.message?.content || '{"tweets":[]}';
        result = JSON.parse(content);
      }

      // Save all generated tweets to log
      for (const tweet of (result.tweets || [])) {
        await supabase.from('content_generation_log').insert({
          account_id: account_id || null,
          prompt: 'random_generate',
          generated_content: tweet.content,
          category: tweet.category,
          hashtags: tweet.hashtags || [],
          status: 'generated',
        });
      }

      return new Response(JSON.stringify({ success: true, data: result }), {
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
