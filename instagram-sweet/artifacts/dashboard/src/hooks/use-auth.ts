import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { AuthStatus, LoginResponse, StatusMessage, AccountInfo } from "@workspace/api-client-react";
import { BOT_API_BASE, apiFetch } from "@/config";

const BASE_URL = BOT_API_BASE;

// The bot returns { accounts: [...], total: N } — derive a convenient `logged_in` flag
export interface NormalizedAuth {
  accounts: Array<{ username: string; is_active: boolean; is_logged_in: boolean; last_login_at: string | null; last_action_at: string | null }>;
  total: number;
  logged_in: boolean;
  active_username: string | null;
}

export function useAuthStatus() {
  return useQuery({
    queryKey: ["auth-status"],
    queryFn: async (): Promise<NormalizedAuth> => {
      const url = `${BASE_URL}/auth/status`;
      console.log("[AUTH] Fetching auth status from:", url);
      const res = await apiFetch(url, {}, 10000);
      console.log("[AUTH] Auth status response:", res.status, res.statusText);
      if (!res.ok) {
        const text = await res.text().catch(() => "no body");
        console.error("[AUTH] Auth status FAILED:", res.status, text);
        throw new Error("Failed to fetch auth status");
      }
      const raw = await res.json();
      console.log("[AUTH] Auth status raw:", JSON.stringify(raw));

      // Normalize: derive logged_in from accounts array
      const accounts = raw.accounts || [];
      const loggedInAccount = accounts.find((a: any) => a.is_logged_in);
      const normalized: NormalizedAuth = {
        accounts,
        total: raw.total ?? accounts.length,
        logged_in: !!loggedInAccount,
        active_username: loggedInAccount?.username ?? null,
      };
      console.log("[AUTH] Normalized auth:", JSON.stringify(normalized));
      return normalized;
    },
    retry: false,
    refetchInterval: false,
  });
}

export function useAccount() {
  return useQuery({
    queryKey: ["account-info"],
    queryFn: async (): Promise<AccountInfo> => {
      const res = await apiFetch(`${BASE_URL}/account`, {}, 10000);
      if (!res.ok) throw new Error("Failed to fetch account info");
      return res.json();
    },
    retry: false,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { username: string; password: string }): Promise<LoginResponse> => {
      const res = await apiFetch(
        `${BASE_URL}/auth/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
        90000
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Server error" }));
        throw new Error(err.message || "Login failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth-status"] });
      queryClient.invalidateQueries({ queryKey: ["account-info"] });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<StatusMessage> => {
      const res = await apiFetch(`${BASE_URL}/auth/logout`, { method: "POST" }, 10000);
      if (!res.ok) throw new Error("Failed to logout");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth-status"] });
      queryClient.invalidateQueries({ queryKey: ["account-info"] });
    },
  });
}
