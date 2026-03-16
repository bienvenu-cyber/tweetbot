import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Bot, AlertTriangle, ShieldCheck, Loader2, Globe, RefreshCw,
  CheckCircle2, Cookie, KeyRound, ChevronRight, Copy, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useLogin, useAuthStatus } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  username: z.string().min(1, "Username requis"),
  password: z.string().min(1, "Mot de passe requis"),
});

const BASE_URL = "/api/bot-api";

type Mode = "password" | "cookies";

type ChallengeState = {
  active: boolean;
  type: "code" | "approve" | null;
  geoBlocked: boolean;
  username: string;
  password: string;
};

export default function Login() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<Mode>("password");
  const [cookieString, setCookieString] = useState("");
  const [cookieUsername, setCookieUsername] = useState("");
  const [cookieLoading, setCookieLoading] = useState(false);
  const [challenge, setChallenge] = useState<ChallengeState>({
    active: false, type: null, geoBlocked: false, username: "", password: ""
  });
  const [verifyCode, setVerifyCode] = useState("");
  const [codeSubmitting, setCodeSubmitting] = useState(false);

  const { data: auth, isLoading: checkingAuth } = useAuthStatus();
  const loginMutation = useLogin();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" }
  });

  useEffect(() => {
    if (!checkingAuth && auth?.logged_in) setLocation("/");
  }, [checkingAuth, auth?.logged_in, setLocation]);

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  if (auth?.logged_in) return null;

  const handleLoginResult = (res: any, username: string, password: string) => {
    if (res.success) {
      toast({ title: "✓ Connecté !", description: `Connecté en tant que @${res.username}` });
      setLocation("/");
      return;
    }
    if (res.challenge) {
      setChallenge({ active: true, type: res.challenge_type || "approve", geoBlocked: res.geo_blocked ?? true, username, password });
      return;
    }
    toast({ title: "Connexion échouée", description: res.message, variant: "destructive" });
  };

  const onPasswordSubmit = (data: z.infer<typeof loginSchema>) => {
    const username = data.username.replace(/^@/, "").trim().toLowerCase();
    setChallenge(c => ({ ...c, active: false }));
    loginMutation.mutate({ username, password: data.password }, {
      onSuccess: (res) => handleLoginResult(res, username, data.password),
      onError: (err) => toast({ title: "Erreur", description: err.message, variant: "destructive" })
    });
  };

  const handleRetryAfterApproval = () => {
    loginMutation.mutate({ username: challenge.username, password: challenge.password }, {
      onSuccess: (res) => handleLoginResult(res, challenge.username, challenge.password),
      onError: (err) => toast({ title: "Erreur", description: err.message, variant: "destructive" })
    });
  };

  const handleSubmitCode = async () => {
    if (!verifyCode.trim()) {
      toast({ title: "Erreur", description: "Entre le code de vérification.", variant: "destructive" });
      return;
    }
    setCodeSubmitting(true);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 90000);

      const res = await fetch(`${BASE_URL}/auth/challenge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: verifyCode.trim() }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      const data = await res.json();
      if (data.success) {
        toast({ title: "✓ Connecté !", description: `@${data.username}` });
        setLocation("/");
      } else {
        toast({ title: "Code invalide", description: data.message, variant: "destructive" });
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        toast({ title: "Timeout", description: "Le serveur met trop de temps. Réessaie dans 30 secondes.", variant: "destructive" });
      } else {
        toast({ title: "Erreur", description: e.message, variant: "destructive" });
      }
    } finally {
      setCodeSubmitting(false);
    }
  };

  const handleCookieImport = async () => {
    if (!cookieString.trim()) {
      toast({ title: "Erreur", description: "Colle tes cookies Instagram.", variant: "destructive" });
      return;
    }
    setCookieLoading(true);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 90000); // 90 secondes

      const res = await fetch(`${BASE_URL}/auth/import-cookies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cookie_string: cookieString.trim(),
          username: cookieUsername.trim() || undefined,
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      const data = await res.json();
      if (data.success) {
        toast({ title: "✓ Connecté via cookies !", description: data.message });
        setLocation("/");
      } else {
        toast({ title: "Import échoué", description: data.message, variant: "destructive" });
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        toast({ title: "Timeout", description: "Le serveur met trop de temps à répondre. Réessaie dans 30 secondes.", variant: "destructive" });
      } else {
        toast({ title: "Erreur", description: e.message, variant: "destructive" });
      }
    } finally {
      setCookieLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <img src={`${import.meta.env.BASE_URL}images/auth-bg.png`} alt="" className="w-full h-full object-cover opacity-40 mix-blend-screen" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[128px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[128px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md p-4 z-10"
      >
        <Card className="border-border/50 shadow-2xl bg-card/60 backdrop-blur-xl rounded-2xl overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-purple-500 to-primary" />

          <CardHeader className="text-center pt-8 pb-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 border border-primary/30 flex items-center justify-center mb-4">
              <Bot className="w-7 h-7 text-primary" />
            </div>
            <CardTitle className="text-2xl font-display text-foreground">Instagram Bot</CardTitle>
            <CardDescription className="text-muted-foreground text-sm mt-1">
              Connecte ton compte pour commencer l'automatisation.
            </CardDescription>
          </CardHeader>

          {/* Mode Tabs */}
          <div className="px-8 pb-2">
            <div className="flex rounded-xl bg-secondary/30 p-1 gap-1">
              <button
                onClick={() => setMode("password")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  mode === "password" ? "bg-primary text-white shadow" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <KeyRound className="w-4 h-4" /> Mot de passe
              </button>
              <button
                onClick={() => setMode("cookies")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  mode === "cookies" ? "bg-primary text-white shadow" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Cookie className="w-4 h-4" /> Import Cookies
              </button>
            </div>
          </div>

          <CardContent className="px-8 pb-8 pt-4 space-y-4">
            <AnimatePresence mode="wait">

              {/* ============ PASSWORD MODE ============ */}
              {mode === "password" && (
                <motion.div key="password" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-4">

                  {/* GEO CHALLENGE */}
                  {challenge.active && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/30 space-y-3">
                      <div className="flex items-center gap-2 text-orange-400">
                        <Globe className="w-4 h-4 shrink-0" />
                        <p className="font-semibold text-sm">Blocage géographique détecté 🇺🇸→🇧🇯</p>
                      </div>
                      <p className="text-xs text-orange-200/80">
                        Instagram bloque depuis les serveurs USA. Ouvre l'app Instagram sur ton téléphone (au Bénin), approve la notification de sécurité, puis clique ci-dessous.
                      </p>

                      {challenge.type === "code" && (
                        <div className="space-y-2 pt-1">
                          <Input
                            placeholder="Code reçu par SMS/email (ex: 123456)"
                            value={verifyCode}
                            onChange={e => setVerifyCode(e.target.value)}
                            className="bg-background/50 h-10 rounded-lg text-center font-mono tracking-widest"
                            maxLength={8}
                          />
                          <Button onClick={handleSubmitCode} disabled={codeSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white h-10 rounded-xl text-sm">
                            {codeSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Vérification...</> : "Valider le code"}
                          </Button>
                        </div>
                      )}

                      <Button onClick={handleRetryAfterApproval} disabled={loginMutation.isPending} className="w-full bg-orange-500 hover:bg-orange-600 text-white h-10 rounded-xl text-sm">
                        {loginMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Tentative...</> : <><CheckCircle2 className="w-4 h-4 mr-2" /> J'ai approuvé — Réessayer</>}
                      </Button>

                      <p className="text-[11px] text-center text-muted-foreground">
                        Ou utilise l'onglet{" "}
                        <button className="underline text-primary font-medium" onClick={() => { setChallenge(c => ({ ...c, active: false })); setMode("cookies"); }}>
                          Import Cookies
                        </button>{" "}
                        pour contourner définitivement.
                      </p>

                      <button onClick={() => setChallenge(c => ({ ...c, active: false }))} className="w-full text-xs text-muted-foreground text-center flex items-center justify-center gap-1 pt-1">
                        <RefreshCw className="w-3 h-3" /> Recommencer
                      </button>
                    </motion.div>
                  )}

                  {/* LOGIN FORM */}
                  {!challenge.active && (
                    <>
                      <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex gap-2 text-yellow-200">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-yellow-500" />
                        <p className="text-xs leading-relaxed">
                          Si Instagram bloque (serveur USA), utilise l'onglet <strong>Import Cookies</strong> pour contourner.
                        </p>
                      </div>

                      <form onSubmit={form.handleSubmit(onPasswordSubmit)} className="space-y-4" noValidate>
                        <div className="space-y-2">
                          <Label>Nom d'utilisateur Instagram</Label>
                          <Input type="text" placeholder="username (sans @)" autoComplete="username"
                            className="bg-background/50 h-11 rounded-xl"
                            {...form.register("username")} />
                          {form.formState.errors.username && <p className="text-xs text-destructive">{form.formState.errors.username.message}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label>Mot de passe</Label>
                          <Input type="password" placeholder="••••••••" autoComplete="current-password"
                            className="bg-background/50 h-11 rounded-xl"
                            {...form.register("password")} />
                          {form.formState.errors.password && <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>}
                        </div>
                        <Button type="submit" disabled={loginMutation.isPending} className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-white font-medium">
                          {loginMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Connexion...</> : <><ShieldCheck className="w-4 h-4 mr-2" /> Connexion sécurisée</>}
                        </Button>
                        {loginMutation.isPending && <p className="text-xs text-center text-muted-foreground animate-pulse">Vérification Instagram... jusqu'à 60 secondes</p>}
                      </form>
                    </>
                  )}
                </motion.div>
              )}

              {/* ============ COOKIE MODE ============ */}
              {mode === "cookies" && (
                <motion.div key="cookies" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">

                  <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 space-y-3">
                    <div className="flex items-center gap-2 text-blue-300">
                      <Cookie className="w-4 h-4" />
                      <p className="font-semibold text-sm">Contournement via cookies de navigateur</p>
                    </div>
                    <p className="text-xs text-blue-200/80 leading-relaxed">
                      Connecte-toi à Instagram depuis <strong>ton téléphone/PC au Bénin</strong>, puis copie tes cookies ici.
                      Instagram fait confiance à cette session — plus de blocage géo.
                    </p>

                    <div className="space-y-2 text-xs text-blue-200/70">
                      <p className="font-semibold text-blue-300">Comment obtenir tes cookies :</p>
                      <div className="space-y-1.5">
                        {[
                          "Ouvre Instagram.com dans Chrome/Firefox",
                          "Connecte-toi avec ton compte",
                          'Appuie F12 → onglet "Application" (Chrome) ou "Stockage" (Firefox)',
                          'Clique sur Cookies → https://www.instagram.com',
                          'Sélectionne tout (Ctrl+A) et copie, OU copie uniquement le champ "Cookie" de la requête réseau',
                          "Colle ici et clique Importer"
                        ].map((step, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <span className="w-4 h-4 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 text-[10px] font-bold">{i + 1}</span>
                            <span>{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-1 text-xs text-blue-200/60 font-mono bg-black/20 rounded p-2">
                      Format attendu : <span className="text-blue-300">sessionid=ABC123; csrftoken=XYZ; ds_user_id=456...</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Username Instagram (optionnel, aide à la vérification)</Label>
                    <Input
                      type="text"
                      placeholder="iamviral304"
                      value={cookieUsername}
                      onChange={e => setCookieUsername(e.target.value)}
                      className="bg-background/50 h-10 rounded-xl text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Cookies Instagram (depuis ton navigateur)</Label>
                    <Textarea
                      placeholder="sessionid=ABC123; csrftoken=XYZ789; ds_user_id=123456789; mid=...; ig_did=..."
                      value={cookieString}
                      onChange={e => setCookieString(e.target.value)}
                      className="bg-background/50 rounded-xl min-h-[100px] text-xs font-mono resize-none"
                    />
                    <p className="text-xs text-muted-foreground">Le cookie <strong>sessionid</strong> est obligatoire. Les autres améliorent la stabilité.</p>
                  </div>

                  <Button
                    onClick={handleCookieImport}
                    disabled={cookieLoading || !cookieString.trim()}
                    className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-white font-medium"
                  >
                    {cookieLoading
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Import en cours...</>
                      : <><Cookie className="w-4 h-4 mr-2" /> Importer et se connecter</>
                    }
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
