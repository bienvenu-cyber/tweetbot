import { useEffect, useRef, useState, useCallback } from "react";

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

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/bot-api/ws/bulk-jobs/${jobId}`;
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
