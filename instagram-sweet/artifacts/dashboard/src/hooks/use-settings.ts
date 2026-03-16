import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BASE_URL = "/api/bot-api";

export interface BotSettings {
  dm_daily_limit: number;
  dm_delay_min: number;
  dm_delay_max: number;
  comment_daily_limit: number;
  comment_delay_min: number;
  comment_delay_max: number;
  post_daily_limit: number;
  auto_dm_enabled: boolean;
  auto_comment_enabled: boolean;
  proxy_url?: string;
  proxy_active?: boolean;
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async (): Promise<BotSettings> => {
      const res = await fetch(`${BASE_URL}/settings`);
      if (!res.ok) throw new Error("Failed to fetch settings");
      return res.json();
    },
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: BotSettings): Promise<BotSettings> => {
      const res = await fetch(`${BASE_URL}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update settings");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings"] }),
  });
}

export function useTestProxy() {
  return useMutation({
    mutationFn: async (): Promise<{ success: boolean; message: string; ip?: string }> => {
      const res = await fetch(`${BASE_URL}/settings/proxy/test`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to test proxy");
      return res.json();
    },
  });
}
