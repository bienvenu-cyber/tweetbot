import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { AuthStatus, LoginResponse, StatusMessage, AccountInfo } from "@workspace/api-client-react";

const BASE_URL = "/api/bot-api";

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 90000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function useAuthStatus() {
  return useQuery({
    queryKey: ["auth-status"],
    queryFn: async (): Promise<AuthStatus> => {
      const res = await fetchWithTimeout(`${BASE_URL}/auth/status`, {}, 10000);
      if (!res.ok) throw new Error("Failed to fetch auth status");
      return res.json();
    },
    retry: false,
    refetchInterval: false,
  });
}

export function useAccount() {
  return useQuery({
    queryKey: ["account-info"],
    queryFn: async (): Promise<AccountInfo> => {
      const res = await fetchWithTimeout(`${BASE_URL}/account`, {}, 10000);
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
      const res = await fetchWithTimeout(
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
      const res = await fetchWithTimeout(`${BASE_URL}/auth/logout`, { method: "POST" }, 10000);
      if (!res.ok) throw new Error("Failed to logout");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth-status"] });
      queryClient.invalidateQueries({ queryKey: ["account-info"] });
    },
  });
}
