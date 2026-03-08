import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Timer, Play, Loader2, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

const CronStatus = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleManualRun = async () => {
    setIsRunning(true);
    setLastResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("auto-publish");
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erreur");
      
      const results = data.results || [];
      const posted = results.filter((r: any) => r.action !== 'nothing_to_post');
      
      setLastResult({
        success: true,
        message: posted.length > 0
          ? `${posted.length} tweet(s) publié(s) !`
          : "Rien à publier (ajoute des templates ou du contenu programmé)",
      });
      toast.success(posted.length > 0 ? "Publication automatique effectuée !" : "Rien à publier");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur";
      setLastResult({ success: false, message: msg });
      toast.error(msg);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="glass-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold font-display gradient-text flex items-center gap-2">
          <Timer className="w-5 h-5" /> Automatisation (Cron)
        </h2>
      </div>

      <div className="bg-muted/30 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Publication automatique</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Poste les tweets programmés, utilise la rotation de templates, ou génère via IA.
            </p>
          </div>
          <Button
            onClick={handleManualRun}
            disabled={isRunning}
            size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground glow-primary"
          >
            {isRunning ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-1.5" />
            )}
            Exécuter maintenant
          </Button>
        </div>

        {lastResult && (
          <div className={`flex items-center gap-2 text-sm ${lastResult.success ? "text-green-400" : "text-destructive"}`}>
            {lastResult.success ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {lastResult.message}
          </div>
        )}

        <div className="border-t border-border/30 pt-3 mt-3">
          <p className="text-xs text-muted-foreground">
            💡 <strong>Pour automatiser :</strong> Le cron peut être activé en base de données pour s'exécuter toutes les 1-2 heures automatiquement. Clique sur "Exécuter maintenant" pour un test manuel.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CronStatus;
