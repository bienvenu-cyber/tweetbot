import { useState } from "react";
import { useAccounts, useToggleAccount, useRemoveAccount, useSetAccountProxy, type BotAccount } from "@/hooks/use-accounts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, Trash2, Loader2, LogIn, Shield, Cookie, KeyRound, Globe, CheckCircle2, RefreshCw, Wifi, Smartphone } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { BOT_API_BASE, apiFetch } from "@/config";
import { useQueryClient } from "@tanstack/react-query";

interface AccountSelectorProps {
  selected: string | null;
  onSelect: (username: string | null) => void;
}

type AddMode = "cookies" | "password";

type ChallengeState = {
  active: boolean;
  type: "code" | "approve" | null;
  geoBlocked: boolean;
  username: string;
  password: string;
};

export function AccountSelector({ selected, onSelect }: AccountSelectorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: accounts = [], isLoading } = useAccounts();
  const toggleAccount = useToggleAccount();
  const removeAccount = useRemoveAccount();
  const setAccountProxy = useSetAccountProxy();

  const [proxyEditing, setProxyEditing] = useState<string | null>(null);
  const [proxyValue, setProxyValue] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>("cookies");

  // Password form
  const [passForm, setPassForm] = useState({ username: "", password: "" });
  const [passLoading, setPassLoading] = useState(false);

  // Cookie form
  const [cookieString, setCookieString] = useState("");
  const [cookieUsername, setCookieUsername] = useState("");
  const [cookieLoading, setCookieLoading] = useState(false);

  // Challenge state
  const [challenge, setChallenge] = useState<ChallengeState>({
    active: false, type: null, geoBlocked: false, username: "", password: ""
  });
  const [verifyCode, setVerifyCode] = useState("");
  const [codeSubmitting, setCodeSubmitting] = useState(false);

  const invalidateAll = async () => {
    await queryClient.invalidateQueries({ queryKey: ["accounts"] });
    await queryClient.invalidateQueries({ queryKey: ["auth-status"] });
    await queryClient.invalidateQueries({ queryKey: ["account-info"] });
  };

  const resetForms = () => {
    setPassForm({ username: "", password: "" });
    setCookieString("");
    setCookieUsername("");
    setChallenge({ active: false, type: null, geoBlocked: false, username: "", password: "" });
    setVerifyCode("");
  };

  const closeDialog = () => {
    setShowAdd(false);
    resetForms();
  };

  // ---- Password login ----
  const handlePasswordLogin = async () => {
    const username = passForm.username.replace(/^@/, "").trim().toLowerCase();
    if (!username || !passForm.password) {
      toast({ title: "Erreur", description: "Username et mot de passe requis.", variant: "destructive" });
      return;
    }
    setPassLoading(true);
    console.log("[ADD-ACCOUNT] Password login for:", username);
    try {
      const res = await apiFetch(`${BOT_API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password: passForm.password }),
      }, 90000);

      const data = await res.json();
      console.log("[ADD-ACCOUNT] Password login response:", JSON.stringify(data));

      if (data.success) {
        toast({ title: "✓ Compte ajouté !", description: `@${data.username} connecté.` });
        await invalidateAll();
        closeDialog();
        return;
      }

      if (data.challenge) {
        console.log("[ADD-ACCOUNT] Challenge required:", data.challenge_type);
        setChallenge({
          active: true,
          type: data.challenge_type || "approve",
          geoBlocked: data.geo_blocked ?? true,
          username,
          password: passForm.password,
        });
        return;
      }

      toast({ title: "Connexion échouée", description: data.message, variant: "destructive" });
    } catch (e: any) {
      console.error("[ADD-ACCOUNT] Password login error:", e);
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setPassLoading(false);
    }
  };

  // ---- Retry after approval ----
  const handleRetryAfterApproval = async () => {
    setPassLoading(true);
    console.log("[ADD-ACCOUNT] Retry after approval for:", challenge.username);
    try {
      const res = await apiFetch(`${BOT_API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: challenge.username, password: challenge.password }),
      }, 90000);

      const data = await res.json();
      console.log("[ADD-ACCOUNT] Retry response:", JSON.stringify(data));

      if (data.success) {
        toast({ title: "✓ Compte ajouté !", description: `@${data.username} connecté.` });
        await invalidateAll();
        closeDialog();
      } else if (data.challenge) {
        toast({ title: "Toujours bloqué", description: "Instagram demande encore une vérification. Essaie les cookies.", variant: "destructive" });
      } else {
        toast({ title: "Échec", description: data.message, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setPassLoading(false);
    }
  };

  // ---- Challenge code ----
  const handleSubmitCode = async () => {
    if (!verifyCode.trim()) {
      toast({ title: "Erreur", description: "Entre le code de vérification.", variant: "destructive" });
      return;
    }
    setCodeSubmitting(true);
    console.log("[ADD-ACCOUNT] Submit challenge code for:", challenge.username);
    try {
      const res = await apiFetch(`${BOT_API_BASE}/auth/challenge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: challenge.username, code: verifyCode.trim() }),
      }, 90000);

      const data = await res.json();
      console.log("[ADD-ACCOUNT] Challenge code response:", JSON.stringify(data));

      if (data.success) {
        toast({ title: "✓ Compte ajouté !", description: `@${data.username} connecté.` });
        await invalidateAll();
        closeDialog();
      } else {
        toast({ title: "Code invalide", description: data.message, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setCodeSubmitting(false);
    }
  };

  // ---- Cookie import ----
  const handleCookieImport = async () => {
    if (!cookieString.trim()) {
      toast({ title: "Erreur", description: "Colle tes cookies Instagram.", variant: "destructive" });
      return;
    }
    setCookieLoading(true);
    console.log("[ADD-ACCOUNT] Cookie import, length:", cookieString.trim().length, "username:", cookieUsername);
    try {
      const res = await apiFetch(`${BOT_API_BASE}/auth/import-cookies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cookie_string: cookieString.trim(),
          username: cookieUsername.trim() || undefined,
        }),
      }, 90000);

      const data = await res.json();
      console.log("[ADD-ACCOUNT] Cookie import response:", JSON.stringify(data));

      if (data.success) {
        toast({ title: "✓ Compte ajouté via cookies !", description: data.message });
        await invalidateAll();
        closeDialog();
      } else {
        toast({ title: "Import échoué", description: data.message, variant: "destructive" });
      }
    } catch (e: any) {
      console.error("[ADD-ACCOUNT] Cookie import error:", e);
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setCookieLoading(false);
    }
  };

  const handleRemove = (username: string) => {
    if (!confirm(`Supprimer @${username} ?`)) return;
    removeAccount.mutate(username, {
      onSuccess: () => {
        toast({ title: "Supprimé", description: `@${username} déconnecté.` });
        if (selected === username) onSelect(null);
      },
    });
  };

  return (
    <>
      <Card className="border-border shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Comptes Connectés
              </CardTitle>
              <CardDescription className="mt-1">
                {accounts.length}/20 comptes · Sélectionne un compte pour cibler les actions
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowAdd(true)} disabled={accounts.length >= 20}>
              <Plus className="w-4 h-4 mr-1" /> Ajouter
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Aucun compte connecté. Ajoute-en un pour commencer.
            </div>
          ) : (
            accounts.map((acc) => (
              <div
                key={acc.id}
                onClick={() => onSelect(acc.username === selected ? null : acc.username)}
                className={`
                  flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200
                  ${acc.username === selected 
                    ? "border-primary bg-primary/5 shadow-sm shadow-primary/10" 
                    : "border-border/50 bg-secondary/30 hover:bg-secondary/50"}
                `}
              >
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-bold text-foreground">
                    {acc.username.substring(0, 2).toUpperCase()}
                  </div>
                  <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${
                    acc.is_logged_in ? "bg-emerald-500" : "bg-muted-foreground"
                  }`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-foreground truncate">@{acc.username}</p>
                    {acc.proxy_url && (
                      <Wifi className="w-3 h-3 text-emerald-500" title="Proxy dédié" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {acc.last_action_at
                      ? `Actif ${formatDistanceToNow(new Date(acc.last_action_at), { addSuffix: true })}`
                      : "Aucune activité"}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {acc.is_logged_in ? (
                    <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 text-xs">En ligne</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground text-xs">Hors ligne</Badge>
                  )}
                  <Switch
                    checked={acc.is_active}
                    onCheckedChange={(v) => {
                      toggleAccount.mutate({ username: acc.username, is_active: v });
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-muted-foreground hover:text-primary h-8 w-8"
                    title="Configurer proxy"
                    onClick={(e) => {
                      e.stopPropagation();
                      setProxyEditing(proxyEditing === acc.username ? null : acc.username);
                      setProxyValue(acc.proxy_url || "");
                    }}
                  >
                    <Globe className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive h-8 w-8"
                    onClick={(e) => { e.stopPropagation(); handleRemove(acc.username); }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              {/* Inline proxy editor */}
              {proxyEditing === acc.username && (
                <div className="ml-13 p-3 rounded-lg bg-secondary/50 border border-border/50 space-y-2" onClick={(e) => e.stopPropagation()}>
                  <Label className="text-xs">Proxy dédié pour @{acc.username}</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="socks5://user:pass@host:port"
                      value={proxyValue}
                      onChange={(e) => setProxyValue(e.target.value)}
                      className="bg-background/50 text-xs font-mono h-8 flex-1"
                    />
                    <Button
                      size="sm"
                      className="h-8 text-xs"
                      disabled={setAccountProxy.isPending}
                      onClick={() => {
                        setAccountProxy.mutate(
                          { username: acc.username, proxy_url: proxyValue },
                          {
                            onSuccess: (data) => {
                              toast({ title: "✓ Proxy mis à jour", description: data.message });
                              setProxyEditing(null);
                            },
                            onError: (err) => toast({ title: "Erreur", description: err.message, variant: "destructive" }),
                          }
                        );
                      }}
                    >
                      {setAccountProxy.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Sauver"}
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Laisse vide pour utiliser le proxy global. Format: socks5:// ou http://</p>
                </div>
              )}
            ))
          )}
        </CardContent>
      </Card>

      {/* Add Account Dialog */}
      <Dialog open={showAdd} onOpenChange={(open) => { if (!open) closeDialog(); else setShowAdd(true); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogIn className="w-5 h-5 text-primary" /> Ajouter un Compte Instagram
            </DialogTitle>
            <DialogDescription>
              Les cookies sont recommandés pour éviter le blocage géographique.
            </DialogDescription>
          </DialogHeader>

          {/* Mode Tabs */}
          <div className="flex rounded-xl bg-secondary/30 p-1 gap-1">
            <button
              onClick={() => { setAddMode("cookies"); setChallenge(c => ({ ...c, active: false })); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                addMode === "cookies" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Cookie className="w-4 h-4" /> Cookies (recommandé)
            </button>
            <button
              onClick={() => setAddMode("password")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                addMode === "password" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <KeyRound className="w-4 h-4" /> Mot de passe
            </button>
          </div>

          <div className="space-y-4 py-2">
            {/* ===== COOKIE MODE ===== */}
            {addMode === "cookies" && (
              <>
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 space-y-2">
                  <p className="text-xs font-semibold text-blue-300 flex items-center gap-1">
                    <Cookie className="w-3.5 h-3.5" /> Comment obtenir tes cookies :
                  </p>
                  <ol className="text-xs text-blue-200/80 space-y-1 list-decimal list-inside">
                    <li>Ouvre <strong>Instagram.com</strong> dans Chrome/Firefox</li>
                    <li>Connecte-toi avec le compte à ajouter</li>
                    <li>F12 → Application → Cookies → instagram.com</li>
                    <li>Copie tous les cookies (Ctrl+A) ou le header Cookie</li>
                  </ol>
                  <p className="text-[11px] text-blue-200/60 font-mono bg-black/20 rounded px-2 py-1">
                    Format : sessionid=ABC; csrftoken=XYZ; ds_user_id=123...
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Username Instagram (optionnel)</Label>
                  <Input
                    placeholder="username"
                    value={cookieUsername}
                    onChange={(e) => setCookieUsername(e.target.value)}
                    className="bg-background/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Cookies Instagram</Label>
                  <Textarea
                    placeholder="sessionid=ABC123; csrftoken=XYZ789; ds_user_id=123456789..."
                    value={cookieString}
                    onChange={(e) => setCookieString(e.target.value)}
                    className="bg-background/50 min-h-[80px] text-xs font-mono resize-none"
                  />
                </div>

                <Button
                  onClick={handleCookieImport}
                  disabled={cookieLoading || !cookieString.trim()}
                  className="w-full"
                >
                  {cookieLoading
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Import en cours...</>
                    : <><Cookie className="w-4 h-4 mr-2" /> Importer et connecter</>
                  }
                </Button>
              </>
            )}

            {/* ===== PASSWORD MODE ===== */}
            {addMode === "password" && !challenge.active && (
              <>
                <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex gap-2 text-yellow-200">
                  <Globe className="w-4 h-4 shrink-0 mt-0.5 text-yellow-500" />
                  <p className="text-xs">
                    Le serveur est aux USA — Instagram peut bloquer la connexion. Utilise les <strong>cookies</strong> si tu es au Bénin.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Username Instagram</Label>
                  <Input
                    placeholder="username (sans @)"
                    value={passForm.username}
                    onChange={(e) => setPassForm(f => ({ ...f, username: e.target.value }))}
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mot de passe</Label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={passForm.password}
                    onChange={(e) => setPassForm(f => ({ ...f, password: e.target.value }))}
                    className="bg-background/50"
                  />
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/50 p-3 rounded-lg">
                  <Shield className="w-4 h-4 shrink-0" />
                  Mot de passe chiffré (AES-256 Fernet) avant stockage. Jamais en clair.
                </div>

                <Button onClick={handlePasswordLogin} disabled={passLoading} className="w-full">
                  {passLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Connexion...</> : "Connecter le compte"}
                </Button>
              </>
            )}

            {/* ===== CHALLENGE STATE ===== */}
            {addMode === "password" && challenge.active && (
              <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/30 space-y-3">
                <div className="flex items-center gap-2 text-orange-400">
                  <Globe className="w-4 h-4 shrink-0" />
                  <p className="font-semibold text-sm">Blocage géographique détecté</p>
                </div>
                <p className="text-xs text-orange-200/80">
                  Instagram bloque depuis les serveurs USA. Ouvre l'app Instagram sur ton téléphone, approuve la notification de sécurité, puis clique ci-dessous.
                </p>

                {challenge.type === "code" && (
                  <div className="space-y-2 pt-1">
                    <Input
                      placeholder="Code reçu par SMS/email (ex: 123456)"
                      value={verifyCode}
                      onChange={e => setVerifyCode(e.target.value)}
                      className="bg-background/50 text-center font-mono tracking-widest"
                      maxLength={8}
                    />
                    <Button onClick={handleSubmitCode} disabled={codeSubmitting} className="w-full" variant="secondary">
                      {codeSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Vérification...</> : "Valider le code"}
                    </Button>
                  </div>
                )}

                <Button onClick={handleRetryAfterApproval} disabled={passLoading} className="w-full bg-orange-500 hover:bg-orange-600 text-white">
                  {passLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Tentative...</> : <><CheckCircle2 className="w-4 h-4 mr-2" /> J'ai approuvé — Réessayer</>}
                </Button>

                <p className="text-[11px] text-center text-muted-foreground">
                  Ou utilise l'onglet{" "}
                  <button className="underline text-primary font-medium" onClick={() => { setChallenge(c => ({ ...c, active: false })); setAddMode("cookies"); }}>
                    Cookies
                  </button>{" "}
                  pour contourner.
                </p>

                <button onClick={() => setChallenge(c => ({ ...c, active: false }))} className="w-full text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                  <RefreshCw className="w-3 h-3" /> Recommencer
                </button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
