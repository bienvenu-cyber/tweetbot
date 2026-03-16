import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { DmThreadList, SendDmRequest, BulkSendDmRequest, BulkSendResponse, StatusMessage } from "@workspace/api-client-react";

const BASE_URL = "/api/bot-api";

export function useDmThreads(amount: number = 20) {
  return useQuery({
    queryKey: ["dm-threads", amount],
    queryFn: async (): Promise<DmThreadList> => {
      const res = await fetch(`${BASE_URL}/dm/threads?amount=${amount}`);
      if (!res.ok) throw new Error("Failed to fetch threads");
      return res.json();
    },
  });
}

export function useSendDm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: SendDmRequest): Promise<StatusMessage> => {
      const res = await fetch(`${BASE_URL}/dm/send`, {
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

export function useBulkSendDm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: BulkSendDmRequest): Promise<BulkSendResponse> => {
      const res = await fetch(`${BASE_URL}/dm/bulk-send`, {
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
