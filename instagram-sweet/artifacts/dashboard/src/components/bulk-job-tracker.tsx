import { useBulkJobWs, type BulkJobProgress } from "@/hooks/use-bulk-ws";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, XCircle, CheckCircle2, Loader2 } from "lucide-react";

interface BulkJobTrackerProps {
  jobId: number | null;
  onDone?: () => void;
}

export function BulkJobTracker({ jobId, onDone }: BulkJobTrackerProps) {
  const { progress, connected, cancel } = useBulkJobWs(jobId);

  if (!jobId || !progress) return null;

  const pct = progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;
  const isDone = progress.status === "completed" || progress.status === "cancelled" || progress.status === "failed";

  return (
    <Card className="border-border shadow-lg overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {isDone ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            ) : (
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            )}
            Bulk Job #{progress.job_id}
          </CardTitle>
          <div className="flex items-center gap-2">
            {connected ? (
              <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 text-xs gap-1">
                <Wifi className="w-3 h-3" /> Live
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground text-xs gap-1">
                <WifiOff className="w-3 h-3" /> Disconnected
              </Badge>
            )}
            <Badge variant={
              progress.status === "completed" ? "default" :
              progress.status === "failed" ? "destructive" :
              progress.status === "cancelled" ? "secondary" : "outline"
            } className="text-xs capitalize">
              {progress.status}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">{progress.processed}/{progress.total} processed</span>
            <span className="font-medium text-foreground">{pct}%</span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-emerald-500/10 rounded-lg p-2">
            <p className="text-lg font-bold text-emerald-500">{progress.succeeded}</p>
            <p className="text-xs text-muted-foreground">Succeeded</p>
          </div>
          <div className="bg-destructive/10 rounded-lg p-2">
            <p className="text-lg font-bold text-destructive">{progress.failed}</p>
            <p className="text-xs text-muted-foreground">Failed</p>
          </div>
          <div className="bg-primary/10 rounded-lg p-2">
            <p className="text-lg font-bold text-primary">{progress.total - progress.processed}</p>
            <p className="text-xs text-muted-foreground">Remaining</p>
          </div>
        </div>

        {progress.message && (
          <p className="text-sm text-muted-foreground bg-secondary/50 p-3 rounded-lg">{progress.message}</p>
        )}

        <div className="flex gap-2">
          {!isDone && (
            <Button variant="destructive" size="sm" onClick={cancel} className="flex-1">
              <XCircle className="w-4 h-4 mr-1" /> Cancel Job
            </Button>
          )}
          {isDone && onDone && (
            <Button variant="outline" size="sm" onClick={onDone} className="flex-1">
              Dismiss
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
