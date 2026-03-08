import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Eye, EyeOff, Loader2, Users } from "lucide-react";
import { toast } from "sonner";

interface Account {
  id: string;
  name: string;
  username: string | null;
  consumer_key: string;
  consumer_secret: string;
  access_token: string;
  access_token_secret: string;
  is_active: boolean;
  created_at: string;
}

const AccountManager = () => {
  const MAX_ACCOUNTS = 20;
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState({
    name: "",
    consumer_key: "",
    consumer_secret: "",
    access_token: "",
    access_token_secret: "",
  });

  const fetchAccounts = async () => {
    const { data, error } = await supabase
      .from("twitter_accounts")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setAccounts(data as Account[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleAdd = async () => {
    if (!form.name || !form.consumer_key || !form.consumer_secret || !form.access_token || !form.access_token_secret) {
      toast.error("Tous les champs sont requis");
      return;
    }
    setIsAdding(true);
    try {
      const { error } = await supabase.from("twitter_accounts").insert(form);
      if (error) throw error;
      toast.success("Compte ajouté !");
      setForm({ name: "", consumer_key: "", consumer_secret: "", access_token: "", access_token_secret: "" });
      setShowForm(false);
      fetchAccounts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur";
      toast.error(msg);
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggle = async (id: string, active: boolean) => {
    await supabase.from("twitter_accounts").update({ is_active: active }).eq("id", id);
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, is_active: active } : a)));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce compte ?")) return;
    await supabase.from("twitter_accounts").delete().eq("id", id);
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    toast.success("Compte supprimé");
  };

  const mask = (val: string) => val.slice(0, 6) + "•".repeat(Math.max(0, val.length - 6));

  return (
    <div className="glass-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold font-display gradient-text flex items-center gap-2">
          <Users className="w-5 h-5" /> Multi-Comptes
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{accounts.length}/{MAX_ACCOUNTS}</span>
          <Button
            size="sm"
            onClick={() => setShowForm(!showForm)}
            variant="secondary"
            disabled={accounts.length >= MAX_ACCOUNTS}
          >
            <Plus className="w-4 h-4 mr-1" />
            Ajouter
          </Button>
        </div>
      </div>

      {showForm && (
        <div className="bg-muted/30 rounded-lg p-4 space-y-3 animate-in fade-in slide-in-from-top-2">
          <Input
            placeholder="Nom du compte (ex: @monbot)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="bg-muted/50 border-border/50"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input
              placeholder="Consumer Key"
              value={form.consumer_key}
              onChange={(e) => setForm({ ...form, consumer_key: e.target.value })}
              className="bg-muted/50 border-border/50 font-mono text-xs"
            />
            <Input
              placeholder="Consumer Secret"
              type="password"
              value={form.consumer_secret}
              onChange={(e) => setForm({ ...form, consumer_secret: e.target.value })}
              className="bg-muted/50 border-border/50 font-mono text-xs"
            />
            <Input
              placeholder="Access Token"
              value={form.access_token}
              onChange={(e) => setForm({ ...form, access_token: e.target.value })}
              className="bg-muted/50 border-border/50 font-mono text-xs"
            />
            <Input
              placeholder="Access Token Secret"
              type="password"
              value={form.access_token_secret}
              onChange={(e) => setForm({ ...form, access_token_secret: e.target.value })}
              className="bg-muted/50 border-border/50 font-mono text-xs"
            />
          </div>
          <Button onClick={handleAdd} disabled={isAdding} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {isAdding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Ajouter le compte
          </Button>
        </div>
      )}

      {loading ? (
        <div className="text-center text-muted-foreground py-4">Chargement...</div>
      ) : accounts.length === 0 ? (
        <div className="text-center text-muted-foreground py-6 text-sm">
          Aucun compte. Les credentials d'environnement seront utilisés par défaut.
        </div>
      ) : (
        <div className="space-y-2">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="bg-muted/20 border border-border/30 rounded-lg p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Switch
                  checked={account.is_active}
                  onCheckedChange={(v) => handleToggle(account.id, v)}
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{account.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {showSecrets[account.id] ? account.consumer_key : mask(account.consumer_key)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setShowSecrets((p) => ({ ...p, [account.id]: !p[account.id] }))}
                  className="text-muted-foreground"
                >
                  {showSecrets[account.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleDelete(account.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AccountManager;
