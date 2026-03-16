import { useQuery } from "@tanstack/react-query";
import type { LogList } from "@workspace/api-client-react";

const BASE_URL = "/api/bot-api";

interface LogParams {
  limit?: number;
  offset?: number;
  action_type?: string;
}

export function useLogs(params?: LogParams) {
  return useQuery({
    queryKey: ["logs", params],
    queryFn: async (): Promise<LogList> => {
      const url = new URL(`${window.location.origin}${BASE_URL}/logs`);
      if (params?.limit) url.searchParams.append("limit", params.limit.toString());
      if (params?.offset) url.searchParams.append("offset", params.offset.toString());
      if (params?.action_type) url.searchParams.append("action_type", params.action_type);
      
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to fetch logs");
      return res.json();
    },
    refetchInterval: 10000,
  });
}
