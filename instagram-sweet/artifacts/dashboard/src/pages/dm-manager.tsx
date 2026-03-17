import { useState } from "react";
import { motion } from "framer-motion";
import { Send, Users, User, Clock, AlertCircle, MessageCircle, Download, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useSendDm, useBulkSendDm, useDmThreads, useFollowers } from "@/hooks/use-dm";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { BulkJobTracker } from "@/components/bulk-job-tracker";

const singleDmSchema = z.object({
  username: z.string().min(1, "Username is required"),
  message: z.string().min(1, "Message is required"),
});

const bulkDmSchema = z.object({
  message: z.string().min(1, "Message is required"),
  delay_min: z.coerce.number().min(5, "Min delay must be >= 5"),
  delay_max: z.coerce.number().min(10, "Max delay must be >= 10"),
});

export default function DmManager() {
  const { toast } = useToast();
  const sendDm = useSendDm();
  const bulkSendDm = useBulkSendDm();
  const { data: threadsData, isLoading: threadsLoading, error: threadsError } = useDmThreads(20);

  // Bulk campaign state
  const [bulkSource, setBulkSource] = useState<"manual" | "followers">("followers");
  const [manualUsernames, setManualUsernames] = useState("");
  const [followerCount, setFollowerCount] = useState(100);
  const [followersAccountUsernameInput, setFollowersAccountUsernameInput] = useState("");
  const [followersRequest, setFollowersRequest] = useState<{
    amount: number;
    accountUsername?: string;
    requestId: number;
  } | null>(null);
  const [skipAlreadySent, setSkipAlreadySent] = useState(true);
  const [currentBulkJobId, setCurrentBulkJobId] = useState<number | null>(null);

  const { data: followersData, isLoading: followersLoading, error: followersError } = useFollowers(
    followersRequest?.amount ?? followerCount,
    Boolean(followersRequest),
    followersRequest?.accountUsername,
    followersRequest?.requestId ?? 0,
  );

  const singleForm = useForm<z.infer<typeof singleDmSchema>>({
    resolver: zodResolver(singleDmSchema),
    defaultValues: { username: "", message: "" }
  });

  const bulkForm = useForm<z.infer<typeof bulkDmSchema>>({
    resolver: zodResolver(bulkDmSchema),
    defaultValues: { message: "", delay_min: 30, delay_max: 120 }
  });

  const onSingleSubmit = (data: z.infer<typeof singleDmSchema>) => {
    const cleanUsername = data.username.trim().replace(/^@/, '');
    sendDm.mutate({ ...data, username: cleanUsername }, {
      onSuccess: () => {
        toast({ title: "Message Sent", description: `Successfully sent to @${cleanUsername}` });
        singleForm.reset();
      },
      onError: (err) => {
        toast({ title: "Failed to send", description: err.message, variant: "destructive" });
      }
    });
  };

  const normalizedFollowersAccountUsername = followersAccountUsernameInput.trim().replace(/^@/, '').toLowerCase();

  const handleLoadFollowers = () => {
    setFollowersRequest({
      amount: followerCount,
      accountUsername: normalizedFollowersAccountUsername || undefined,
      requestId: (followersRequest?.requestId ?? 0) + 1,
    });
  };

  const onBulkSubmit = (data: z.infer<typeof bulkDmSchema>) => {
    let usernameArray: string[];

    if (bulkSource === "followers") {
      if (!followersData?.followers?.length) {
        toast({ title: "Error", description: "Charge d'abord les abonnés du compte source", variant: "destructive" });
        return;
      }
      usernameArray = followersData.followers.map(f => f.username);
    } else {
      usernameArray = manualUsernames.split("\n").map(u => u.trim().replace(/^@/, '')).filter(Boolean);
    }

    if (usernameArray.length === 0) {
      toast({ title: "Error", description: "Aucun utilisateur sélectionné", variant: "destructive" });
      return;
    }

    bulkSendDm.mutate({
      usernames: usernameArray,
      message: data.message,
      delay_min: data.delay_min,
      delay_max: data.delay_max,
      skip_already_sent: skipAlreadySent,
    }, {
      onSuccess: (res) => {
        setCurrentBulkJobId(res.job_id ?? null);
        toast({ title: "Campagne lancée", description: `${res.queued} messages en file d'attente.` });
        bulkForm.reset();
      },
      onError: (err) => {
        toast({ title: "Échec", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">DM Manager</h1>
        <p className="text-muted-foreground mt-1">Envoie des messages individuels ou lance des campagnes en masse.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="col-span-1 lg:col-span-2">
          <Tabs defaultValue="single" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 bg-secondary/50">
              <TabsTrigger value="single" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <User className="w-4 h-4 mr-2" /> Message unique
              </TabsTrigger>
              <TabsTrigger value="bulk" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Users className="w-4 h-4 mr-2" /> Campagne en masse
              </TabsTrigger>
            </TabsList>

            {/* Single DM tab */}
            <TabsContent value="single" className="m-0">
              <Card className="border-border">
                <CardHeader>
                  <CardTitle>Envoyer un DM</CardTitle>
                  <CardDescription>Envoie un message direct instantanément.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={singleForm.handleSubmit(onSingleSubmit)} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Nom d'utilisateur cible</Label>
                      <Input placeholder="johndoe123" {...singleForm.register("username")} className="bg-background/50" />
                      <p className="text-xs text-muted-foreground">Le nom d'utilisateur Instagram, sans le @. Ex: <code className="text-primary">johndoe123</code></p>
                    </div>
                    <div className="space-y-2">
                      <Label>Message</Label>
                      <Textarea placeholder="Salut ! Je voulais te contacter à propos de..." className="min-h-[120px] bg-background/50" {...singleForm.register("message")} />
                    </div>
                    <Button type="submit" disabled={sendDm.isPending} className="w-full bg-primary hover:bg-primary/90 text-white">
                      {sendDm.isPending ? "Envoi en cours..." : <><Send className="w-4 h-4 mr-2" /> Envoyer le message</>}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Bulk Campaign tab */}
            <TabsContent value="bulk" className="m-0">
              <Card className="border-border">
                <CardHeader>
                  <CardTitle>Campagne en masse</CardTitle>
                  <CardDescription>Envoie des messages à plusieurs utilisateurs avec des délais sûrs. Les doublons sont automatiquement ignorés.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <BulkJobTracker jobId={currentBulkJobId} onDone={() => setCurrentBulkJobId(null)} />
                    <form onSubmit={bulkForm.handleSubmit(onBulkSubmit)} className="space-y-4">
                    {/* Source selector */}
                    <div className="space-y-3">
                      <Label className="text-base font-semibold">Source des destinataires</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setBulkSource("followers")}
                          className={`p-4 rounded-lg border-2 text-left transition-all ${bulkSource === "followers" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}
                        >
                          <Users className="w-5 h-5 mb-2 text-primary" />
                          <p className="font-medium text-sm">Mes abonnés</p>
                          <p className="text-xs text-muted-foreground">Charger depuis ton compte</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setBulkSource("manual")}
                          className={`p-4 rounded-lg border-2 text-left transition-all ${bulkSource === "manual" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}
                        >
                          <MessageCircle className="w-5 h-5 mb-2 text-primary" />
                          <p className="font-medium text-sm">Liste manuelle</p>
                          <p className="text-xs text-muted-foreground">Coller des noms d'utilisateur</p>
                        </button>
                      </div>
                    </div>

                    {/* Followers source */}
                    {bulkSource === "followers" && (
                      <div className="space-y-3 bg-secondary/30 p-4 rounded-lg">
                        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_140px_auto] md:items-end">
                          <div className="space-y-1">
                            <Label>Username du compte source</Label>
                            <Input
                              type="text"
                              placeholder="compte_test"
                              value={followersAccountUsernameInput}
                              onChange={(e) => setFollowersAccountUsernameInput(e.target.value)}
                              className="bg-background/50"
                            />
                            <p className="text-xs text-muted-foreground">
                              Vide = compte Instagram actif par défaut.
                            </p>
                          </div>

                          <div className="space-y-1">
                            <Label>Nombre d'abonnés</Label>
                            <Input
                              type="number"
                              min={10}
                              max={500}
                              value={followerCount}
                              onChange={(e) => setFollowerCount(Number(e.target.value))}
                              className="bg-background/50"
                            />
                          </div>

                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleLoadFollowers}
                            disabled={followersLoading}
                            className="md:self-end"
                          >
                            {followersLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                            {followersLoading ? "Chargement..." : "Charger"}
                          </Button>
                        </div>

                         {followersError && (
                          <div className="flex items-center gap-2 text-destructive text-sm">
                            <XCircle className="w-4 h-4" />
                            <span>
                              {(followersError as Error).message?.includes("401") || (followersError as Error).message?.includes("Not logged in")
                                ? `Le compte source n'est pas connecté. Connecte-le d'abord via "Ajouter un compte" ou laisse le champ vide pour utiliser ton compte actif.`
                                : `Erreur: ${(followersError as Error).message}`}
                            </span>
                          </div>
                        )}

                        {followersData && (
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-primary" />
                            <span className="text-foreground">
                              {followersData.total} abonnés chargés
                              {followersRequest?.accountUsername ? ` depuis @${followersRequest.accountUsername}` : ""}
                            </span>
                          </div>
                        )}

                        {followersData && followersData.followers.length > 0 && (
                          <ScrollArea className="max-h-[150px]">
                            <div className="flex flex-wrap gap-1">
                              {followersData.followers.slice(0, 50).map(f => (
                                <Badge key={f.user_id} variant="secondary" className="text-xs">
                                  @{f.username}
                                </Badge>
                              ))}
                              {followersData.followers.length > 50 && (
                                <Badge variant="outline" className="text-xs">
                                  +{followersData.followers.length - 50} autres
                                </Badge>
                              )}
                            </div>
                          </ScrollArea>
                        )}
                      </div>
                    )}

                    {/* Manual source */}
                    {bulkSource === "manual" && (
                      <div className="space-y-2">
                        <Label>Noms d'utilisateur (un par ligne)</Label>
                        <Textarea
                          placeholder={"johndoe123\njanesmith456\nuser789"}
                          className="min-h-[120px] font-mono text-sm bg-background/50"
                          value={manualUsernames}
                          onChange={(e) => setManualUsernames(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          {manualUsernames.split("\n").filter(u => u.trim()).length} utilisateur(s) listés
                        </p>
                      </div>
                    )}

                    {/* Message */}
                    <div className="space-y-2">
                      <Label>Message de la campagne</Label>
                      <Textarea
                        placeholder="Salut ! Merci de me suivre, j'ai une proposition intéressante..."
                        className="min-h-[120px] bg-background/50"
                        {...bulkForm.register("message")}
                      />
                    </div>

                    {/* Delays */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Délai min (sec)</Label>
                        <div className="relative">
                          <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input type="number" className="pl-9 bg-background/50" {...bulkForm.register("delay_min")} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Délai max (sec)</Label>
                        <div className="relative">
                          <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input type="number" className="pl-9 bg-background/50" {...bulkForm.register("delay_max")} />
                        </div>
                      </div>
                    </div>

                    {/* Dedup toggle */}
                    <div className="flex items-center justify-between bg-secondary/30 p-3 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">Ignorer les doublons</p>
                        <p className="text-xs text-muted-foreground">Ne pas envoyer aux utilisateurs déjà contactés</p>
                      </div>
                      <Switch checked={skipAlreadySent} onCheckedChange={setSkipAlreadySent} />
                    </div>

                    {/* Warning */}
                    <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-lg flex items-start gap-2 text-yellow-200">
                      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                      <p className="text-xs">Les messages seront envoyés séquentiellement avec des délais aléatoires pour éviter les limitations d'Instagram.</p>
                    </div>

                    <Button type="submit" disabled={bulkSendDm.isPending} className="w-full bg-primary hover:bg-primary/90 text-white mt-4">
                      {bulkSendDm.isPending ? "Lancement..." : (
                        <>
                          <Users className="w-4 h-4 mr-2" />
                          Lancer la campagne
                          {bulkSource === "followers" && followersData ? ` (${followersData.total} abonnés)` : ""}
                        </>
                      )}
                    </Button>
                    </form>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Threads Sidebar */}
        <div className="col-span-1">
          <Card className="border-border h-full flex flex-col max-h-[800px]">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle>Boîte de réception</CardTitle>
            </CardHeader>
            <ScrollArea className="flex-1">
              {threadsLoading ? (
                <div className="p-4 space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex gap-3 animate-pulse">
                      <div className="w-10 h-10 rounded-full bg-secondary"></div>
                      <div className="flex-1 space-y-2 py-1">
                        <div className="h-4 bg-secondary rounded w-1/3"></div>
                        <div className="h-3 bg-secondary rounded w-full"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : threadsData?.threads && threadsData.threads.length > 0 ? (
                <div className="divide-y divide-border/50">
                  {threadsData.threads.map((thread) => (
                    <div key={thread.id} className="p-4 hover:bg-secondary/30 transition-colors cursor-pointer group">
                      <div className="flex justify-between items-start mb-1">
                        <p className="font-semibold text-sm truncate pr-2 group-hover:text-primary transition-colors">
                          {thread.users.join(", ")}
                        </p>
                        {thread.unread && <Badge variant="default" className="bg-primary hover:bg-primary shrink-0">New</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{thread.last_message}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  <MessageCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                  {threadsError ? (
                    <>
                      <p className="text-sm font-medium">Accès aux DMs indisponible</p>
                      <p className="text-xs mt-1">Instagram bloque l'accès à la boîte de réception depuis le serveur. Les envois de DM fonctionnent quand même.</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm">Aucune conversation récente</p>
                    </>
                  )}
                </div>
              )}
            </ScrollArea>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
