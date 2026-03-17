import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-bot-api-key",
};

const TABLES = [
  "bot_accounts",
  "bot_queue",
  "bot_logs",
  "bot_settings",
  "bot_bulk_jobs",
  "bot_scheduled_posts",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Authenticate with BOT_API_KEY
  const apiKey = req.headers.get("x-bot-api-key");
  const expectedKey = Deno.env.get("BOT_API_KEY");
  if (!expectedKey || apiKey !== expectedKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const url = new URL(req.url);
    // Path: /bot-db-proxy/<table>/<optional_id>
    const parts = url.pathname.split("/").filter(Boolean);
    // parts: ["bot-db-proxy", table, maybe_id]
    const table = parts[1];
    const recordId = parts[2] ? decodeURIComponent(parts[2]) : null;

    if (!table || !TABLES.includes(table)) {
      return json({ error: `Invalid table. Allowed: ${TABLES.join(", ")}` }, 400);
    }

    const method = req.method.toUpperCase();

    // GET - Select
    if (method === "GET") {
      let query = supabase.from(table).select("*");

      // Filters from query params
      for (const [key, value] of url.searchParams.entries()) {
        if (key === "limit") {
          query = query.limit(parseInt(value));
        } else if (key === "offset") {
          query = query.range(parseInt(value), parseInt(value) + 999);
        } else if (key === "order") {
          // order=column.desc or order=column.asc
          const [col, dir] = value.split(".");
          query = query.order(col, { ascending: dir !== "desc" });
        } else if (key.endsWith("__eq")) {
          query = query.eq(key.replace("__eq", ""), value);
        } else if (key.endsWith("__neq")) {
          query = query.neq(key.replace("__neq", ""), value);
        } else if (key.endsWith("__lt")) {
          query = query.lt(key.replace("__lt", ""), value);
        } else if (key.endsWith("__lte")) {
          query = query.lte(key.replace("__lte", ""), value);
        } else if (key.endsWith("__gt")) {
          query = query.gt(key.replace("__gt", ""), value);
        } else if (key.endsWith("__gte")) {
          query = query.gte(key.replace("__gte", ""), value);
        } else {
          // Default: exact match
          query = query.eq(key, value);
        }
      }

      if (recordId) {
        query = query.eq("id", recordId).single();
      }

      const { data, error } = await query;
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    // POST - Insert
    if (method === "POST") {
      const body = await req.json();
      const rows = Array.isArray(body) ? body : [body];
      const { data, error } = await supabase.from(table).insert(rows).select();
      if (error) return json({ error: error.message }, 400);
      return json({ data }, 201);
    }

    // PATCH/PUT - Update
    if (method === "PATCH" || method === "PUT") {
      const body = await req.json();
      if (!recordId && !body._filters) {
        return json({ error: "Provide record ID in path or _filters in body" }, 400);
      }

      const filters = body._filters || {};
      delete body._filters;

      let query = supabase.from(table).update(body);

      if (recordId) {
        query = query.eq("id", recordId);
      }
      for (const [k, v] of Object.entries(filters)) {
        query = query.eq(k, v as string);
      }

      const { data, error } = await query.select();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    // DELETE
    if (method === "DELETE") {
      if (!recordId) {
        return json({ error: "Record ID required for DELETE" }, 400);
      }
      const { error } = await supabase.from(table).delete().eq("id", recordId);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
