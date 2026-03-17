import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { QueueList, StatusMessage } from "@workspace/api-client-react";
import { BOT_API_BASE } from "@/config";

const BASE_URL = BOT_API_BASE;

export function useQueue() {
  return useQuery({
    queryKey: ["queue"],
    queryFn: async (): Promise<QueueList> => {
      const res = await fetch(`${BASE_URL}/queue`);
      if (!res.ok) throw new Error("Failed to fetch queue");
      return res.json();
    },
    refetchInterval: 5000, // Refresh queue every 5 seconds
  });
}

export function useDeleteQueueItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number): Promise<StatusMessage> => {
      const res = await fetch(`${BASE_URL}/queue/${id}`, { method: "DELETE" });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.message || "Failed to delete");
      return result;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["queue"] }),
  });
}
