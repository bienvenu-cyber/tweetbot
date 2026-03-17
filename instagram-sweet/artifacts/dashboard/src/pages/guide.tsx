import { useState } from "react";
import {
  BookOpen, Cookie, Shield, MessageSquare, Send, CalendarPlus, Bot,
  ExternalLink, AlertTriangle, CheckCircle2, XCircle, ChevronDown, ChevronRight,
  Monitor, Smartphone, Key, RefreshCw, Zap, HelpCircle, Settings, Users
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface GuideSection {
  id: string;
  icon: React.ElementType;
  title: string;
  badge?: string;
  badgeVariant?: "default" | "destructive" | "secondary" | "outline";
  content: React.ReactNode;
}

function CollapsibleGuide({ section }: { section: GuideSection }) {
  const [open, setOpen] = useState(false);
  const Icon = section.icon;
  return (
    <Card className="border-border/60 bg-card/80 backdrop-blur-sm overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left px-6 py-5 flex items-center gap-4 hover:bg-secondary/40 transition-colors"
      >
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground">{section.title}</h3>
            {section.badge && (
              <Badge variant={section.badgeVariant || "secondary"} className="text-[10px]">
                {section.badge}
              </Badge>
            )}
          </div>
        </div>
        {open ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
      </button>
      {open && (
        <CardContent className="px-6 pb-6 pt-0 border-t border-border/40">
          <div className="prose prose-sm prose-invert max-w-none mt-4 space-y-4 text-muted-foreground leading-relaxed">
            {section.content}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function StepList({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-3 list-none pl-0">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3 items-start">
          <span className="w-7 h-7 rounded-lg bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
            {i + 1}
          </span>
          <span className="text-sm text-foreground/80">{step}</span>
        </li>
      ))}
    </ol>
  );
}

function TipBox({ type, children }: { type: "warning" | "info" | "success" | "error"; children: React.ReactNode }) {
  const config = {
    warning: { icon: AlertTriangle, bg: "bg-yellow-500/10 border-yellow-500/30", text: "text-yellow-400", label: "Attention" },
    info: { icon: HelpCircle, bg: "bg-blue-500/10 border-blue-500/30", text: "text-blue-400", label: "Info" },
    success: { icon: CheckCircle2, bg: "bg-emerald-500/10 border-emerald-500/30", text: "text-emerald-400", label: "OK" },
    error: { icon: XCircle, bg: "bg-red-500/10 border-red-500/30", text: "text-red-400", label: "Erreur" },
  };
  const c = config[type];
  const Icon = c.icon;
  return (
    <div className={`rounded-xl border p-4 ${c.bg} flex gap-3`}>
      <Icon className={`w-5 h-5 ${c.text} shrink-0 mt-0.5`} />
      <div className="text-sm text-foreground/80">{children}</div>
    </div>
  );
}

export default function Guide() {
  const sections: GuideSection[] = [
    {
      id: "cookies",
      icon: Cookie,
      title: "Comment exporter et importer des cookies Instagram",
      badge: "Essentiel",
      badgeVariant: "destructive",
      content: (
        <>
          <p className="text-foreground/70">
            Les cookies sont la méthode la plus fiable pour connecter un compte Instagram au bot. 
            Voici comment les récupérer depuis un navigateur de bureau.
          </p>

          <h4 className="text-foreground font-semibold flex items-center gap-2 mt-6">
            <Monitor className="w-4 h-4 text-primary" /> Méthode 1 : Extension Cookie-Editor (Recommandé)
          </h4>
          <StepList steps={[
            "Installe l'extension Cookie-Editor sur Chrome ou Firefox",
            "Connecte-toi à instagram.com dans le navigateur",
            "Clique sur l'icône Cookie-Editor dans la barre d'extensions",
            "Clique sur \"Export\" → \"Export as JSON\" pour copier tous les cookies",
            "Dans le dashboard, va dans la page de gestion des comptes et colle le JSON dans le champ d'import",
          ]} />
          <div className="flex gap-3 mt-3 flex-wrap">
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <a href="https://chromewebstore.google.com/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3.5 h-3.5" /> Chrome Extension
              </a>
            </Button>
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <a href="https://addons.mozilla.org/fr/firefox/addon/cookie-editor/" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3.5 h-3.5" /> Firefox Extension
              </a>
            </Button>
          </div>

          <h4 className="text-foreground font-semibold flex items-center gap-2 mt-6">
            <Monitor className="w-4 h-4 text-primary" /> Méthode 2 : DevTools du navigateur
          </h4>
          <StepList steps={[
            "Connecte-toi à instagram.com",
            "Ouvre les DevTools (F12 ou Ctrl+Shift+I)",
            "Va dans l'onglet Application → Cookies → https://www.instagram.com",
            "Copie les valeurs de : sessionid, csrftoken, ds_user_id, mid, ig_did, rur",
            "Colle-les individuellement dans le formulaire d'import du dashboard",
          ]} />

          <TipBox type="warning">
            <strong>Impossible depuis l'app mobile !</strong> Il n'existe aucun moyen d'exporter les cookies depuis l'application Instagram mobile. 
            Tu dois obligatoirement passer par un navigateur de bureau.
          </TipBox>

          <TipBox type="info">
            <strong>Astuce :</strong> Connecte-toi à Instagram sur un navigateur en mode navigation privée, exporte les cookies, 
            puis ferme l'onglet SANS te déconnecter. Cela préservera la session.
          </TipBox>
        </>
      ),
    },
    {
      id: "cookie-errors",
      icon: AlertTriangle,
      title: "Comprendre les erreurs de cookies et sessions",
      badge: "Dépannage",
      content: (
        <>
          <div className="space-y-4">
            <div className="rounded-lg border border-border/50 p-4">
              <code className="text-xs text-red-400 block mb-2">{"user_has_logged_out (logout_reason: 9)"}</code>
              <p className="text-sm">La session a été <strong>invalidée par Instagram</strong>. Cela se produit quand :</p>
              <ul className="text-sm list-disc pl-5 mt-2 space-y-1">
                <li>Tu as utilisé la <strong>Déconnexion complète</strong> dans le dashboard (qui envoie un logout à Instagram)</li>
                <li>Tu t'es déconnecté manuellement sur instagram.com ou l'app</li>
                <li>Instagram a détecté une activité suspecte et a forcé la déconnexion</li>
              </ul>
              <p className="text-sm mt-2 text-primary">→ Solution : Réimporter de nouveaux cookies depuis une session fraîche</p>
            </div>

            <div className="rounded-lg border border-border/50 p-4">
              <code className="text-xs text-red-400 block mb-2">{"400 Bad Request sur direct_v2/inbox"}</code>
              <p className="text-sm">La session est valide mais Instagram <strong>bloque les DMs</strong> depuis cette session.</p>
              <p className="text-sm mt-2 text-primary">→ Solution : Envoie un DM manuellement sur l'app, puis réimporte les cookies</p>
            </div>

            <div className="rounded-lg border border-border/50 p-4">
              <code className="text-xs text-red-400 block mb-2">{"challenge_required"}</code>
              <p className="text-sm">Instagram demande une vérification (selfie, SMS, email).</p>
              <p className="text-sm mt-2 text-primary">→ Solution : Valide le challenge sur l'app/navigateur puis réimporte les cookies</p>
            </div>
          </div>

          <TipBox type="success">
            <strong>Règle d'or :</strong> Utilise toujours la <strong>Déconnexion rapide</strong> sauf si tu veux définitivement retirer un compte. 
            La déconnexion rapide préserve les cookies en base pour les réutiliser.
          </TipBox>
        </>
      ),
    },
    {
      id: "logout",
      icon: Key,
      title: "Déconnexion rapide vs complète",
      content: (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border/50 p-4 bg-secondary/20">
              <div className="flex items-center gap-2 mb-3">
                <RefreshCw className="w-4 h-4 text-blue-400" />
                <h4 className="font-semibold text-foreground">Déconnexion rapide</h4>
              </div>
              <ul className="text-sm space-y-2">
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" /> Retire le compte de la mémoire du bot</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" /> Cookies conservés en base de données</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" /> Reconnexion auto au prochain redémarrage</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" /> Session Instagram reste active</li>
              </ul>
            </div>
            <div className="rounded-xl border border-destructive/30 p-4 bg-destructive/5">
              <div className="flex items-center gap-2 mb-3">
                <XCircle className="w-4 h-4 text-red-400" />
                <h4 className="font-semibold text-foreground">Déconnexion complète</h4>
              </div>
              <ul className="text-sm space-y-2">
                <li className="flex items-start gap-2"><AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" /> Envoie un logout à Instagram</li>
                <li className="flex items-start gap-2"><XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" /> Cookies supprimés de la base</li>
                <li className="flex items-start gap-2"><XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" /> Mot de passe chiffré effacé</li>
                <li className="flex items-start gap-2"><XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" /> Réimport de cookies obligatoire</li>
              </ul>
            </div>
          </div>
          <TipBox type="warning">
            Après une déconnexion complète, le cookie exporté précédemment ne fonctionnera plus. 
            Tu devras te reconnecter sur Instagram et exporter de <strong>nouveaux</strong> cookies.
          </TipBox>
        </>
      ),
    },
    {
      id: "dm",
      icon: Send,
      title: "Guide d'utilisation du DM Manager",
      content: (
        <>
          <h4 className="text-foreground font-semibold">Envoi individuel</h4>
          <StepList steps={[
            "Va dans DM Manager depuis le menu latéral",
            "Entre le nom d'utilisateur du destinataire (sans @)",
            "Rédige ton message dans le champ de texte",
            "Clique sur Envoyer — le bot simulera un délai naturel",
          ]} />

          <h4 className="text-foreground font-semibold mt-6">Envoi en masse (Bulk)</h4>
          <StepList steps={[
            "Prépare une liste de noms d'utilisateurs (un par ligne ou séparés par des virgules)",
            "Rédige le message — tu peux utiliser {username} comme variable",
            "Configure le délai entre chaque envoi (recommandé: 60-180 secondes)",
            "Lance la campagne — le suivi en temps réel s'affiche via WebSocket",
          ]} />

          <TipBox type="warning">
            <strong>Limites Instagram :</strong> Ne dépasse pas 50-80 DMs par jour. Au-delà, Instagram peut bloquer temporairement 
            la fonctionnalité DM ou flaguer le compte. Le bot s'arrête automatiquement après 3 échecs consécutifs.
          </TipBox>

          <TipBox type="info">
            Si l'envoi échoue avec une erreur 400, la session DM est bloquée. Envoie un message manuellement 
            depuis l'app Instagram, puis réimporte les cookies.
          </TipBox>
        </>
      ),
    },
    {
      id: "comments",
      icon: MessageSquare,
      title: "Guide des commentaires automatiques",
      content: (
        <>
          <StepList steps={[
            "Va dans la section Comments depuis le menu",
            "Entre l'URL ou le shortcode du post cible",
            "Rédige ton commentaire",
            "Le bot poste le commentaire avec un délai aléatoire pour paraître naturel",
          ]} />
          <TipBox type="warning">
            Limite recommandée : 20-30 commentaires par jour. Les commentaires répétitifs ou identiques 
            sont détectés par Instagram et peuvent entraîner un shadowban.
          </TipBox>
        </>
      ),
    },
    {
      id: "posts",
      icon: CalendarPlus,
      title: "Programmer des publications",
      content: (
        <>
          <StepList steps={[
            "Va dans Auto Posts ou Scheduler",
            "Upload ton image (format carré 1080x1080 recommandé)",
            "Rédige ta légende avec hashtags",
            "Choisis la date et l'heure de publication",
            "Le scheduler vérifie toutes les 60 secondes et publie automatiquement",
          ]} />
          <TipBox type="info">
            Les posts programmés nécessitent que le bot soit en ligne et le compte connecté au moment de la publication. 
            Si le bot redémarre, les posts en attente seront automatiquement repris.
          </TipBox>
        </>
      ),
    },
    {
      id: "accounts",
      icon: Users,
      title: "Gestion multi-comptes",
      content: (
        <>
          <p className="text-foreground/70">Le bot supporte plusieurs comptes Instagram simultanément.</p>
          <StepList steps={[
            "Importe les cookies de chaque compte séparément",
            "Sélectionne le compte actif via le sélecteur en haut des pages",
            "Chaque compte a ses propres limites et statistiques",
            "Les campagnes bulk sont liées au compte sélectionné au moment du lancement",
          ]} />
          <TipBox type="warning">
            Utilise des <strong>proxys différents</strong> pour chaque compte afin d'éviter que Instagram 
            ne les associe via la même adresse IP.
          </TipBox>
        </>
      ),
    },
    {
      id: "proxy",
      icon: Shield,
      title: "Configuration du proxy",
      content: (
        <>
          <p className="text-foreground/70">
            Un proxy est fortement recommandé pour éviter les blocages liés à l'IP du serveur.
          </p>
          <StepList steps={[
            "Va dans Settings",
            "Entre l'URL du proxy au format : http://user:pass@host:port ou socks5://user:pass@host:port",
            "Clique sur \"Tester le proxy\" pour vérifier la connectivité",
            "L'IP affichée doit être différente de celle du serveur",
          ]} />
          <TipBox type="info">
            <strong>Proxys recommandés :</strong> Utilise des proxys résidentiels rotatifs (pas datacenter). 
            Fournisseurs populaires : Bright Data, Smartproxy, IPRoyal. 
            Les proxys datacenter sont souvent détectés et bloqués par Instagram.
          </TipBox>
        </>
      ),
    },
    {
      id: "settings",
      icon: Settings,
      title: "Paramètres et limites de sécurité",
      content: (
        <>
          <p className="text-foreground/70">Les paramètres contrôlent les limites quotidiennes et les délais entre les actions.</p>
          <div className="rounded-lg border border-border/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/30">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-foreground">Paramètre</th>
                  <th className="text-left px-4 py-2 font-medium text-foreground">Recommandé</th>
                  <th className="text-left px-4 py-2 font-medium text-foreground">Max sûr</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                <tr><td className="px-4 py-2">DM par jour</td><td className="px-4 py-2">30-50</td><td className="px-4 py-2">80</td></tr>
                <tr><td className="px-4 py-2">Délai entre DMs</td><td className="px-4 py-2">60-180s</td><td className="px-4 py-2">min 30s</td></tr>
                <tr><td className="px-4 py-2">Commentaires/jour</td><td className="px-4 py-2">20-30</td><td className="px-4 py-2">50</td></tr>
                <tr><td className="px-4 py-2">Délai commentaires</td><td className="px-4 py-2">30-90s</td><td className="px-4 py-2">min 20s</td></tr>
                <tr><td className="px-4 py-2">Posts/jour</td><td className="px-4 py-2">1-3</td><td className="px-4 py-2">5</td></tr>
              </tbody>
            </table>
          </div>
          <TipBox type="error">
            Dépasser ces limites peut entraîner un <strong>blocage temporaire</strong> (24-48h) ou un 
            <strong> bannissement permanent</strong> du compte Instagram.
          </TipBox>
        </>
      ),
    },
    {
      id: "architecture",
      icon: Zap,
      title: "Architecture technique du système",
      content: (
        <>
          <p className="text-foreground/70">Le système est composé de 3 couches :</p>
          <div className="space-y-3 mt-3">
            <div className="rounded-lg border border-border/50 p-3">
              <h5 className="font-semibold text-foreground text-sm">🖥️ Dashboard (Frontend)</h5>
              <p className="text-xs mt-1">React + Vite hébergé sur Lovable. Interface d'administration.</p>
            </div>
            <div className="rounded-lg border border-border/50 p-3">
              <h5 className="font-semibold text-foreground text-sm">⚡ Bot Python (Backend)</h5>
              <p className="text-xs mt-1">FastAPI + instagrapi hébergé sur Railway. Exécute les actions Instagram.</p>
            </div>
            <div className="rounded-lg border border-border/50 p-3">
              <h5 className="font-semibold text-foreground text-sm">🗄️ Base de données</h5>
              <p className="text-xs mt-1">Supabase (PostgreSQL). Stocke comptes, sessions, logs, files d'attente.</p>
            </div>
          </div>
          <TipBox type="info">
            Le Dashboard communique avec le Bot via des requêtes HTTP sécurisées par une clé API. 
            Le Bot accède à la base de données via une Edge Function proxy.
          </TipBox>
        </>
      ),
    },
  ];

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
            <BookOpen className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">Guide Admin</h1>
            <p className="text-muted-foreground text-sm">Tout ce que tu dois savoir pour gérer le bot Instagram</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {sections.map((section) => (
          <CollapsibleGuide key={section.id} section={section} />
        ))}
      </div>
    </div>
  );
}
