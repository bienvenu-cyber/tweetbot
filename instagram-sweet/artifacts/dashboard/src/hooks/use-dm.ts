import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { DmThreadList, SendDmRequest, BulkSendResponse, StatusMessage } from "@workspace/api-client-react";
import { BOT_API_BASE, apiFetch } from "@/config";

function getApiErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (typeof record.detail === "string" && record.detail) return record.detail;
    if (typeof record.message === "string" && record.message) return record.message;
  }
  return fallback;
}

async function readApiPayload<T>(res: Response): Promise<T | Record<string, unknown> | null> {
  const text = await res.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as T;
  } catch {
    return { message: text };
  }
}

export function useDmThreads(amount: number = 20) {
  return useQuery({
    queryKey: ["dm-threads", amount],
    queryFn: async (): Promise<DmThreadList> => {
      const res = await apiFetch(`${BOT_API_BASE}/dm/threads?amount=${amount}`);
      const payload = await readApiPayload<DmThreadList>(res);
      if (!res.ok) throw new Error(getApiErrorMessage(payload, "Failed to fetch threads"));
      return (payload ?? { threads: [], total: 0 }) as DmThreadList;
    },
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export interface FollowerInfo {
  user_id: string;
  username: string;
  full_name: string;
  profile_pic_url: string | null;
}

export function useFollowers(
  amount: number = 100,
  enabled: boolean = false,
  accountUsername?: string,
  requestId: number = 0,
) {
  const normalizedAccountUsername = accountUsername?.trim().replace(/^@/, "").toLowerCase();

  return useQuery({
    queryKey: ["followers", amount, normalizedAccountUsername ?? "default", requestId],
    queryFn: async (): Promise<{ followers: FollowerInfo[]; total: number }> => {
      const params = new URLSearchParams({ amount: String(amount) });

      if (normalizedAccountUsername) {
        params.set("account_username", normalizedAccountUsername);
      }

      const res = await apiFetch(`${BOT_API_BASE}/account/followers?${params.toString()}`, {}, 60000);
      const payload = await readApiPayload<{ followers: FollowerInfo[]; total: number }>(res);
      if (!res.ok) throw new Error(getApiErrorMessage(payload, "Failed to fetch followers"));
      return (payload ?? { followers: [], total: 0 }) as { followers: FollowerInfo[]; total: number };
    },
    enabled,
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSendDm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: SendDmRequest): Promise<StatusMessage> => {
      const res = await apiFetch(
        `${BOT_API_BASE}/dm/send`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
        120000,
      );
      const result = await readApiPayload<StatusMessage>(res);
      if (!res.ok || !(result as StatusMessage | null)?.success) {
        throw new Error(getApiErrorMessage(result, "Failed to send DM"));
      }
      return result as StatusMessage;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["logs"] }),
  });
}

interface BulkSendPayload {
  usernames: string[];
  message: string;
  delay_min: number;
  delay_max: number;
  account_username?: string;
  skip_already_sent?: boolean;
}

export interface BulkSendJobResponse extends BulkSendResponse {
  job_id?: number;
}

export function useBulkSendDm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: BulkSendPayload): Promise<BulkSendJobResponse> => {
      const res = await apiFetch(`${BOT_API_BASE}/dm/bulk-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await readApiPayload<BulkSendJobResponse>(res);
      if (!res.ok || !(result as BulkSendJobResponse | null)?.success) {
        throw new Error(getApiErrorMessage(result, "Failed to bulk send"));
      }
      return result as BulkSendJobResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["queue"] });
      queryClient.invalidateQueries({ queryKey: ["logs"] });
    },
  });
}
