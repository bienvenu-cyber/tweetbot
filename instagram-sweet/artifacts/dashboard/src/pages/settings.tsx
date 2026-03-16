import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Settings as SettingsIcon, Save, ShieldAlert, Zap, Globe, CheckCircle2, XCircle, Loader2, Info } from "lucide-react";
import { useSettings, useUpdateSettings, useTestProxy, type BotSettings } from "@/hooks/use-settings";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";

const settingsSchema = z.object({
  dm_daily_limit: z.coerce.number().min(1).max(200),
  dm_delay_min: z.coerce.number().min(5),
  dm_delay_max: z.coerce.number().min(10),
  comment_daily_limit: z.coerce.number().min(1).max(100),
  comment_delay_min: z.coerce.number().min(5),
  comment_delay_max: z.coerce.number().min(10),
  post_daily_limit: z.coerce.number().min(1).max(10),
  auto_dm_enabled: z.boolean(),
  auto_comment_enabled: z.boolean(),
  proxy_url: z.string().optional(),
}).refine(data => data.dm_delay_max >= data.dm_delay_min, {
  message: "Max delay must be >= Min delay", path: ["dm_delay_max"]
}).refine(data => data.comment_delay_max >= data.comment_delay_min, {
  message: "Max delay must be >= Min delay", path: ["comment_delay_max"]
});

export default function Settings() {
  const { toast } = useToast();
  const { data: currentSettings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const testProxy = useTestProxy();
  const [proxyTestResult, setProxyTestResult] = useState<{ ok: boolean; msg: string; ip?: string } | null>(null);

  const form = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      dm_daily_limit: 50, dm_delay_min: 30, dm_delay_max: 120,
      comment_daily_limit: 30, comment_delay_min: 20, comment_delay_max: 90,
      post_daily_limit: 3, auto_dm_enabled: false, auto_comment_enabled: false,
      proxy_url: "",
    }
  });

  useEffect(() => {
    if (currentSettings) form.reset({ ...currentSettings, proxy_url: currentSettings.proxy_url || "" });
  }, [currentSettings, form]);

  const onSubmit = (data: z.infer<typeof settingsSchema>) => {
    updateSettings.mutate(data as BotSettings, {
      onSuccess: () => toast({ title: "Paramètres sauvegardés", description: "Configuration mise à jour." }),
      onError: (err) => toast({ title: "Erreur", description: err.message, variant: "destructive" })
    });
  };

  const handleTestProxy = () => {
    setProxyTestResult(null);
    testProxy.mutate(undefined, {
      onSuccess: (res) => setProxyTestResult({ ok: res.success, msg: res.message, ip: res.ip }),
      onError: (err) => setProxyTestResult({ ok: false, msg: err.message }),
    });
  };

  if (isLoading) return <div className="text-center p-12 animate-pulse text-muted-foreground">Chargement des paramètres...</div>;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-20">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Paramètres du Bot</h1>
        <p className="text-muted-foreground mt-1">Configure les limites, délais et connexion proxy.</p>
      </div>

      <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-xl flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-destructive" />
        <div className="text-sm">
          <p className="font-semibold text-destructive">Avertissement Anti-Spam</p>
          <p className="text-destructive/80 mt-1">Des limites trop élevées ou des délais trop courts risquent de faire restreindre ou bannir ton compte Instagram. Utilise des réglages conservateurs.</p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

        {/* PROXY CONFIGURATION */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">Proxy de Connexion</CardTitle>
              </div>
              {currentSettings?.proxy_active
                ? <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Actif</Badge>
                : <Badge variant="outline" className="text-muted-foreground">Inactif — IP USA</Badge>
              }
            </div>
            <CardDescription>
              Indispensable si tu es hors des États-Unis. Replit est hébergé aux USA — Instagram peut bloquer les connexions géographiquement suspectes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 flex gap-3">
              <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div className="text-xs text-blue-200/80 space-y-1">
                <p className="font-semibold text-blue-300">Format proxy supporté :</p>
                <p className="font-mono text-[11px] bg-black/20 rounded px-2 py-1">socks5://user:password@host:port</p>
                <p className="font-mono text-[11px] bg-black/20 rounded px-2 py-1">http://user:password@host:port</p>
                <p className="mt-1">Services recommandés : <strong>Webshare.io</strong> (gratuit), <strong>ProxyScrape</strong>, ou un VPS avec Dante/Squid dans ta région.</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="proxy_url">URL du Proxy</Label>
              <Input
                id="proxy_url"
                type="text"
                placeholder="socks5://user:pass@host:port"
                className="bg-background/50 font-mono text-sm"
                {...form.register("proxy_url")}
              />
              <p className="text-xs text-muted-foreground">Laisse vide pour connexion directe (non recommandé si hors USA)</p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleTestProxy}
                disabled={testProxy.isPending}
                className="h-9 text-sm"
              >
                {testProxy.isPending
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Test en cours...</>
                  : <><Globe className="w-4 h-4 mr-2" /> Tester le proxy</>
                }
              </Button>
              {proxyTestResult && (
                <div className={`flex items-center gap-2 text-sm ${proxyTestResult.ok ? "text-green-400" : "text-destructive"}`}>
                  {proxyTestResult.ok
                    ? <CheckCircle2 className="w-4 h-4" />
                    : <XCircle className="w-4 h-4" />
                  }
                  <span>{proxyTestResult.msg}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* DM CONFIG */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Messages Directs (DM)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex justify-between">
                  <Label>Limite journalière</Label>
                  <span className="font-mono text-sm font-semibold">{form.watch("dm_daily_limit")}</span>
                </div>
                <Slider
                  value={[form.watch("dm_daily_limit")]}
                  max={200} step={1}
                  onValueChange={v => form.setValue("dm_daily_limit", v[0])}
                  className="py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Délai min (sec)</Label>
                  <Input type="number" {...form.register("dm_delay_min")} className="bg-background/50" />
                </div>
                <div className="space-y-2">
                  <Label>Délai max (sec)</Label>
                  <Input type="number" {...form.register("dm_delay_max")} className="bg-background/50" />
                </div>
              </div>
            </div>
            {form.formState.errors.dm_delay_max && <p className="text-xs text-destructive">{form.formState.errors.dm_delay_max.message}</p>}
          </CardContent>
        </Card>

        {/* COMMENTS CONFIG */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Commentaires</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex justify-between">
                  <Label>Limite journalière</Label>
                  <span className="font-mono text-sm font-semibold">{form.watch("comment_daily_limit")}</span>
                </div>
                <Slider
                  value={[form.watch("comment_daily_limit")]}
                  max={100} step={1}
                  onValueChange={v => form.setValue("comment_daily_limit", v[0])}
                  className="py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Délai min (sec)</Label>
                  <Input type="number" {...form.register("comment_delay_min")} className="bg-background/50" />
                </div>
                <div className="space-y-2">
                  <Label>Délai max (sec)</Label>
                  <Input type="number" {...form.register("comment_delay_max")} className="bg-background/50" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AUTOMATION SWITCHES */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              Automatisation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border border-border/50 rounded-xl bg-secondary/20">
              <div>
                <Label className="text-base">Traitement auto des DMs</Label>
                <p className="text-sm text-muted-foreground">Traite la file DM en arrière-plan en continu</p>
              </div>
              <Switch
                checked={form.watch("auto_dm_enabled")}
                onCheckedChange={v => form.setValue("auto_dm_enabled", v)}
                className="data-[state=checked]:bg-primary"
              />
            </div>
            <div className="flex items-center justify-between p-4 border border-border/50 rounded-xl bg-secondary/20">
              <div>
                <Label className="text-base">Traitement auto des commentaires</Label>
                <p className="text-sm text-muted-foreground">Traite la file commentaires en arrière-plan</p>
              </div>
              <Switch
                checked={form.watch("auto_comment_enabled")}
                onCheckedChange={v => form.setValue("auto_comment_enabled", v)}
                className="data-[state=checked]:bg-primary"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end pt-4 border-t border-border">
          <Button type="submit" disabled={updateSettings.isPending} className="bg-primary text-white h-12 px-8 text-base shadow-lg shadow-primary/20">
            {updateSettings.isPending ? "Sauvegarde..." : <><Save className="w-5 h-5 mr-2" /> Sauvegarder</>}
          </Button>
        </div>
      </form>
    </motion.div>
  );
}
