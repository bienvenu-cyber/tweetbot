import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Shuffle, Save, Send, X, Loader2, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ContentGeneratorProps {
  onContentSaved: () => void;
}

interface GeneratedTweet {
  content: string;
  category?: string;
  hashtags?: string[];
  tone?: string;
}

const CATEGORIES = [
  { value: "tech", label: "🖥️ Tech" },
  { value: "motivation", label: "🔥 Motivation" },
  { value: "business", label: "💼 Business" },
  { value: "engagement", label: "💬 Engagement" },
  { value: "promo", label: "📢 Promo" },
  { value: "lifestyle", label: "🌿 Lifestyle" },
  { value: "general", label: "📝 Général" },
];

const TONES = [
  { value: "auto", label: "🤖 Auto" },
  { value: "informatif", label: "📚 Informatif" },
  { value: "humoristique", label: "😂 Humoristique" },
  { value: "inspirant", label: "✨ Inspirant" },
  { value: "provocateur", label: "🔥 Provocateur" },
];

const ContentGenerator = ({ onContentSaved }: ContentGeneratorProps) => {
  const [prompt, setPrompt] = useState("");
  const [category, setCategory] = useState("general");
  const [tone, setTone] = useState("auto");
  const [generatedTweets, setGeneratedTweets] = useState<GeneratedTweet[]>([]);
  const [optimizedPrompt, setOptimizedPrompt] = useState("");
  const [suggestedHashtags, setSuggestedHashtags] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRandomGenerating, setIsRandomGenerating] = useState(false);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [randomCount, setRandomCount] = useState(5);

  const handleOptimizeGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setGeneratedTweets([]);

    try {
      const { data, error } = await supabase.functions.invoke("generate-content", {
        body: { action: "optimize_prompt", prompt: prompt.trim(), category, tone },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erreur de génération");

      const result = data.data;
      setOptimizedPrompt(result.optimized_prompt || "");
      setSuggestedHashtags(result.hashtags || []);
      setGeneratedTweets(
        (result.tweets || []).map((t: string) => ({
          content: t,
          category,
          hashtags: result.hashtags,
          tone: result.tone,
        }))
      );
      toast.success(`${result.tweets?.length || 0} tweets générés !`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRandomGenerate = async () => {
    setIsRandomGenerating(true);
    setGeneratedTweets([]);

    try {
      const { data, error } = await supabase.functions.invoke("generate-content", {
        body: { action: "random_generate", count: randomCount },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erreur de génération");

      setGeneratedTweets(data.data.tweets || []);
      setOptimizedPrompt("");
      setSuggestedHashtags([]);
      toast.success(`${data.data.tweets?.length || 0} tweets aléatoires générés !`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(msg);
    } finally {
      setIsRandomGenerating(false);
    }
  };

  const handleSaveAsTemplate = async (tweet: GeneratedTweet, index: number) => {
    setSavingIndex(index);
    try {
      const { error } = await supabase.from("tweet_templates").insert({
        content: tweet.content,
        category: tweet.category || category,
        hashtags: tweet.hashtags || [],
      });
      if (error) throw error;
      toast.success("Sauvegardé comme template !");
      onContentSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur";
      toast.error(msg);
    } finally {
      setSavingIndex(null);
    }
  };

  const handleScheduleNow = async (tweet: GeneratedTweet) => {
    try {
      const { error: dbError } = await supabase.from("scheduled_tweets").insert({
        content: tweet.content,
        status: "draft",
        category: tweet.category || category,
      });
      if (dbError) throw dbError;

      const { data, error } = await supabase.functions.invoke("twitter-bot", {
        body: { action: "post_tweet", content: tweet.content },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error);
      toast.success("Tweet posté !");
      onContentSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur";
      toast.error(msg);
    }
  };

  const handleCopy = (content: string, index: number) => {
    navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleRemoveTweet = (index: number) => {
    setGeneratedTweets((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="glass-card p-6 space-y-5">
      <h2 className="text-lg font-semibold font-display gradient-text">
        🧠 Générateur de Contenu IA
      </h2>

      {/* Prompt-based generation */}
      <div className="space-y-3">
        <Textarea
          placeholder="Décris ton idée de tweet... (ex: 'parler des avantages de l'IA pour les freelances')"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="min-h-[80px] bg-muted/50 border-border/50 resize-none text-foreground placeholder:text-muted-foreground"
        />

        <div className="flex flex-wrap gap-3">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-[160px] bg-muted/50 border-border/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={tone} onValueChange={setTone}>
            <SelectTrigger className="w-[160px] bg-muted/50 border-border/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TONES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={handleOptimizeGenerate}
            disabled={!prompt.trim() || isGenerating}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold glow-primary"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            Générer avec IA
          </Button>
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border/50" />
        <span className="text-xs text-muted-foreground">ou</span>
        <div className="flex-1 h-px bg-border/50" />
      </div>

      {/* Random generation */}
      <div className="flex items-center gap-3">
        <Input
          type="number"
          min={1}
          max={10}
          value={randomCount}
          onChange={(e) => setRandomCount(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
          className="w-20 bg-muted/50 border-border/50"
        />
        <Button
          onClick={handleRandomGenerate}
          disabled={isRandomGenerating}
          variant="secondary"
          className="font-semibold"
        >
          {isRandomGenerating ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Shuffle className="w-4 h-4 mr-2" />
          )}
          Génération aléatoire
        </Button>
        <span className="text-xs text-muted-foreground">tweets avec hashtags populaires</span>
      </div>

      {/* Optimized prompt display */}
      {optimizedPrompt && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
          <p className="text-xs text-primary font-semibold mb-1">Prompt optimisé par l'IA :</p>
          <p className="text-sm text-foreground">{optimizedPrompt}</p>
        </div>
      )}

      {/* Suggested hashtags */}
      {suggestedHashtags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestedHashtags.map((tag, i) => (
            <span key={i} className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-mono">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Generated tweets */}
      {generatedTweets.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            Tweets générés ({generatedTweets.length})
          </h3>
          {generatedTweets.map((tweet, index) => (
            <div
              key={index}
              className="bg-muted/20 border border-border/30 rounded-lg p-4 space-y-3 hover:bg-muted/30 transition-colors"
            >
              <p className="text-sm text-foreground leading-relaxed">{tweet.content}</p>

              <div className="flex items-center gap-2 flex-wrap">
                {tweet.category && (
                  <span className="text-xs bg-secondary/50 text-secondary-foreground px-2 py-0.5 rounded">
                    {tweet.category}
                  </span>
                )}
                {tweet.tone && (
                  <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded">
                    {tweet.tone}
                  </span>
                )}
                <span className={`text-xs font-mono ${(tweet.content?.length || 0) > 280 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {tweet.content?.length || 0}/280
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCopy(tweet.content, index)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {copiedIndex === index ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleSaveAsTemplate(tweet, index)}
                  disabled={savingIndex === index}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {savingIndex === index ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span className="ml-1 text-xs">Template</span>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleScheduleNow(tweet)}
                  className="text-primary hover:text-primary/80"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span className="ml-1 text-xs">Poster</span>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleRemoveTweet(index)}
                  className="text-muted-foreground hover:text-destructive ml-auto"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ContentGenerator;
