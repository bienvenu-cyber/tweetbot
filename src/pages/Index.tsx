import { useState } from "react";
import { Bot } from "lucide-react";
import ComposeTweet from "@/components/ComposeTweet";
import TweetHistory from "@/components/TweetHistory";
import BotStatus from "@/components/BotStatus";
import ContentGenerator from "@/components/ContentGenerator";
import TemplateManager from "@/components/TemplateManager";
import AccountManager from "@/components/AccountManager";
import CronStatus from "@/components/CronStatus";

const Index = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [templateRefreshKey, setTemplateRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<"dashboard" | "generator" | "templates" | "accounts">("dashboard");

  const tabs = [
    { key: "dashboard" as const, label: "📊 Dashboard" },
    { key: "generator" as const, label: "🧠 Générateur IA" },
    { key: "templates" as const, label: "📝 Templates" },
    { key: "accounts" as const, label: "👥 Comptes" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center glow-primary">
            <Bot className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-display gradient-text">TweetBot</h1>
            <p className="text-xs text-muted-foreground">Dashboard de gestion Twitter/X</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1 -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === tab.key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {activeTab === "dashboard" && (
          <>
            <BotStatus />
            <CronStatus />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ComposeTweet onTweetSent={() => setRefreshKey((k) => k + 1)} />
              <TweetHistory refreshKey={refreshKey} />
            </div>
          </>
        )}

        {activeTab === "generator" && (
          <ContentGenerator
            onContentSaved={() => {
              setRefreshKey((k) => k + 1);
              setTemplateRefreshKey((k) => k + 1);
            }}
          />
        )}

        {activeTab === "templates" && <TemplateManager refreshKey={templateRefreshKey} />}

        {activeTab === "accounts" && <AccountManager />}
      </main>
    </div>
  );
};

export default Index;
