import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreatePostRequest, StatusMessage, PostCommentRequest } from "@workspace/api-client-react";

const BASE_URL = "/api/bot-api";

export function useCreatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreatePostRequest): Promise<StatusMessage> => {
      const res = await fetch(`${BASE_URL}/posts/create`, {
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
      const res = await fetch(`${BASE_URL}/comments/post`, {
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
