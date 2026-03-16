import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuthStatus } from "@/hooks/use-auth";
import { AppLayout } from "@/components/layout/app-layout";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

// Pages
import Dashboard from "@/pages/dashboard";
import Login from "@/pages/login";
import DmManager from "@/pages/dm-manager";
import Comments from "@/pages/comments";
import Posts from "@/pages/posts";
import Queue from "@/pages/queue";
import Logs from "@/pages/logs";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const [location, setLocation] = useLocation();
  const { data: auth, isLoading } = useAuthStatus();

  useEffect(() => {
    if (!isLoading && !auth?.logged_in && location !== "/login") {
      setLocation("/login");
    }
  }, [isLoading, auth?.logged_in, location, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-primary">
        <Loader2 className="w-12 h-12 animate-spin mb-4" />
        <p className="text-muted-foreground animate-pulse font-display">Initializing Bot System...</p>
      </div>
    );
  }

  if (!auth?.logged_in) {
    return null;
  }

  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/dm" component={() => <ProtectedRoute component={DmManager} />} />
      <Route path="/comments" component={() => <ProtectedRoute component={Comments} />} />
      <Route path="/posts" component={() => <ProtectedRoute component={Posts} />} />
      <Route path="/queue" component={() => <ProtectedRoute component={Queue} />} />
      <Route path="/logs" component={() => <ProtectedRoute component={Logs} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
