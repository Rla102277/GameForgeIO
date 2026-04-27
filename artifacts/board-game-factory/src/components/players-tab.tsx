import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Sparkles, Plus, Trash2, Users, Trophy, Zap, Target, Loader2,
  ChevronDown, ChevronRight, Pencil, Check, X, Wand2, Copy,
  RefreshCw, CornerDownRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Player = {
  id: number;
  name: string;
  archetype?: string | null;
  description?: string | null;
  victoryCondition?: string | null;
  specialAbility?: string | null;
  playstyle?: string | null;
  startingResources?: Record<string, number | string> | null;
  createdAt: string;
};

type AIEnhance = {
  description: string;
  victoryCondition: string;
  specialAbility: string;
  designNotes?: string;
  startingResources?: Record<string, number | string>;
};

const PLAYSTYLES = ["Aggressive", "Economic", "Defensive", "Diplomatic", "Hybrid"];

const PLAYSTYLE_META: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  Aggressive: { bg: "bg-red-500/10",    text: "text-red-400",    border: "border-red-500/30",    icon: "⚔️" },
  Economic:   { bg: "bg-amber-500/10",  text: "text-amber-400",  border: "border-amber-500/30",  icon: "💰" },
  Defensive:  { bg: "bg-blue-500/10",   text: "text-blue-400",   border: "border-blue-500/30",   icon: "🛡️" },
  Diplomatic: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/30", icon: "🤝" },
  Hybrid:     { bg: "bg-emerald-500/10",text: "text-emerald-400",border: "border-emerald-500/30",icon: "⚡" },
};

const ARCHETYPES = [
  "Aggressor",
  "Builder",
  "Collector",
  "Controller",
  "Defender",
  "Diplomat",
  "Explorer",
  "Hoarder",
  "Opportunist",
  "Saboteur",
  "Speedrunner",
  "Tactician",
  "Trader",
  "Underdog",
] as const;

const ARCHETYPE_DESCRIPTIONS: Record<string, string> = {
  Aggressor:   "Wins through direct conflict and elimination",
  Builder:     "Creates infrastructure and economic engines",
  Collector:   "Accumulates sets or specific resources",
  Controller:  "Manipulates board state and other players",
  Defender:    "Focuses on fortification and attrition",
  Diplomat:    "Uses alliances and negotiation to advance",
  Explorer:    "Gains advantage through map or area control",
  Hoarder:     "Stockpiles resources and plays the long game",
  Opportunist: "Reacts to others' moves for maximum gain",
  Saboteur:    "Disrupts opponents' plans to slow them down",
  Speedrunner: "Races to meet win conditions before others",
  Tactician:   "Plans several moves ahead with precision",
  Trader:      "Excels at resource conversion and economy",
  Underdog:    "Thrives with catch-up mechanics and upsets",
};

const EMPTY_FORM = { name: "", archetype: "", description: "", victoryCondition: "", specialAbility: "", playstyle: "Hybrid" };

function ResourceEditor({ resources, onChange }: {
  resources: Record<string, number | string>;
  onChange: (r: Record<string, number | string>) => void;
}) {
  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState("");
  const entries = Object.entries(resources);

  return (
    <div className="space-y-2">
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-center gap-2">
          <Input value={k} onChange={e => {
            const updated = { ...resources };
            delete updated[k];
            updated[e.target.value] = v;
            onChange(updated);
          }} className="bg-input h-7 text-xs font-mono flex-1" />
          <Input value={String(v)} onChange={e => onChange({ ...resources, [k]: e.target.value })}
            className="bg-input h-7 text-xs font-mono w-24" />
          <button onClick={() => { const r = { ...resources }; delete r[k]; onChange(r); }}
            className="text-muted-foreground hover:text-red-400 transition-colors p-1">
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <Input value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="resource name"
          className="bg-input h-7 text-xs font-mono flex-1" />
        <Input value={newVal} onChange={e => setNewVal(e.target.value)} placeholder="value"
          className="bg-input h-7 text-xs font-mono w-24" />
        <button
          onClick={() => { if (!newKey.trim()) return; onChange({ ...resources, [newKey]: newVal }); setNewKey(""); setNewVal(""); }}
          className="text-primary hover:text-primary/80 transition-colors p-1">
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function PlayerForm({ initial, onSubmit, onCancel, submitLabel }: {
  initial: typeof EMPTY_FORM;
  onSubmit: (data: typeof EMPTY_FORM) => void;
  onCancel: () => void;
  submitLabel: string;
}) {
  const [form, setForm] = useState(initial);
  // Determine if the initial archetype is a known preset or custom
  const isPreset = (v: string) => ARCHETYPES.includes(v as typeof ARCHETYPES[number]);
  const [archetypeMode, setArchetypeMode] = useState<"preset" | "custom">(
    initial.archetype === "" || isPreset(initial.archetype) ? "preset" : "custom"
  );

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const selectedDesc = isPreset(form.archetype) ? ARCHETYPE_DESCRIPTIONS[form.archetype] : null;

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(form); }} className="space-y-4 pt-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Name *</Label>
          <Input value={form.name} onChange={set("name")} placeholder="e.g. The Conqueror" className="bg-input" autoFocus required />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Archetype</Label>
            <button
              type="button"
              onClick={() => {
                if (archetypeMode === "preset") {
                  setArchetypeMode("custom");
                  if (isPreset(form.archetype)) setForm(f => ({ ...f, archetype: "" }));
                } else {
                  setArchetypeMode("preset");
                  setForm(f => ({ ...f, archetype: "" }));
                }
              }}
              className="text-[10px] text-muted-foreground hover:text-primary transition-colors"
            >
              {archetypeMode === "preset" ? "Custom…" : "← Presets"}
            </button>
          </div>
          {archetypeMode === "preset" ? (
            <Select
              value={form.archetype}
              onValueChange={v => setForm(f => ({ ...f, archetype: v }))}
            >
              <SelectTrigger className="bg-input"><SelectValue placeholder="Select archetype…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">— None —</SelectItem>
                {ARCHETYPES.map(a => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={form.archetype}
              onChange={set("archetype")}
              placeholder="e.g. The Opportunist"
              className="bg-input"
            />
          )}
          {selectedDesc && (
            <p className="text-[10px] text-muted-foreground italic">{selectedDesc}</p>
          )}
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Playstyle</Label>
        <Select value={form.playstyle} onValueChange={v => setForm(f => ({ ...f, playstyle: v }))}>
          <SelectTrigger className="bg-input"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PLAYSTYLES.map(s => (
              <SelectItem key={s} value={s}>{PLAYSTYLE_META[s].icon} {s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Description</Label>
        <Textarea value={form.description} onChange={set("description")} className="bg-input h-18 resize-none"
          placeholder="How this player type approaches the game…" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Victory Condition</Label>
        <Input value={form.victoryCondition} onChange={set("victoryCondition")} placeholder="How they win" className="bg-input" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Special Ability</Label>
        <Input value={form.specialAbility} onChange={set("specialAbility")} placeholder="Unique ability or starting bonus" className="bg-input" />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="text-muted-foreground hover:text-white">Cancel</Button>
        <Button type="submit" size="sm">{submitLabel}</Button>
      </div>
    </form>
  );
}

function PlayerCard({ player, projectId, onUpdate, onDelete }: {
  player: Player;
  projectId: number;
  onUpdate: () => void;
  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [showEnhance, setShowEnhance] = useState(false);
  const [enhance, setEnhance] = useState<AIEnhance | null>(null);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [editResources, setEditResources] = useState(false);
  const [resources, setResources] = useState<Record<string, number | string>>(player.startingResources ?? {});
  const { toast } = useToast();
  const BASE = `${window.location.origin}/api`;
  const normalizedPlaystyle = PLAYSTYLES.find(s => s.toLowerCase() === (player.playstyle ?? "").toLowerCase()) ?? "Hybrid";
  const ps = PLAYSTYLE_META[normalizedPlaystyle] ?? PLAYSTYLE_META.Hybrid;

  const handleEdit = async (data: typeof EMPTY_FORM) => {
    const res = await fetch(`${BASE}/projects/${projectId}/players/${player.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) { setEditOpen(false); onUpdate(); }
  };

  const handleEnhance = async () => {
    setIsEnhancing(true);
    setEnhance(null);
    try {
      const res = await fetch(`${BASE}/projects/${projectId}/players/${player.id}/ai-enhance`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      if (res.ok) {
        const data: AIEnhance = await res.json();
        setEnhance(data);
        setShowEnhance(true);
        setExpanded(true);
      } else {
        const body = await res.json().catch(() => ({}));
        toast({ title: "AI enhance failed", description: body?.error ?? "Please try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "AI enhance failed", description: "Could not reach the server.", variant: "destructive" });
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleApplyEnhance = async () => {
    if (!enhance) return;
    setApplying(true);
    try {
      await fetch(`${BASE}/projects/${projectId}/players/${player.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: enhance.description,
          victoryCondition: enhance.victoryCondition,
          specialAbility: enhance.specialAbility,
          startingResources: enhance.startingResources ?? player.startingResources,
        }),
      });
      setApplied(true);
      setTimeout(() => { setShowEnhance(false); setApplied(false); setEnhance(null); onUpdate(); }, 1200);
    } finally {
      setApplying(false);
    }
  };

  const handleSaveResources = async () => {
    await fetch(`${BASE}/projects/${projectId}/players/${player.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startingResources: resources }),
    });
    setEditResources(false);
    onUpdate();
  };

  const handleDuplicate = async () => {
    const res = await fetch(`${BASE}/projects/${projectId}/players`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${player.name} (Copy)`,
        archetype: player.archetype,
        description: player.description,
        victoryCondition: player.victoryCondition,
        specialAbility: player.specialAbility,
        playstyle: player.playstyle,
        startingResources: player.startingResources,
      }),
    });
    if (res.ok) { onUpdate(); toast({ title: "Player duplicated" }); }
  };

  return (
    <Card className="bg-card border-border overflow-hidden transition-shadow hover:shadow-md hover:shadow-black/20">
      {/* Header */}
      <div className="flex items-start justify-between px-5 py-4 cursor-pointer hover:bg-muted/5 transition-colors" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <div className={`w-11 h-11 rounded-xl ${ps.bg} border ${ps.border} flex items-center justify-center text-xl shrink-0`}>
            {ps.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-white">{player.name}</h3>
              {player.archetype && <Badge variant="outline" className="text-[10px] border-border">{player.archetype}</Badge>}
              {normalizedPlaystyle && (
                <Badge variant="outline" className={`text-[10px] ${ps.bg} ${ps.text} ${ps.border}`}>
                  {normalizedPlaystyle}
                </Badge>
              )}
            </div>
            {player.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{player.description}</p>}
            {!player.description && <p className="text-xs text-muted-foreground/50 mt-1 italic">No description — click AI Enhance to generate</p>}
          </div>
        </div>
        <div className="flex items-center gap-1 ml-4 shrink-0" onClick={e => e.stopPropagation()}>
          {/* AI Enhance */}
          <Button variant="ghost" size="sm"
            className={`text-xs h-7 px-2 gap-1.5 ${showEnhance ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary hover:bg-primary/10"}`}
            onClick={handleEnhance} disabled={isEnhancing}>
            {isEnhancing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
            {isEnhancing ? "Enhancing…" : "AI Enhance"}
          </Button>
          {/* Edit */}
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-white hover:bg-muted/20">
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border sm:max-w-lg">
              <DialogHeader><DialogTitle>Edit {player.name}</DialogTitle></DialogHeader>
              <PlayerForm
                initial={{ name: player.name, archetype: player.archetype ?? "", description: player.description ?? "",
                  victoryCondition: player.victoryCondition ?? "", specialAbility: player.specialAbility ?? "",
                  playstyle: player.playstyle ?? "Hybrid" }}
                onSubmit={handleEdit}
                onCancel={() => setEditOpen(false)}
                submitLabel="Save changes"
              />
            </DialogContent>
          </Dialog>
          {/* Duplicate */}
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-white hover:bg-muted/20" onClick={handleDuplicate} title="Duplicate">
            <Copy className="w-3.5 h-3.5" />
          </Button>
          {/* Delete */}
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={() => { if (confirm(`Delete "${player.name}"?`)) onDelete(player.id); }}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
          {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground ml-1" /> : <ChevronRight className="w-4 h-4 text-muted-foreground ml-1" />}
        </div>
      </div>

      {/* AI Enhance Panel */}
      {showEnhance && enhance && (
        <div className={`border-t border-border ${ps.bg} px-5 py-4 space-y-4`}>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold text-primary">AI Enhancement Preview</p>
            <button onClick={() => { setShowEnhance(false); setEnhance(null); }} className="ml-auto text-muted-foreground hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Description</p>
              <p className="text-xs text-slate-200 leading-relaxed bg-background/40 border border-border/50 rounded p-2.5">{enhance.description}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Victory Condition</p>
              <p className="text-xs text-slate-200 leading-relaxed bg-background/40 border border-border/50 rounded p-2.5">{enhance.victoryCondition}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Special Ability</p>
              <p className="text-xs text-slate-200 leading-relaxed bg-background/40 border border-border/50 rounded p-2.5">{enhance.specialAbility}</p>
            </div>
            {enhance.designNotes && (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Design Notes</p>
                <p className="text-xs text-muted-foreground italic leading-relaxed bg-background/40 border border-border/50 rounded p-2.5">{enhance.designNotes}</p>
              </div>
            )}
          </div>

          {enhance.startingResources && Object.keys(enhance.startingResources).length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Suggested Starting Resources</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(enhance.startingResources).map(([k, v]) => (
                  <div key={k} className="px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20 text-xs">
                    <span className="text-muted-foreground">{k}:</span>
                    <span className="text-blue-400 font-mono ml-1">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" onClick={handleApplyEnhance} disabled={applying || applied} className="bg-primary text-primary-foreground">
              {applied
                ? <><Check className="w-3.5 h-3.5 mr-1.5" />Applied!</>
                : applying
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Applying…</>
                : <><Wand2 className="w-3.5 h-3.5 mr-1.5" />Apply Enhancement</>}
            </Button>
            <Button size="sm" variant="outline" onClick={handleEnhance} disabled={isEnhancing}
              className="border-border text-muted-foreground hover:text-white gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Regenerate
            </Button>
          </div>
        </div>
      )}

      {/* Expanded Detail Panel */}
      {expanded && (
        <div className="border-t border-border bg-muted/5 px-5 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Victory Condition */}
            <div className="flex gap-3">
              <Trophy className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Victory Condition</p>
                <p className="text-sm text-white">{player.victoryCondition || <span className="text-muted-foreground italic text-xs">Not defined</span>}</p>
              </div>
            </div>
            {/* Special Ability */}
            <div className="flex gap-3">
              <Zap className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Special Ability</p>
                <p className="text-sm text-white">{player.specialAbility || <span className="text-muted-foreground italic text-xs">Not defined</span>}</p>
              </div>
            </div>

            {/* Starting Resources */}
            <div className="flex gap-3 md:col-span-2">
              <Target className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Starting Resources</p>
                  <button onClick={() => { setEditResources(!editResources); setResources(player.startingResources ?? {}); }}
                    className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center gap-0.5">
                    <Pencil className="w-2.5 h-2.5" /> {editResources ? "Cancel" : "Edit"}
                  </button>
                </div>

                {editResources ? (
                  <div className="space-y-2">
                    <ResourceEditor resources={resources} onChange={setResources} />
                    <Button size="sm" onClick={handleSaveResources}
                      className="h-7 text-xs bg-white/10 hover:bg-white/20 text-white border-0 gap-1">
                      <Check className="w-3 h-3" /> Save resources
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {player.startingResources && Object.keys(player.startingResources).length > 0
                      ? Object.entries(player.startingResources).map(([k, v]) => (
                          <div key={k} className="px-3 py-1 rounded-md bg-blue-500/10 border border-blue-500/20 text-sm">
                            <span className="text-muted-foreground">{k}:</span>
                            <span className="text-blue-400 font-mono ml-1">{v}</span>
                          </div>
                        ))
                      : <button onClick={() => setEditResources(true)}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-white transition-colors">
                          <Plus className="w-3 h-3" /> Add starting resources
                        </button>
                    }
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function PlayersTab({ projectId }: { projectId: number }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateCount, setGenerateCount] = useState(3);
  const [addOpen, setAddOpen] = useState(false);
  const { toast } = useToast();
  const BASE = `${window.location.origin}/api`;

  const loadPlayers = async () => {
    try {
      const res = await fetch(`${BASE}/projects/${projectId}/players`);
      if (res.ok) setPlayers(await res.json());
    } catch (e) {
      console.error("Failed to load players:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPlayers(); }, [projectId]);

  const handleAIGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch(`${BASE}/projects/${projectId}/players/ai-generate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: generateCount }),
      });
      if (!res.ok) { toast({ title: "Generation failed", variant: "destructive" }); return; }
      const generated = await res.json();
      for (const p of generated) {
        await fetch(`${BASE}/projects/${projectId}/players`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(p),
        });
      }
      toast({ title: `Generated ${generated.length} player archetypes` });
      loadPlayers();
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAdd = async (data: typeof EMPTY_FORM) => {
    const res = await fetch(`${BASE}/projects/${projectId}/players`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) { setAddOpen(false); loadPlayers(); }
  };

  const handleDelete = async (id: number) => {
    await fetch(`${BASE}/projects/${projectId}/players/${id}`, { method: "DELETE" });
    setPlayers(p => p.filter(x => x.id !== id));
  };

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-20">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-white">Player Generator</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Define player archetypes with unique abilities, strategies, and victory paths.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* AI Generate with count */}
          <div className="flex items-center gap-1.5 bg-muted/20 border border-border rounded-lg px-3 h-9">
            <Label className="text-xs text-muted-foreground shrink-0">Generate</Label>
            <Select value={generateCount.toString()} onValueChange={v => setGenerateCount(parseInt(v))}>
              <SelectTrigger className="w-10 h-auto bg-transparent border-0 p-0 text-xs focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>{[1,2,3,4,5].map(n => <SelectItem key={n} value={n.toString()}>{n}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={handleAIGenerate} disabled={isGenerating} variant="outline" className="border-primary/30 text-primary hover:bg-primary/10 h-9">
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
            {isGenerating ? "Generating…" : "AI Generate"}
          </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground h-9">
                <Plus className="w-4 h-4 mr-2" />Add Player
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border sm:max-w-lg">
              <DialogHeader><DialogTitle>New Player Archetype</DialogTitle></DialogHeader>
              <PlayerForm initial={EMPTY_FORM} onSubmit={handleAdd} onCancel={() => setAddOpen(false)} submitLabel="Add Player Archetype" />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats bar */}
      {players.length > 0 && (
        <div className="flex items-center gap-6 text-sm">
          <span className="text-muted-foreground">{players.length} archetypes</span>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(
              players.reduce((acc, p) => { const ps = p.playstyle ?? "Hybrid"; acc[ps] = (acc[ps] ?? 0) + 1; return acc; }, {} as Record<string, number>)
            ).map(([ps, count]) => {
              const m = PLAYSTYLE_META[ps] ?? PLAYSTYLE_META.Hybrid;
              return (
                <span key={ps} className={`text-xs px-2 py-0.5 rounded-full ${m.bg} ${m.text} ${m.border} border`}>
                  {m.icon} {ps} ×{count}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {players.length === 0 && (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <Users className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <h3 className="text-white font-medium mb-1">No player archetypes yet</h3>
          <p className="text-muted-foreground text-sm mb-4">
            AI Generate will create a balanced set based on your game's entities and rules.
          </p>
          <Button onClick={handleAIGenerate} disabled={isGenerating} className="bg-primary text-primary-foreground">
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
            AI Generate {generateCount} Players
          </Button>
        </div>
      )}

      {/* Player cards */}
      <div className="flex flex-col gap-3">
        {players.map(player => (
          <PlayerCard
            key={player.id}
            player={player}
            projectId={projectId}
            onUpdate={loadPlayers}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
}
