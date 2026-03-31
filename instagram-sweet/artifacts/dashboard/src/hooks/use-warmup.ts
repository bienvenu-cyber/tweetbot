import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BOT_API_BASE, apiFetch } from "@/config";

export function useStartWarmup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (username: string) => {
      const res = await apiFetch(`${BOT_API_BASE}/warmup/${username}/start`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to start warmup");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });
}

export function useStopWarmup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (username: string) => {
      const res = await apiFetch(`${BOT_API_BASE}/warmup/${username}/stop`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to stop warmup");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });
}
