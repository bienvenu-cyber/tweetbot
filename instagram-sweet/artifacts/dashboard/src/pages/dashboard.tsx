import { motion } from "framer-motion";
import { Users, MessageCircle, Send, CheckCircle2, AlertCircle, Clock, Activity, Instagram, Mail, Phone, Globe, BadgeCheck, Briefcase, Link, Calendar, Shield } from "lucide-react";
import { useAccount } from "@/hooks/use-auth";
import { useLogs } from "@/hooks/use-logs";
import { useQueue } from "@/hooks/use-queue";
import { useSelectedAccount } from "@/hooks/use-selected-account";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AccountSelector } from "@/components/account-selector";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";

export default function Dashboard() {
  const { selectedAccount, setSelectedAccount } = useSelectedAccount();
  const { data: account, isLoading: accountLoading, error: accountError } = useAccount();
  const { data: queueData } = useQueue();
  const { data: logsData } = useLogs({ limit: 10 });

  const accountFailed = !!accountError;
  const stats = [
    { title: "Pending Actions", value: queueData?.total || 0, icon: Clock, color: "text-blue-500", bg: "bg-blue-500/10" },
    { title: "Recent Logs", value: logsData?.total || 0, icon: Activity, color: "text-purple-500", bg: "bg-purple-500/10" },
    { title: "Followers", value: accountFailed ? "—" : (account?.followers_count || 0), icon: Users, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { title: "Following", value: accountFailed ? "—" : (account?.following_count || 0), icon: Users, color: "text-orange-500", bg: "bg-orange-500/10" },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of your Instagram automation.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <Card key={i} className="border-border bg-card shadow-sm hover:shadow-md transition-all duration-200">
            <CardContent className="p-6 flex items-center gap-4">
              <div className={`p-4 rounded-xl ${stat.bg}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                <h3 className="text-2xl font-bold mt-1 text-foreground">{typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}</h3>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Multi-Account Selector */}
      <AccountSelector selected={selectedAccount} onSelect={setSelectedAccount} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Account Info Card */}
        <Card className="col-span-1 border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Instagram className="w-5 h-5 text-pink-500" />
              Connected Account
            </CardTitle>
          </CardHeader>
          <CardContent>
            {accountLoading ? (
              <div className="animate-pulse flex gap-4">
                <div className="w-16 h-16 rounded-full bg-secondary"></div>
                <div className="space-y-2 flex-1 pt-2">
                  <div className="h-4 bg-secondary rounded w-1/2"></div>
                  <div className="h-3 bg-secondary rounded w-1/3"></div>
                </div>
              </div>
             ) : accountError ? (
              <div className="text-center py-8 space-y-3">
                <AlertCircle className="w-10 h-10 mx-auto text-muted-foreground/60" />
                <p className="text-sm font-medium text-foreground">Infos du compte indisponibles</p>
                <p className="text-xs text-muted-foreground">Instagram bloque temporairement certaines requêtes depuis le serveur. La session est probablement toujours active, mais certaines actions peuvent être limitées.</p>
              </div>
            ) : account ? (
              <div className="text-center space-y-4">
                <div className="relative w-24 h-24 mx-auto">
                  <img 
                    src={(account as any).profile_pic_url_hd || account.profile_pic_url} 
                    alt={account.username} 
                    className="w-full h-full rounded-full object-cover border-2 border-primary/20 shadow-xl"
                  />
                  <div className="absolute bottom-0 right-0 w-6 h-6 bg-emerald-500 border-4 border-card rounded-full"></div>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1.5">
                    <h3 className="text-xl font-bold text-foreground">{account.full_name || account.username}</h3>
                    {(account as any).is_verified && <BadgeCheck className="w-5 h-5 text-blue-500" />}
                  </div>
                  <p className="text-primary font-medium">@{account.username}</p>
                  <div className="flex items-center justify-center gap-2 mt-1 flex-wrap">
                    {(account as any).is_business && (
                      <Badge variant="secondary" className="text-xs gap-1"><Briefcase className="w-3 h-3" />Business</Badge>
                    )}
                    {(account as any).category && (
                      <Badge variant="outline" className="text-xs">{(account as any).category}</Badge>
                    )}
                    {(account as any).is_private && (
                      <Badge variant="outline" className="text-xs gap-1"><Shield className="w-3 h-3" />Privé</Badge>
                    )}
                  </div>
                </div>
                {account.biography && (
                  <p className="text-sm text-muted-foreground bg-secondary/50 p-3 rounded-lg text-left">
                    {account.biography}
                  </p>
                )}
                
                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2 pt-4 border-t border-border">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Posts</p>
                    <p className="font-semibold text-foreground">{(account.media_count || 0).toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Followers</p>
                    <p className="font-semibold text-foreground">{(account.followers_count || 0).toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Following</p>
                    <p className="font-semibold text-foreground">{(account.following_count || 0).toLocaleString()}</p>
                  </div>
                </div>

                {/* Contact & details */}
                {((account as any).public_email || (account as any).public_phone || (account as any).external_url || (account as any).added_at) && (
                  <div className="space-y-2 pt-3 border-t border-border text-left">
                    {(account as any).public_email && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="w-4 h-4 text-primary/70" />
                        <span>{(account as any).public_email}</span>
                      </div>
                    )}
                    {(account as any).public_phone && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="w-4 h-4 text-primary/70" />
                        <span>{(account as any).public_phone}</span>
                      </div>
                    )}
                    {(account as any).external_url && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Globe className="w-4 h-4 text-primary/70" />
                        <a href={(account as any).external_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
                          {(account as any).external_url.replace(/^https?:\/\//, '')}
                        </a>
                      </div>
                    )}
                    {(account as any).added_at && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4 text-primary/70" />
                        <span>Ajouté {formatDistanceToNow(new Date((account as any).added_at), { addSuffix: true, locale: fr })}</span>
                      </div>
                    )}
                    {(account as any).last_login_at && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4 text-primary/70" />
                        <span>Dernière connexion {formatDistanceToNow(new Date((account as any).last_login_at), { addSuffix: true, locale: fr })}</span>
                      </div>
                    )}
                    {(account as any).pk && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Link className="w-4 h-4 text-primary/70" />
                        <span className="font-mono text-xs">ID: {(account as any).pk}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">Account info not available.</div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="col-span-1 lg:col-span-2 border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest actions executed by the bot.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {logsData?.logs && logsData.logs.length > 0 ? (
                logsData.logs.map((log) => (
                  <div key={log.id} className="flex items-start gap-4 p-4 rounded-xl bg-secondary/30 border border-border/50 hover:bg-secondary/50 transition-colors">
                    <div className="mt-1">
                      {log.status === "success" ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      ) : log.status === "failed" ? (
                        <AlertCircle className="w-5 h-5 text-destructive" />
                      ) : (
                        <Clock className="w-5 h-5 text-blue-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground capitalize">
                          {log.action_type.replace('_', ' ')}
                        </p>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        <span className="font-medium text-foreground">{log.target}</span>: {log.message}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Activity className="w-12 h-12 mx-auto text-muted/50 mb-3" />
                  <p>No recent activity found.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
