import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sparkles, Plus, Trash2, Users, Trophy, Zap, Target, Loader2, ChevronDown, ChevronRight } from "lucide-react";

type Player = {
  id: number;
  name: string;
  archetype?: string;
  description?: string;
  victoryCondition?: string;
  specialAbility?: string;
  playstyle?: string;
  startingResources?: Record<string, number | string>;
  createdAt: string;
};

const playstyleColors: Record<string, string> = {
  Aggressive: "bg-red-500/20 text-red-400 border-red-500/30",
  Economic: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  Defensive: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Diplomatic: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  Hybrid: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

export default function PlayersTab({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient();
  const [players, setPlayers] = useState<Player[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateCount, setGenerateCount] = useState(3);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [newPlayer, setNewPlayer] = useState({
    name: "", archetype: "", description: "", victoryCondition: "", specialAbility: "", playstyle: "Hybrid",
  });

  const BASE = `${window.location.origin}/api`;

  const loadPlayers = async () => {
    const res = await fetch(`${BASE}/projects/${projectId}/players`);
    if (res.ok) setPlayers(await res.json());
  };

  useState(() => { loadPlayers(); });

  const handleAIGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch(`${BASE}/projects/${projectId}/players/ai-generate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: generateCount }),
      });
      if (!res.ok) return;
      const generated = await res.json();
      // Save each generated player to DB
      for (const p of generated) {
        await fetch(`${BASE}/projects/${projectId}/players`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(p),
        });
      }
      loadPlayers();
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayer.name) return;
    const res = await fetch(`${BASE}/projects/${projectId}/players`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newPlayer),
    });
    if (res.ok) {
      setAddOpen(false);
      setNewPlayer({ name: "", archetype: "", description: "", victoryCondition: "", specialAbility: "", playstyle: "Hybrid" });
      loadPlayers();
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this player archetype?")) return;
    await fetch(`${BASE}/projects/${projectId}/players/${id}`, { method: "DELETE" });
    loadPlayers();
  };

  const toggleExpand = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Player Generator</h2>
          <p className="text-muted-foreground text-sm mt-1">Define player archetypes, starting conditions, and victory paths.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Generate</Label>
            <Select value={generateCount.toString()} onValueChange={v => setGenerateCount(parseInt(v))}>
              <SelectTrigger className="w-16 h-8 bg-input text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{[1,2,3,4,5].map(n => <SelectItem key={n} value={n.toString()}>{n}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={handleAIGenerate} disabled={isGenerating} variant="outline" className="border-primary/30 text-primary hover:bg-primary/10">
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
            AI Generate
          </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground">
                <Plus className="w-4 h-4 mr-2" />Add Player
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>New Player Archetype</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Name</Label>
                    <Input value={newPlayer.name} onChange={e => setNewPlayer({...newPlayer, name: e.target.value})} placeholder="e.g. The Conqueror" className="bg-input" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Archetype Label</Label>
                    <Input value={newPlayer.archetype} onChange={e => setNewPlayer({...newPlayer, archetype: e.target.value})} placeholder="e.g. Aggressor" className="bg-input" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Description</Label>
                  <Textarea value={newPlayer.description} onChange={e => setNewPlayer({...newPlayer, description: e.target.value})} className="bg-input h-16 resize-none" placeholder="How this player type approaches the game" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Victory Condition</Label>
                  <Input value={newPlayer.victoryCondition} onChange={e => setNewPlayer({...newPlayer, victoryCondition: e.target.value})} placeholder="How they win" className="bg-input" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Special Ability</Label>
                  <Input value={newPlayer.specialAbility} onChange={e => setNewPlayer({...newPlayer, specialAbility: e.target.value})} placeholder="Unique ability or starting bonus" className="bg-input" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Playstyle</Label>
                  <Select value={newPlayer.playstyle} onValueChange={v => setNewPlayer({...newPlayer, playstyle: v})}>
                    <SelectTrigger className="bg-input"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Aggressive","Economic","Defensive","Diplomatic","Hybrid"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full">Add Player Archetype</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {players.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <Users className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <h3 className="text-white font-medium mb-1">No player archetypes yet</h3>
          <p className="text-muted-foreground text-sm mb-4">Use AI Generate or add manually.</p>
          <Button onClick={handleAIGenerate} disabled={isGenerating} className="bg-primary text-primary-foreground">
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
            AI Generate Players
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {players.map(player => (
            <Card key={player.id} className="bg-card border-border overflow-hidden">
              <div
                className="flex items-start justify-between p-5 cursor-pointer hover:bg-muted/5"
                onClick={() => toggleExpand(player.id)}
              >
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-bold text-white">{player.name}</h3>
                      {player.archetype && <Badge variant="outline" className="text-xs">{player.archetype}</Badge>}
                      {player.playstyle && (
                        <Badge variant="outline" className={`text-xs ${playstyleColors[player.playstyle] || "bg-gray-500/20 text-gray-400"}`}>
                          {player.playstyle}
                        </Badge>
                      )}
                    </div>
                    {player.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{player.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={e => { e.stopPropagation(); handleDelete(player.id); }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                  {expanded.has(player.id) ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                </div>
              </div>

              {expanded.has(player.id) && (
                <div className="border-t border-border bg-muted/5 p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {player.victoryCondition && (
                    <div className="flex gap-3">
                      <Trophy className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Victory Condition</p>
                        <p className="text-sm text-white">{player.victoryCondition}</p>
                      </div>
                    </div>
                  )}
                  {player.specialAbility && (
                    <div className="flex gap-3">
                      <Zap className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Special Ability</p>
                        <p className="text-sm text-white">{player.specialAbility}</p>
                      </div>
                    </div>
                  )}
                  {player.startingResources && Object.keys(player.startingResources).length > 0 && (
                    <div className="flex gap-3 md:col-span-2">
                      <Target className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Starting Resources</p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(player.startingResources).map(([k, v]) => (
                            <div key={k} className="px-3 py-1 rounded-md bg-blue-500/10 border border-blue-500/20 text-sm">
                              <span className="text-muted-foreground">{k}:</span>
                              <span className="text-blue-400 font-mono ml-1">{v}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
