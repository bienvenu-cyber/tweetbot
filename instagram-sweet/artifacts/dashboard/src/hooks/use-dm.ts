import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { DmThreadList, SendDmRequest, BulkSendResponse, StatusMessage } from "@workspace/api-client-react";
import { BOT_API_BASE, apiFetch } from "@/config";

export function useDmThreads(amount: number = 20) {
  return useQuery({
    queryKey: ["dm-threads", amount],
    queryFn: async (): Promise<DmThreadList> => {
      const res = await apiFetch(`${BOT_API_BASE}/dm/threads?amount=${amount}`);
      if (!res.ok) throw new Error("Failed to fetch threads");
      return res.json();
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

export function useFollowers(amount: number = 100, enabled: boolean = false) {
  return useQuery({
    queryKey: ["followers", amount],
    queryFn: async (): Promise<{ followers: FollowerInfo[]; total: number }> => {
      const res = await apiFetch(`${BOT_API_BASE}/account/followers?amount=${amount}`, {}, 60000);
      if (!res.ok) throw new Error("Failed to fetch followers");
      return res.json();
    },
    enabled,
    retry: 1,
    staleTime: 5 * 60 * 1000, // cache 5 min
  });
}

export function useSendDm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: SendDmRequest): Promise<StatusMessage> => {
      const res = await apiFetch(`${BOT_API_BASE}/dm/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.message || "Failed to send DM");
      return result;
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

export function useBulkSendDm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: BulkSendPayload): Promise<BulkSendResponse> => {
      const res = await apiFetch(`${BOT_API_BASE}/dm/bulk-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.message || "Failed to bulk send");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["queue"] });
      queryClient.invalidateQueries({ queryKey: ["logs"] });
    },
  });
}
