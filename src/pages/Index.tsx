import { useState } from "react";
import { Bot, Twitter } from "lucide-react";
import ComposeTweet from "@/components/ComposeTweet";
import TweetHistory from "@/components/TweetHistory";
import BotStatus from "@/components/BotStatus";

const Index = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center glow-primary">
            <Bot className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-display gradient-text">TweetBot</h1>
            <p className="text-xs text-muted-foreground">Dashboard de gestion Twitter/X</p>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <BotStatus />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ComposeTweet onTweetSent={() => setRefreshKey((k) => k + 1)} />
          <TweetHistory refreshKey={refreshKey} />
        </div>

        {/* Setup guide */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold font-display gradient-text mb-3">Configuration requise</h2>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>Pour utiliser le bot, configure les secrets suivants dans Lovable Cloud :</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { name: "TWITTER_CONSUMER_KEY", desc: "API Key" },
                { name: "TWITTER_CONSUMER_SECRET", desc: "API Secret" },
                { name: "TWITTER_ACCESS_TOKEN", desc: "Access Token" },
                { name: "TWITTER_ACCESS_TOKEN_SECRET", desc: "Access Token Secret" },
              ].map((s) => (
                <div key={s.name} className="bg-muted/30 rounded-lg p-3 font-mono text-xs">
                  <span className="text-primary">{s.name}</span>
                  <br />
                  <span className="text-muted-foreground">{s.desc}</span>
                </div>
              ))}
            </div>
            <p className="text-xs">
              Obtiens ces clés sur{" "}
              <a
                href="https://developer.x.com/en/portal/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                developer.x.com
              </a>
              . Active les permissions <strong>Read and Write</strong>.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
