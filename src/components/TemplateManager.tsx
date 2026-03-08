import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, RotateCcw, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";

interface Template {
  id: string;
  content: string;
  category: string;
  hashtags: string[];
  is_active: boolean;
  use_count: number;
  last_used_at: string | null;
  created_at: string;
}

interface TemplateManagerProps {
  refreshKey: number;
}

const CATEGORIES = [
  { value: "tech", label: "🖥️ Tech" },
  { value: "motivation", label: "🔥 Motivation" },
  { value: "business", label: "💼 Business" },
  { value: "engagement", label: "💬 Engagement" },
  { value: "promo", label: "📢 Promo" },
  { value: "lifestyle", label: "🌿 Lifestyle" },
  { value: "general", label: "📝 Général" },
];

const TemplateManager = ({ refreshKey }: TemplateManagerProps) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [filterCat, setFilterCat] = useState("all");
  const [form, setForm] = useState({ content: "", category: "general", hashtags: "" });

  const fetchTemplates = async () => {
    let query = supabase
      .from("tweet_templates")
      .select("*")
      .order("created_at", { ascending: false });

    if (filterCat !== "all") {
      query = query.eq("category", filterCat);
    }

    const { data, error } = await query.limit(100);
    if (!error && data) setTemplates(data as Template[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchTemplates();
  }, [refreshKey, filterCat]);

  const handleAdd = async () => {
    if (!form.content.trim()) return;
    setIsAdding(true);
    try {
      const hashtags = form.hashtags
        .split(",")
        .map((h) => h.trim())
        .filter(Boolean)
        .map((h) => (h.startsWith("#") ? h : `#${h}`));

      const { error } = await supabase.from("tweet_templates").insert({
        content: form.content.trim(),
        category: form.category,
        hashtags,
      });
      if (error) throw error;
      toast.success("Template ajouté !");
      setForm({ content: "", category: "general", hashtags: "" });
      setShowForm(false);
      fetchTemplates();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur";
      toast.error(msg);
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggle = async (id: string, active: boolean) => {
    await supabase.from("tweet_templates").update({ is_active: active }).eq("id", id);
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, is_active: active } : t)));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce template ?")) return;
    await supabase.from("tweet_templates").delete().eq("id", id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    toast.success("Template supprimé");
  };

  const handleResetUsage = async (id: string) => {
    await supabase.from("tweet_templates").update({ use_count: 0, last_used_at: null }).eq("id", id);
    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, use_count: 0, last_used_at: null } : t))
    );
    toast.success("Compteur réinitialisé");
  };

  const stats = {
    total: templates.length,
    active: templates.filter((t) => t.is_active).length,
    totalUses: templates.reduce((acc, t) => acc + t.use_count, 0),
  };

  return (
    <div className="glass-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold font-display gradient-text flex items-center gap-2">
          <FileText className="w-5 h-5" /> Templates
        </h2>
        <Button size="sm" onClick={() => setShowForm(!showForm)} variant="secondary">
          <Plus className="w-4 h-4 mr-1" />
          Ajouter
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-muted/30 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold font-mono text-foreground">{stats.total}</div>
          <div className="text-xs text-muted-foreground">Total</div>
        </div>
        <div className="bg-muted/30 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold font-mono text-green-400">{stats.active}</div>
          <div className="text-xs text-muted-foreground">Actifs</div>
        </div>
        <div className="bg-muted/30 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold font-mono text-primary">{stats.totalUses}</div>
          <div className="text-xs text-muted-foreground">Utilisations</div>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-muted/30 rounded-lg p-4 space-y-3 animate-in fade-in slide-in-from-top-2">
          <Textarea
            placeholder="Contenu du template (max 280 chars)"
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            className="min-h-[80px] bg-muted/50 border-border/50 resize-none"
          />
          <div className="flex items-center gap-2 text-xs text-muted-foreground justify-end font-mono">
            <span className={form.content.length > 280 ? "text-destructive" : ""}>{form.content.length}/280</span>
          </div>
          <div className="flex gap-3">
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger className="w-[160px] bg-muted/50 border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Hashtags (séparés par des virgules)"
              value={form.hashtags}
              onChange={(e) => setForm({ ...form, hashtags: e.target.value })}
              className="bg-muted/50 border-border/50 flex-1"
            />
          </div>
          <Button onClick={handleAdd} disabled={isAdding || !form.content.trim() || form.content.length > 280} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {isAdding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Ajouter
          </Button>
        </div>
      )}

      {/* Filter */}
      <Select value={filterCat} onValueChange={setFilterCat}>
        <SelectTrigger className="w-[180px] bg-muted/50 border-border/50">
          <SelectValue placeholder="Filtrer par catégorie" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Toutes catégories</SelectItem>
          {CATEGORIES.map((c) => (
            <SelectItem key={c.value} value={c.value}>
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* List */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {loading ? (
          <div className="text-center text-muted-foreground py-6">Chargement...</div>
        ) : templates.length === 0 ? (
          <div className="text-center text-muted-foreground py-6 text-sm">
            Aucun template. Utilise le générateur IA ou ajoute-en manuellement.
          </div>
        ) : (
          templates.map((template) => (
            <div
              key={template.id}
              className={`bg-muted/20 border rounded-lg p-4 transition-colors ${
                template.is_active ? "border-border/30 hover:bg-muted/30" : "border-border/10 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground line-clamp-2">{template.content}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-xs bg-secondary/50 text-secondary-foreground px-2 py-0.5 rounded">
                      {template.category}
                    </span>
                    {template.hashtags?.map((h, i) => (
                      <span key={i} className="text-xs text-primary/70 font-mono">
                        {h}
                      </span>
                    ))}
                    <span className="text-xs text-muted-foreground font-mono">
                      ×{template.use_count}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Switch
                    checked={template.is_active}
                    onCheckedChange={(v) => handleToggle(template.id, v)}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleResetUsage(template.id)}
                    className="text-muted-foreground"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(template.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TemplateManager;
