import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, MessageSquare, Send, CalendarPlus, 
  ListOrdered, Activity, Settings, LogOut, Loader2, Bot
} from "lucide-react";
import { useAuthStatus, useLogout, useAccount } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dm", label: "DM Manager", icon: Send },
  { href: "/comments", label: "Comments", icon: MessageSquare },
  { href: "/posts", label: "Auto Posts", icon: CalendarPlus },
  { href: "/queue", label: "Action Queue", icon: ListOrdered },
  { href: "/logs", label: "Activity Logs", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: auth, isLoading: authLoading } = useAuthStatus();
  const { data: account } = useAccount();
  const logoutMutation = useLogout();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 border-r border-border bg-sidebar flex flex-col hidden md:flex shrink-0 shadow-2xl">
        <div className="p-6">
          <div className="flex items-center gap-3 font-display text-xl font-bold tracking-tight text-white">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/20">
              <Bot className="w-5 h-5 text-white" />
            </div>
            InstaBot Pro
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto py-4">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group
                  ${isActive 
                    ? "bg-primary/10 text-primary font-medium" 
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"}
                `}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground transition-colors"}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {auth?.logged_in && (
          <div className="p-4 border-t border-border bg-card/50">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 border border-border/50">
              <Avatar className="w-10 h-10 border border-border">
                <AvatarImage src={account?.profile_pic_url || auth.profile_pic_url} />
                <AvatarFallback>{auth.username?.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{auth.username}</p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse"></span>
                  Online
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Mobile Header */}
        <header className="h-16 border-b border-border bg-card/80 backdrop-blur-md flex items-center px-4 md:hidden shrink-0 z-10 sticky top-0">
          <div className="font-display font-bold text-lg flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            InstaBot Pro
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
