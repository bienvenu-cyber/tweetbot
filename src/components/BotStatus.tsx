import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Wifi, WifiOff } from "lucide-react";

const BotStatus = () => {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [username, setUsername] = useState<string>("");

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("twitter-bot", {
          body: { action: "get_me" },
        });
        if (error || !data?.success) {
          setConnected(false);
          return;
        }
        setConnected(true);
        setUsername(data.data?.data?.username || "");
      } catch {
        setConnected(false);
      }
    };
    checkStatus();
  }, []);

  return (
    <div className="glass-card p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <User className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-sm text-foreground">Bot Twitter/X</h3>
          {username && <p className="text-xs text-muted-foreground">@{username}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {connected === null ? (
          <span className="text-xs text-muted-foreground">Vérification...</span>
        ) : connected ? (
          <>
            <Wifi className="w-4 h-4 text-green-400" />
            <span className="text-xs text-green-400 font-medium">Connecté</span>
          </>
        ) : (
          <>
            <WifiOff className="w-4 h-4 text-red-400" />
            <span className="text-xs text-red-400 font-medium">Déconnecté</span>
          </>
        )}
      </div>
    </div>
  );
};

export default BotStatus;
