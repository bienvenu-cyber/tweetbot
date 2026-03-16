import { motion } from "framer-motion";
import { Users, MessageCircle, Send, CheckCircle2, AlertCircle, Clock, Activity, Instagram } from "lucide-react";
import { useAccount } from "@/hooks/use-auth";
import { useLogs } from "@/hooks/use-logs";
import { useQueue } from "@/hooks/use-queue";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

export default function Dashboard() {
  const { data: account, isLoading: accountLoading } = useAccount();
  const { data: queueData } = useQueue();
  const { data: logsData } = useLogs({ limit: 10 });

  const stats = [
    { title: "Pending Actions", value: queueData?.total || 0, icon: Clock, color: "text-blue-500", bg: "bg-blue-500/10" },
    { title: "Recent Logs", value: logsData?.total || 0, icon: Activity, color: "text-purple-500", bg: "bg-purple-500/10" },
    { title: "Followers", value: account?.followers_count || 0, icon: Users, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { title: "Following", value: account?.following_count || 0, icon: Users, color: "text-orange-500", bg: "bg-orange-500/10" },
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
                <h3 className="text-2xl font-bold mt-1 text-foreground">{stat.value.toLocaleString()}</h3>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

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
            ) : account ? (
              <div className="text-center space-y-4">
                <div className="relative w-24 h-24 mx-auto">
                  <img 
                    src={account.profile_pic_url} 
                    alt={account.username} 
                    className="w-full h-full rounded-full object-cover border-2 border-primary/20 shadow-xl"
                  />
                  <div className="absolute bottom-0 right-0 w-6 h-6 bg-emerald-500 border-4 border-card rounded-full"></div>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground">{account.full_name || account.username}</h3>
                  <p className="text-primary font-medium">@{account.username}</p>
                </div>
                {account.biography && (
                  <p className="text-sm text-muted-foreground bg-secondary/50 p-3 rounded-lg text-left">
                    {account.biography}
                  </p>
                )}
                <div className="grid grid-cols-3 gap-2 pt-4 border-t border-border">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Posts</p>
                    <p className="font-semibold text-foreground">{account.media_count}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Followers</p>
                    <p className="font-semibold text-foreground">{account.followers_count}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Following</p>
                    <p className="font-semibold text-foreground">{account.following_count}</p>
                  </div>
                </div>
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
