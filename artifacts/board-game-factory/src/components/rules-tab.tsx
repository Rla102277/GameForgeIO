import { useState, useRef, useEffect } from "react";
import { renderMarkdown } from "@/lib/markdown";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListRules, useCreateRule, useDeleteRule,
  useGetRulesSandboxHistory, useClearRulesSandboxHistory,
  getListRulesQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Send, Trash2, Bot, User, Trash, Sparkles, Loader2, Check,
  ShieldAlert, AlertTriangle, Info, CheckCircle, ChevronDown,
  ChevronRight, Pencil, Copy, Wand2, X, RefreshCw, Plus, Lightbulb,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Rule = {
  id: number; projectId: number; title: string; content?: string | null;
  category?: string | null; priority?: number | null; createdAt: string;
};

type AIEnhance = {
  rewrittenContent: string;
  improvedTitle: string;
  designNotes?: string;
  edgeCases?: string;
  relatedRuleSuggestions?: { title: string; content: string; category: string }[];
};

type AIRule = { title: string; content: string; category: string; priority?: number };

const CATEGORIES = ["movement", "combat", "economy", "turn_structure", "variant"] as const;

const CATEGORY_META: Record<string, { label: string; bg: string; text: string; border: string }> = {
  movement:     { label: "Movement",       bg: "bg-blue-500/15",   text: "text-blue-400",   border: "border-blue-500/30" },
  combat:       { label: "Combat",         bg: "bg-red-500/15",    text: "text-red-400",    border: "border-red-500/30" },
  economy:      { label: "Economy",        bg: "bg-amber-500/15",  text: "text-amber-400",  border: "border-amber-500/30" },
  turn_structure:{ label: "Turn Structure", bg: "bg-slate-500/15", text: "text-slate-400",  border: "border-slate-500/30" },
  variant:      { label: "Variant",        bg: "bg-violet-500/15", text: "text-violet-400", border: "border-violet-500/30" },
};
const catMeta = (cat?: string | null) => CATEGORY_META[cat ?? ""] ?? { label: cat ?? "rule", bg: "bg-primary/15", text: "text-primary", border: "border-primary/30" };

// ── Rule Card ────────────────────────────────────────────────────────────────
function RuleCard({ rule, projectId, onUpdated, onDeleted }: {
  rule: Rule;
  projectId: number;
  onUpdated: () => void;
  onDeleted: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: rule.title, content: rule.content ?? "", category: rule.category ?? "movement", priority: rule.priority ?? 1,
  });
  const [showEnhance, setShowEnhance] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhance, setEnhance] = useState<AIEnhance | null>(null);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const { toast } = useToast();
  const BASE = `${window.location.origin}/api`;
  const cm = catMeta(rule.category);

  const saveEdit = async () => {
    const res = await fetch(`${BASE}/projects/${projectId}/rules/${rule.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    if (res.ok) { setIsEditing(false); onUpdated(); }
  };

  const handleEnhance = async () => {
    setIsEnhancing(true);
    setEnhance(null);
    setShowEnhance(true);
    setExpanded(true);
    try {
      const res = await fetch(`${BASE}/projects/${projectId}/rules/${rule.id}/ai-enhance`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      if (res.ok) setEnhance(await res.json());
      else toast({ title: "AI enhance failed", variant: "destructive" });
    } finally {
      setIsEnhancing(false);
    }
  };

  const applyEnhance = async () => {
    if (!enhance) return;
    setApplying(true);
    try {
      await fetch(`${BASE}/projects/${projectId}/rules/${rule.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: enhance.improvedTitle || rule.title, content: enhance.rewrittenContent }),
      });
      setApplied(true);
      setTimeout(() => { setShowEnhance(false); setApplied(false); setEnhance(null); onUpdated(); }, 1200);
    } finally {
      setApplying(false);
    }
  };

  const addSuggestion = async (s: { title: string; content: string; category: string }) => {
    await fetch(`${BASE}/projects/${projectId}/rules`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...s, priority: 1 }),
    });
    onUpdated();
    toast({ title: `Added "${s.title}"` });
  };

  const duplicate = async () => {
    await fetch(`${BASE}/projects/${projectId}/rules`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: `${rule.title} (Copy)`, content: rule.content, category: rule.category, priority: rule.priority ?? 1 }),
    });
    onUpdated();
    toast({ title: "Rule duplicated" });
  };

  return (
    <Card className="bg-card border-border overflow-hidden transition-shadow hover:shadow-md hover:shadow-black/20">
      {/* ── Edit mode ── */}
      {isEditing ? (
        <div className="p-4 space-y-3 border-b border-border bg-muted/10">
          <div className="flex gap-2">
            <Input
              value={editForm.title}
              onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
              className="bg-input h-8 text-sm font-semibold flex-1"
              placeholder="Rule title"
              autoFocus
            />
            <Select value={editForm.category} onValueChange={v => setEditForm(f => ({ ...f, category: v }))}>
              <SelectTrigger className="bg-input h-8 text-xs w-36 shrink-0"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{catMeta(c).label}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1.5 shrink-0">
              <Label className="text-xs text-muted-foreground">Pri.</Label>
              <Input
                type="number" min={1} max={10}
                value={editForm.priority}
                onChange={e => setEditForm(f => ({ ...f, priority: parseInt(e.target.value) || 1 }))}
                className="bg-input h-8 text-xs w-14"
              />
            </div>
          </div>
          <Textarea
            value={editForm.content}
            onChange={e => setEditForm(f => ({ ...f, content: e.target.value }))}
            placeholder="Rule content…"
            className="bg-input text-sm resize-none min-h-[80px]"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={saveEdit} className="h-7 text-xs gap-1 bg-primary text-primary-foreground">
              <Check className="w-3 h-3" />Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setEditForm({ title: rule.title, content: rule.content ?? "", category: rule.category ?? "movement", priority: rule.priority ?? 1 }); setIsEditing(false); }}
              className="h-7 text-xs text-muted-foreground hover:text-white">
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>
      ) : (
        /* ── Normal header ── */
        <div
          className="flex items-start justify-between p-3.5 cursor-pointer hover:bg-muted/5 transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-start gap-2.5 flex-1 min-w-0">
            <div className="mt-0.5 shrink-0">
              {expanded
                ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${cm.bg} ${cm.text} ${cm.border}`}>
                  {catMeta(rule.category).label}
                </span>
                {rule.priority != null && rule.priority > 1 && (
                  <span className="text-[10px] text-muted-foreground">P{rule.priority}</span>
                )}
              </div>
              <p className="text-sm font-semibold text-white leading-snug">{rule.title}</p>
              {!expanded && rule.content && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{rule.content}</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-0.5 ml-2 shrink-0" onClick={e => e.stopPropagation()}>
            <Button variant="ghost" size="sm"
              className={`text-xs h-7 px-2 gap-1 ${showEnhance ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary hover:bg-primary/10"}`}
              onClick={handleEnhance} disabled={isEnhancing}>
              {isEnhancing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              {isEnhancing ? "…" : "AI"}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-white hover:bg-muted/20"
              onClick={() => { setEditForm({ title: rule.title, content: rule.content ?? "", category: rule.category ?? "movement", priority: rule.priority ?? 1 }); setIsEditing(true); setExpanded(false); }}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-white hover:bg-muted/20" onClick={duplicate} title="Duplicate">
              <Copy className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={() => { if (confirm(`Delete "${rule.title}"?`)) onDeleted(rule.id); }}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Expanded content ── */}
      {expanded && !isEditing && (
        <div className="border-t border-border bg-muted/5">
          {/* Rule text */}
          {rule.content && (
            <div className="px-5 py-3">
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{rule.content}</p>
            </div>
          )}

          {/* AI Enhance results */}
          {showEnhance && (
            <div className="border-t border-border px-5 py-4 space-y-4 bg-primary/3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary shrink-0" />
                <p className="text-sm font-semibold text-primary flex-1">AI Enhancement</p>
                {isEnhancing && <span className="text-xs text-muted-foreground">Analyzing rule…</span>}
                <button onClick={() => { setShowEnhance(false); setEnhance(null); }} className="text-muted-foreground hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {isEnhancing && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" /> Enhancing rule…
                </div>
              )}

              {enhance && !isEnhancing && (
                <div className="space-y-3">
                  {/* Rewritten content */}
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Rewritten Rule</p>
                    {enhance.improvedTitle !== rule.title && (
                      <p className="text-xs font-semibold text-white">→ {enhance.improvedTitle}</p>
                    )}
                    <p className="text-sm text-slate-200 leading-relaxed bg-background/50 border border-border rounded-md p-3 whitespace-pre-wrap">
                      {enhance.rewrittenContent}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {enhance.designNotes && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                          <Info className="w-3 h-3" /> Design Notes
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed bg-background/40 border border-border/50 rounded p-2.5">
                          {enhance.designNotes}
                        </p>
                      </div>
                    )}
                    {enhance.edgeCases && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-amber-400/80 uppercase tracking-wider flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Edge Cases
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed bg-amber-500/5 border border-amber-500/20 rounded p-2.5">
                          {enhance.edgeCases}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Related rule suggestions */}
                  {enhance.relatedRuleSuggestions && enhance.relatedRuleSuggestions.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                        <Lightbulb className="w-3 h-3" /> Suggested Related Rules
                      </p>
                      <div className="space-y-1.5">
                        {enhance.relatedRuleSuggestions.map((s, i) => (
                          <div key={i} className="flex items-start gap-2 p-2.5 rounded border border-border bg-muted/10 group/s">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <p className="text-xs font-medium text-white">{s.title}</p>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${catMeta(s.category).bg} ${catMeta(s.category).text} ${catMeta(s.category).border}`}>
                                  {catMeta(s.category).label}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">{s.content}</p>
                            </div>
                            <Button size="sm" variant="ghost" onClick={() => addSuggestion(s)}
                              className="h-6 px-2 text-xs text-primary hover:bg-primary/10 shrink-0 gap-1 opacity-0 group-hover/s:opacity-100 transition-opacity">
                              <Plus className="w-3 h-3" /> Add
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Apply / Regenerate */}
                  <div className="flex items-center gap-2 pt-1">
                    <Button size="sm" onClick={applyEnhance} disabled={applying || applied} className="bg-primary text-primary-foreground gap-1.5">
                      {applied
                        ? <><Check className="w-3.5 h-3.5" />Applied!</>
                        : applying
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Applying…</>
                        : <><Wand2 className="w-3.5 h-3.5" />Apply Rewrite</>}
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleEnhance} disabled={isEnhancing}
                      className="border-border text-muted-foreground hover:text-white gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setShowEnhance(false); setEnhance(null); }}
                      className="text-muted-foreground hover:text-white ml-auto">Dismiss</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ── Main RulesTab ────────────────────────────────────────────────────────────
export default function RulesTab({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient();
  const { data: rules } = useListRules(projectId, { query: { enabled: !!projectId } });
  const createRule = useCreateRule();
  const deleteRule = useDeleteRule();
  const { toast } = useToast();

  const [newRule, setNewRule] = useState({ title: "", content: "", category: "movement", priority: 1 });
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [aiPrompt, setAIPrompt] = useState("");
  const [aiCount, setAICount] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedRules, setGeneratedRules] = useState<AIRule[]>([]);
  const [selectedRules, setSelectedRules] = useState<Set<number>>(new Set());
  const [conflictResult, setConflictResult] = useState<{
    conflicts: { severity: string; title: string; description: string; resolution: string }[];
    summary: string;
  } | null>(null);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [filterCat, setFilterCat] = useState<string>("all");

  const BASE = `${window.location.origin}/api`;

  const handleCheckConflicts = async () => {
    setCheckingConflicts(true);
    setConflictResult(null);
    try {
      const res = await fetch(`${BASE}/projects/${projectId}/rules/check-conflicts`, { method: "POST" });
      if (res.ok) setConflictResult(await res.json());
    } finally { setCheckingConflicts(false); }
  };

  const handleAIGenerate = async () => {
    setIsGenerating(true);
    setGeneratedRules([]);
    try {
      const res = await fetch(`${BASE}/projects/${projectId}/ai-generate-rules`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: aiCount, prompt: aiPrompt }),
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedRules(data);
        setSelectedRules(new Set(data.map((_: unknown, i: number) => i)));
      }
    } finally { setIsGenerating(false); }
  };

  const handleAddSelectedRules = async () => {
    const toAdd = generatedRules.filter((_, i) => selectedRules.has(i));
    for (const rule of toAdd) {
      await new Promise<void>(resolve => {
        createRule.mutate({ projectId, data: { title: rule.title, content: rule.content, category: rule.category, priority: rule.priority ?? 1 } },
          { onSuccess: () => resolve(), onError: () => resolve() });
      });
    }
    queryClient.invalidateQueries({ queryKey: getListRulesQueryKey(projectId) });
    setGeneratedRules([]); setShowAIPanel(false);
    toast({ title: `Added ${toAdd.length} rules` });
  };

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRule.title || !newRule.content) return;
    createRule.mutate({ projectId, data: newRule }, {
      onSuccess: () => {
        setNewRule({ title: "", content: "", category: "movement", priority: 1 });
        setShowAddForm(false);
        queryClient.invalidateQueries({ queryKey: getListRulesQueryKey(projectId) });
      }
    });
  };

  const refresh = () => queryClient.invalidateQueries({ queryKey: getListRulesQueryKey(projectId) });

  const filteredRules = filterCat === "all" ? rules : rules?.filter(r => r.category === filterCat);

  // Group counts by category
  const catCounts = rules?.reduce((acc, r) => {
    const cat = r.category ?? "other";
    acc[cat] = (acc[cat] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>) ?? {};

  return (
    <div className="flex h-full gap-6">
      {/* ── Left: Rules Library ── */}
      <div className="w-1/2 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white">Rules Library</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{rules?.length ?? 0} rules · click AI on any card to enhance</p>
          </div>
          <div className="flex gap-1.5">
            <Button onClick={handleCheckConflicts} disabled={checkingConflicts} variant="outline" size="sm"
              className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 h-8">
              {checkingConflicts ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldAlert className="w-3.5 h-3.5 mr-1" />}
              Conflicts
            </Button>
            <Button onClick={() => { setShowAIPanel(!showAIPanel); setShowAddForm(false); }} variant="outline" size="sm"
              className="border-primary/30 text-primary hover:bg-primary/10 h-8">
              <Sparkles className="w-3.5 h-3.5 mr-1" /> AI Generate
            </Button>
            <Button onClick={() => { setShowAddForm(!showAddForm); setShowAIPanel(false); }} size="sm"
              className="bg-primary text-primary-foreground h-8">
              <Plus className="w-3.5 h-3.5 mr-1" /> Add
            </Button>
          </div>
        </div>

        {/* Category filter pills */}
        {rules && rules.length > 0 && (
          <div className="flex gap-1.5 mb-3 flex-wrap shrink-0">
            <button onClick={() => setFilterCat("all")}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${filterCat === "all" ? "bg-white/10 text-white border-white/20" : "text-muted-foreground border-border hover:text-white"}`}>
              All ({rules.length})
            </button>
            {Object.entries(catCounts).map(([cat, count]) => {
              const m = catMeta(cat);
              return (
                <button key={cat} onClick={() => setFilterCat(cat)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${filterCat === cat ? `${m.bg} ${m.text} ${m.border}` : "text-muted-foreground border-border hover:text-white"}`}>
                  {m.label} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* Conflict result */}
        {conflictResult && (
          <Card className="p-4 bg-card border-amber-500/20 border mb-3 shrink-0 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-amber-400 flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5" /> Conflict Analysis</p>
              <button onClick={() => setConflictResult(null)} className="text-muted-foreground hover:text-white"><X className="w-3.5 h-3.5" /></button>
            </div>
            <p className="text-xs text-muted-foreground italic">{conflictResult.summary}</p>
            {conflictResult.conflicts.length === 0 ? (
              <div className="flex items-center gap-1.5 text-emerald-400 text-xs"><CheckCircle className="w-3.5 h-3.5" /> No conflicts detected</div>
            ) : conflictResult.conflicts.map((c, i) => (
              <div key={i} className={`border rounded-lg p-2.5 text-xs space-y-1 ${c.severity === "critical" ? "border-red-500/30 bg-red-500/5" : c.severity === "warning" ? "border-amber-500/30 bg-amber-500/5" : "border-blue-500/30 bg-blue-500/5"}`}>
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${c.severity === "critical" ? "text-red-400" : c.severity === "warning" ? "text-amber-400" : "text-blue-400"}`} />
                  <span className="font-semibold text-white">{c.title}</span>
                  <Badge variant="outline" className="ml-auto text-[9px] capitalize">{c.severity}</Badge>
                </div>
                <p className="text-muted-foreground pl-5">{c.description}</p>
                <div className="flex items-start gap-1 text-muted-foreground/70 pl-5">
                  <Info className="w-3 h-3 mt-0.5 shrink-0" /><span>Fix: {c.resolution}</span>
                </div>
              </div>
            ))}
          </Card>
        )}

        {/* AI Generate panel */}
        {showAIPanel && (
          <Card className="p-4 bg-card border-primary/30 border mb-3 shrink-0 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-primary flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> AI Rule Generator</p>
              <button onClick={() => setShowAIPanel(false)} className="text-muted-foreground hover:text-white"><X className="w-3.5 h-3.5" /></button>
            </div>
            <div className="flex gap-2">
              <Textarea value={aiPrompt} onChange={e => setAIPrompt(e.target.value)}
                placeholder="Focus on specific mechanics (e.g. combat, resource management)…"
                className="bg-input h-14 resize-none text-xs flex-1" />
              <div className="w-16 shrink-0 space-y-1">
                <Label className="text-xs">Count</Label>
                <Select value={aiCount.toString()} onValueChange={v => setAICount(parseInt(v))}>
                  <SelectTrigger className="h-8 bg-input text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{[3,5,8].map(n => <SelectItem key={n} value={n.toString()}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleAIGenerate} disabled={isGenerating} size="sm" className="w-full bg-primary text-primary-foreground">
              {isGenerating ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Generating…</> : <><Sparkles className="w-3.5 h-3.5 mr-1.5" />Generate</>}
            </Button>
            {generatedRules.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Select rules to add:</span>
                  <div className="flex gap-2">
                    <button className="text-primary hover:underline" onClick={() => setSelectedRules(new Set(generatedRules.map((_, i) => i)))}>All</button>
                    <button className="text-muted-foreground hover:underline" onClick={() => setSelectedRules(new Set())}>None</button>
                  </div>
                </div>
                <div className="space-y-1.5 max-h-52 overflow-y-auto">
                  {generatedRules.map((rule, i) => (
                    <div key={i}
                      className={`flex items-start gap-2 p-2.5 rounded border cursor-pointer text-xs transition-colors ${selectedRules.has(i) ? "border-primary/40 bg-primary/5" : "border-border bg-muted/10"}`}
                      onClick={() => setSelectedRules(prev => { const next = new Set(prev); if (next.has(i)) next.delete(i); else next.add(i); return next; })}>
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 ${selectedRules.has(i) ? "border-primary bg-primary" : "border-border"}`}>
                        {selectedRules.has(i) && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                      </div>
                      <div>
                        <span className="font-medium text-white">{rule.title}</span>
                        <Badge variant="outline" className={`ml-2 text-[10px] ${catMeta(rule.category).bg} ${catMeta(rule.category).text} ${catMeta(rule.category).border}`}>{rule.category}</Badge>
                        <p className="text-muted-foreground mt-0.5 line-clamp-2">{rule.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <Button onClick={handleAddSelectedRules} disabled={selectedRules.size === 0} size="sm" className="w-full bg-primary text-primary-foreground">
                  Add {selectedRules.size} Rule{selectedRules.size !== 1 ? "s" : ""}
                </Button>
              </div>
            )}
          </Card>
        )}

        {/* Add Rule form */}
        {showAddForm && (
          <Card className="p-4 bg-card border-border mb-3 shrink-0">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-white flex items-center gap-1.5"><Plus className="w-3.5 h-3.5 text-primary" /> New Rule</p>
              <button onClick={() => setShowAddForm(false)} className="text-muted-foreground hover:text-white"><X className="w-3.5 h-3.5" /></button>
            </div>
            <form onSubmit={handleAddRule} className="space-y-3">
              <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Title *</Label>
                  <Input value={newRule.title} onChange={e => setNewRule({...newRule, title: e.target.value})} className="h-8 bg-input" placeholder="Rule title" autoFocus />
                </div>
                <div className="w-32 space-y-1 shrink-0">
                  <Label className="text-xs">Category</Label>
                  <Select value={newRule.category} onValueChange={v => setNewRule({...newRule, category: v})}>
                    <SelectTrigger className="h-8 bg-input text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c} value={c}>{catMeta(c).label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-14 space-y-1 shrink-0">
                  <Label className="text-xs">Pri.</Label>
                  <Input type="number" min={1} max={10} value={newRule.priority}
                    onChange={e => setNewRule({...newRule, priority: parseInt(e.target.value) || 1})}
                    className="h-8 bg-input text-xs" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Content *</Label>
                <Textarea value={newRule.content} onChange={e => setNewRule({...newRule, content: e.target.value})}
                  className="h-20 resize-none bg-input" placeholder="Rule description…" />
              </div>
              <Button type="submit" size="sm" className="w-full" disabled={createRule.isPending}>
                {createRule.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
                Add Rule
              </Button>
            </form>
          </Card>
        )}

        {/* Rules list */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {filteredRules?.map(rule => (
            <RuleCard
              key={rule.id}
              rule={rule as Rule}
              projectId={projectId}
              onUpdated={refresh}
              onDeleted={id => {
                deleteRule.mutate({ projectId, id }, { onSuccess: () => refresh() });
              }}
            />
          ))}
          {filteredRules?.length === 0 && (
            <div className="text-center py-10 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
              {filterCat === "all" ? "No rules yet — use AI Generate or Add." : `No ${catMeta(filterCat).label} rules yet.`}
            </div>
          )}
        </div>
      </div>

      <div className="w-px bg-border my-2 shrink-0" />

      {/* ── Right: Sandbox chat ── */}
      <div className="w-1/2 flex flex-col h-full overflow-hidden">
        <SandboxChat projectId={projectId} />
      </div>
    </div>
  );
}

// ── Sandbox Chat (unchanged) ─────────────────────────────────────────────────
function SandboxChat({ projectId }: { projectId: number }) {
  const { data: history, refetch } = useGetRulesSandboxHistory(projectId, { query: { enabled: !!projectId } });
  const clearHistory = useClearRulesSandboxHistory();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Array<{role: string, content: string, id: number}>>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (history) {
      setMessages(history);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [history]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    const userMsg = input;
    setInput("");
    const newMessages = [...messages, { role: "user", content: userMsg, id: Date.now() }];
    setMessages(newMessages);
    setIsStreaming(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/rules-sandbox`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg }),
      });
      if (!response.body) throw new Error("No body");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMsg = "";
      setMessages([...newMessages, { role: "assistant", content: "", id: Date.now() + 1 }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split("\n").filter(Boolean)) {
          if (!line.startsWith("data: ")) continue;
          const dataStr = line.replace("data: ", "");
          if (dataStr === "[DONE]") continue;
          try {
            const data = JSON.parse(dataStr);
            if (data.content) {
              assistantMsg += data.content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                return [...prev.slice(0, -1), { ...last, content: assistantMsg }];
              });
              messagesEndRef.current?.scrollIntoView();
            }
          } catch { /* ignore */ }
        }
      }
      refetch();
    } catch (e) {
      console.error(e);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleClear = () => {
    if (confirm("Clear sandbox history?")) {
      clearHistory.mutate({ projectId }, { onSuccess: () => { setMessages([]); refetch(); } });
    }
  };

  return (
    <div className="flex flex-col h-full border border-border bg-card rounded-xl overflow-hidden">
      <div className="p-3 border-b border-border bg-muted/20 flex justify-between items-center">
        <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
          <Bot className="w-4 h-4 text-primary" /> AI Rules Sandbox
        </h3>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={handleClear} title="Clear Chat">
          <Trash className="w-3 h-3" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-2 opacity-50">
            <Bot className="w-12 h-12 text-primary" />
            <p className="text-sm">Ask the AI to test interactions, identify loopholes,<br/>or brainstorm new mechanics.</p>
          </div>
        ) : messages.map((msg, i) => (
          <div key={msg.id || i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
              {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            <div className={`max-w-[80%] rounded-lg p-3 text-sm ${msg.role === "user" ? "bg-primary/10 text-white whitespace-pre-wrap" : "bg-muted/30"}`}>
              {msg.role === "assistant"
                ? (msg.content
                    ? <div
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                        className="[&_strong]:text-white [&_strong]:font-semibold [&_em]:text-slate-300 text-slate-200"
                      />
                    : <span className="animate-pulse text-muted-foreground">…</span>)
                : msg.content
              }
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-3 border-t border-border bg-muted/10">
        <form onSubmit={handleSend} className="flex gap-2">
          <Input value={input} onChange={e => setInput(e.target.value)} placeholder="Test a scenario…"
            className="flex-1 bg-input" disabled={isStreaming} />
          <Button type="submit" disabled={isStreaming || !input.trim()} className="shrink-0 px-3">
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
