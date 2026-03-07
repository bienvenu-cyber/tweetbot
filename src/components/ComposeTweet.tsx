import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Reply, Clock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ComposeTweetProps {
  onTweetSent: () => void;
}

const ComposeTweet = ({ onTweetSent }: ComposeTweetProps) => {
  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const charCount = content.length;
  const maxChars = 280;

  const handlePost = async () => {
    if (!content.trim() || charCount > maxChars) return;
    setIsPosting(true);

    try {
      // Save to DB first
      const { data: dbTweet, error: dbError } = await supabase
        .from("scheduled_tweets")
        .insert({
          content: content.trim(),
          reply_to_tweet_id: replyTo.trim() || null,
          scheduled_at: scheduledAt || null,
          status: scheduledAt ? "scheduled" : "draft",
        })
        .select()
        .single();

      if (dbError) throw dbError;

      if (!scheduledAt) {
        // Post immediately
        const { data, error } = await supabase.functions.invoke("twitter-bot", {
          body: {
            action: "post_tweet",
            content: content.trim(),
            reply_to_tweet_id: replyTo.trim() || undefined,
            tweet_db_id: dbTweet.id,
          },
        });

        if (error) throw error;
        if (!data.success) throw new Error(data.error);
        toast.success("Tweet posté avec succès !");
      } else {
        toast.success("Tweet programmé !");
      }

      setContent("");
      setReplyTo("");
      setScheduledAt("");
      onTweetSent();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(`Erreur: ${msg}`);
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="glass-card p-6 space-y-4">
      <h2 className="text-lg font-semibold font-display gradient-text">Composer un Tweet</h2>

      <div className="relative">
        <Textarea
          placeholder="Quoi de neuf ?"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-[120px] bg-muted/50 border-border/50 resize-none text-foreground placeholder:text-muted-foreground focus:ring-primary/30"
        />
        <span
          className={`absolute bottom-3 right-3 text-sm font-mono ${
            charCount > maxChars ? "text-destructive" : charCount > 250 ? "text-warning" : "text-muted-foreground"
          }`}
        >
          {charCount}/{maxChars}
        </span>
      </div>

      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        {showAdvanced ? "Masquer" : "Options avancées"} ▾
      </button>

      {showAdvanced && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">
              <Reply className="inline w-4 h-4 mr-1" />
              Répondre au Tweet ID
            </label>
            <Input
              placeholder="1234567890..."
              value={replyTo}
              onChange={(e) => setReplyTo(e.target.value)}
              className="bg-muted/50 border-border/50"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">
              <Clock className="inline w-4 h-4 mr-1" />
              Programmer
            </label>
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="bg-muted/50 border-border/50"
            />
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          onClick={handlePost}
          disabled={!content.trim() || charCount > maxChars || isPosting}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold glow-primary"
        >
          {isPosting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Send className="w-4 h-4 mr-2" />
          )}
          {scheduledAt ? "Programmer" : "Poster"}
        </Button>
      </div>
    </div>
  );
};

export default ComposeTweet;
