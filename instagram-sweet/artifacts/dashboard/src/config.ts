// Bot API configuration
// In production (Vercel), calls go directly to the Railway bot.
// In development, calls go through Vite proxy or directly.
export const BOT_API_URL = import.meta.env.VITE_BOT_API_URL || "https://tweetbot1.up.railway.app";
export const BOT_API_BASE = `${BOT_API_URL}/bot-api`;

// WebSocket URL derived from the bot API URL
export function getBotWsUrl(path: string): string {
  const url = new URL(BOT_API_URL);
  const protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${url.host}/bot-api${path}`;
}
