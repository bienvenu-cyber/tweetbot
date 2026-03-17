// Bot API configuration
// In production (Vercel), calls go directly to the Railway bot.
// In development, calls go through Vite proxy or directly.
export const BOT_API_URL = import.meta.env.VITE_BOT_API_URL || "https://tweetbot1.up.railway.app";
export const BOT_API_BASE = `${BOT_API_URL}/bot-api`;
export const BOT_API_KEY = import.meta.env.VITE_BOT_API_KEY || "";

// WebSocket URL derived from the bot API URL
export function getBotWsUrl(path: string): string {
  const url = new URL(BOT_API_URL);
  const protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${url.host}/bot-api${path}`;
}

/**
 * Authenticated fetch wrapper — automatically adds X-API-Key header.
 */
export async function apiFetch(
  url: string,
  options: RequestInit = {},
  timeoutMs = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  if (BOT_API_KEY) {
    headers["X-API-Key"] = BOT_API_KEY;
  }

  try {
    return await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}
