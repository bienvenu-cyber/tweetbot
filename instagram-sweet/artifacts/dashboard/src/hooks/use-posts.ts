import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreatePostRequest, StatusMessage, PostCommentRequest } from "@workspace/api-client-react";
import { BOT_API_BASE, apiFetch } from "@/config";

export function useCreatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreatePostRequest): Promise<StatusMessage> => {
      const res = await apiFetch(`${BOT_API_BASE}/posts/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.message || "Failed to create post");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["queue"] });
      queryClient.invalidateQueries({ queryKey: ["logs"] });
    },
  });
}

export function usePostComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: PostCommentRequest): Promise<StatusMessage> => {
      const res = await apiFetch(`${BOT_API_BASE}/comments/post`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.message || "Failed to post comment");
      return result;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["logs"] }),
  });
}
