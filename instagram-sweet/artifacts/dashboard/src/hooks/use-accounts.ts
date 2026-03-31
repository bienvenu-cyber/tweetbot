import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BOT_API_BASE, apiFetch } from "@/config";

export interface BotAccount {
  id: number;
  username: string;
  is_active: boolean;
  is_logged_in: boolean;
  last_login_at: string | null;
  last_action_at: string | null;
  created_at: string;
  proxy_url: string | null;
  device: string | null;
  warmup_status: "idle" | "active" | "completed";
  warmup_day: number;
  warmup_started_at: string | null;
}

export function useAccounts() {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: async (): Promise<BotAccount[]> => {
      const res = await apiFetch(`${BOT_API_BASE}/account/list`);
      if (!res.ok) throw new Error("Failed to fetch accounts");
      const data = await res.json();
      return data.accounts || [];
    },
  });
}

export function useAddAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { username: string; password: string }) => {
      const res = await apiFetch(`${BOT_API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Login failed" }));
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["auth-status"] });
    },
  });
}

export function useToggleAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ username, is_active }: { username: string; is_active: boolean }) => {
      const res = await apiFetch(`${BOT_API_BASE}/account/${username}/toggle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active }),
      });
      if (!res.ok) throw new Error("Failed to toggle account");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });
}

export function useRemoveAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (username: string) => {
      const res = await apiFetch(`${BOT_API_BASE}/account/${username}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove account");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });
}

export function useSavePassword() {
  return useMutation({
    mutationFn: async (data: { username: string; password: string }) => {
      const res = await apiFetch(`${BOT_API_BASE}/account/save-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Failed to save password" }));
        throw new Error(err.detail || err.message);
      }
      return res.json();
    },
  });
}

export function useSetAccountProxy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ username, proxy_url }: { username: string; proxy_url: string }) => {
      const res = await apiFetch(`${BOT_API_BASE}/account/${username}/proxy`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proxy_url: proxy_url || null }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Failed to set proxy" }));
        throw new Error(err.detail || err.message);
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });
}
