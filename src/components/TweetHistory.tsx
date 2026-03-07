import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, XCircle, Clock, FileText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Tweet {
  id: string;
  content: string;
  status: string;
  tweet_id: string | null;
  reply_to_tweet_id: string | null;
  scheduled_at: string | null;
  error_message: string | null;
  created_at: string;
}

interface TweetHistoryProps {
  refreshKey: number;
}

const statusConfig: Record<string, { icon: React.ReactNode; label: string; dotClass: string }> = {
  posted: { icon: <CheckCircle className="w-4 h-4 text-green-400" />, label: "Posté", dotClass: "status-dot-active" },
  failed: { icon: <XCircle className="w-4 h-4 text-red-400" />, label: "Échoué", dotClass: "status-dot-failed" },
  scheduled: { icon: <Clock className="w-4 h-4 text-yellow-400" />, label: "Programmé", dotClass: "status-dot-pending" },
  draft: { icon: <FileText className="w-4 h-4 text-muted-foreground" />, label: "Brouillon", dotClass: "status-dot" },
};

const TweetHistory = ({ refreshKey }: TweetHistoryProps) => {
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTweets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("scheduled_tweets")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error && data) {
      setTweets(data as Tweet[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTweets();
  }, [refreshKey]);

  const stats = {
    total: tweets.length,
    posted: tweets.filter((t) => t.status === "posted").length,
    failed: tweets.filter((t) => t.status === "failed").length,
    scheduled: tweets.filter((t) => t.status === "scheduled").length,
  };

  return (
    <div className="glass-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold font-display gradient-text">Historique</h2>
        <Button variant="ghost" size="sm" onClick={fetchTweets} className="text-muted-foreground hover:text-foreground">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-foreground" },
          { label: "Postés", value: stats.posted, color: "text-green-400" },
          { label: "Échoués", value: stats.failed, color: "text-red-400" },
          { label: "Programmés", value: stats.scheduled, color: "text-yellow-400" },
        ].map((s) => (
          <div key={s.label} className="bg-muted/30 rounded-lg p-3 text-center">
            <div className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {loading ? (
          <div className="text-center text-muted-foreground py-8">Chargement...</div>
        ) : tweets.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">Aucun tweet encore</div>
        ) : (
          tweets.map((tweet) => {
            const config = statusConfig[tweet.status] || statusConfig.draft;
            return (
              <div
                key={tweet.id}
                className="bg-muted/20 border border-border/30 rounded-lg p-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-foreground flex-1 line-clamp-2">{tweet.content}</p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={config.dotClass} />
                    {config.icon}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted-foreground font-mono">
                    {format(new Date(tweet.created_at), "dd MMM yyyy HH:mm", { locale: fr })}
                  </span>
                  {tweet.reply_to_tweet_id && (
                    <span className="text-xs text-primary/70">↩ Réponse</span>
                  )}
                </div>
                {tweet.error_message && (
                  <p className="text-xs text-destructive mt-1 font-mono truncate">{tweet.error_message}</p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TweetHistory;
