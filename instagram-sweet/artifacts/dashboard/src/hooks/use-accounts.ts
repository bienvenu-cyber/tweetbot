import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { BOT_API_BASE } from "@/config";

const BASE_URL = BOT_API_BASE;

export interface BotAccount {
  id: number;
  username: string;
  is_active: boolean;
  is_logged_in: boolean;
  last_login_at: string | null;
  last_action_at: string | null;
  created_at: string;
}

export function useAccounts() {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: async (): Promise<BotAccount[]> => {
      const res = await fetch(`${BASE_URL}/account/list`);
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
      const res = await fetch(`${BASE_URL}/auth/login`, {
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
      const res = await fetch(`${BASE_URL}/account/${username}/toggle`, {
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
      const res = await fetch(`${BASE_URL}/account/${username}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove account");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });
}
