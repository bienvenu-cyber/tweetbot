import { useEffect, useRef, useState, useCallback } from "react";
import { getBotWsUrl } from "@/config";

export interface BulkJobProgress {
  job_id: number;
  status: string;
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  message: string;
}

export function useBulkJobWs(jobId: number | null) {
  const [progress, setProgress] = useState<BulkJobProgress | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const cancel = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: "cancel" }));
    }
  }, []);

  useEffect(() => {
    if (!jobId) return;

    const wsUrl = getBotWsUrl(`/ws/bulk-jobs/${jobId}`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setProgress(data);
      } catch {}
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [jobId]);

  return { progress, connected, cancel };
}
