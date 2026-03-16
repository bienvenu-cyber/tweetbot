import { useState } from "react";
import { useAccounts, useAddAccount, useToggleAccount, useRemoveAccount, type BotAccount } from "@/hooks/use-accounts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, Trash2, Loader2, LogIn, Shield } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface AccountSelectorProps {
  selected: string | null;
  onSelect: (username: string | null) => void;
}

export function AccountSelector({ selected, onSelect }: AccountSelectorProps) {
  const { toast } = useToast();
  const { data: accounts = [], isLoading } = useAccounts();
  const addAccount = useAddAccount();
  const toggleAccount = useToggleAccount();
  const removeAccount = useRemoveAccount();

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ username: "", password: "" });

  const handleAdd = () => {
    if (!form.username || !form.password) return;
    addAccount.mutate(form, {
      onSuccess: () => {
        toast({ title: "Account added", description: `@${form.username} connected.` });
        setForm({ username: "", password: "" });
        setShowAdd(false);
      },
      onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    });
  };

  const handleRemove = (username: string) => {
    if (!confirm(`Remove @${username}?`)) return;
    removeAccount.mutate(username, {
      onSuccess: () => {
        toast({ title: "Removed", description: `@${username} disconnected.` });
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
                Connected Accounts
              </CardTitle>
              <CardDescription className="mt-1">
                {accounts.length}/20 accounts · Select one to target actions
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowAdd(true)} disabled={accounts.length >= 20}>
              <Plus className="w-4 h-4 mr-1" /> Add
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
              No accounts connected. Add one to start.
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
                  <p className="text-sm font-semibold text-foreground truncate">@{acc.username}</p>
                  <p className="text-xs text-muted-foreground">
                    {acc.last_action_at
                      ? `Active ${formatDistanceToNow(new Date(acc.last_action_at), { addSuffix: true })}`
                      : "No activity yet"}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {acc.is_logged_in ? (
                    <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 text-xs">Online</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground text-xs">Offline</Badge>
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
                    className="text-muted-foreground hover:text-destructive h-8 w-8"
                    onClick={(e) => { e.stopPropagation(); handleRemove(acc.username); }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Add Account Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogIn className="w-5 h-5 text-primary" /> Add Instagram Account
            </DialogTitle>
            <DialogDescription>
              Credentials are encrypted (AES-256) and stored securely.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              placeholder="Instagram username"
              value={form.username}
              onChange={(e) => setForm(f => ({ ...f, username: e.target.value }))}
            />
            <Input
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
            />
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/50 p-3 rounded-lg">
              <Shield className="w-4 h-4 shrink-0" />
              Password is encrypted with Fernet (AES) before storage. Never stored in plain text.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={addAccount.isPending}>
              {addAccount.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Connect Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
