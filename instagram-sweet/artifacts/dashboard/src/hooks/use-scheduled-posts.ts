import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { BOT_API_BASE } from "@/config";

const BASE_URL = BOT_API_BASE;

export interface ScheduledPost {
  id: number;
  account_username: string;
  image_url: string;
  caption: string;
  scheduled_at: string;
  status: "pending" | "published" | "failed";
  error_message: string | null;
  created_at: string;
  published_at: string | null;
}

export function useScheduledPosts() {
  return useQuery({
    queryKey: ["scheduled-posts"],
    queryFn: async (): Promise<ScheduledPost[]> => {
      const res = await fetch(`${BASE_URL}/posts/scheduled`);
      if (!res.ok) throw new Error("Failed to fetch scheduled posts");
      const data = await res.json();
      return data.posts || [];
    },
    refetchInterval: 10000,
  });
}

export function useDeleteScheduledPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${BASE_URL}/posts/scheduled/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scheduled-posts"] }),
  });
}
