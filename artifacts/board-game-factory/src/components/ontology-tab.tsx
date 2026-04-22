import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListEntities, useCreateEntity, useDeleteEntity,
  useListProperties, useCreateProperty, useDeleteProperty,
  getListEntitiesQueryKey, getListPropertiesQueryKey,
} from "@workspace/api-client-react";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Plus, Trash2, ChevronDown, ChevronRight, Settings,
  Sparkles, Loader2, Check, BookOpen, Wand2, X,
  Info, Lightbulb, Layers,
} from "lucide-react";

type AIEntity = {
  name: string; type: string; description: string;
  properties?: { name: string; dataType: string; defaultValue?: string }[];
};
type AIEnhance = {
  description: string; lore?: string; designNotes?: string;
  suggestedProperties: { name: string; dataType: string; defaultValue?: string; reason: string }[];
};

// ── Entity type documentation ────────────────────────────────────────────────
const ENTITY_DOCS = {
  Item: {
    color: "text-blue-400",
    border: "border-blue-500/30",
    bg: "bg-blue-500/5",
    badge: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    icon: "📦",
    tagline: "Physical or abstract objects that players hold, spend, trade, or collect.",
    what: "Items are the building blocks of your economy. They can be resources, cards, tokens, weapons, consumables, currencies, or any discrete object that exists in the game world.",
    ideas: [
      "Resources — Gold, Wood, Food, Energy, Victory Points",
      "Cards — Action Card, Event Card, Equipment Card",
      "Tokens — Health Token, Morale Marker, Influence Chip",
      "Equipment — Sword, Shield, Artifact, Relic",
      "Consumables — Potion, Scroll, Bomb, Ration",
      "Currencies — Coin, Credit, Barter Good, Trade Debt",
    ],
    properties: [
      { name: "quantity", type: "number", note: "How many exist at game start" },
      { name: "value", type: "number", note: "Trade or VP worth" },
      { name: "rarity", type: "enum", note: "common/uncommon/rare/legendary" },
      { name: "weight", type: "number", note: "Affects carrying capacity limits" },
      { name: "stackable", type: "boolean", note: "Can multiple occupy one space?" },
      { name: "tradeable", type: "boolean", note: "Can players exchange it?" },
    ],
    designTip: "Items with multiple uses (resource + weapon) create interesting decisions. Consider scarcity — how many copies enter the game and when?",
  },
  Faction: {
    color: "text-purple-400",
    border: "border-purple-500/30",
    bg: "bg-purple-500/5",
    badge: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    icon: "⚔️",
    tagline: "Groups, teams, civilizations, or power blocs that compete or cooperate.",
    what: "Factions define the major players or forces in your game world. They can be player-controlled sides, AI groups, neutral powers, or abstract forces. Each faction typically has unique abilities, resources, and win conditions.",
    ideas: [
      "Civilizations — Roman Empire, Elven Kingdom, Space Federation",
      "Player Roles — Merchant Guild, Military Order, Shadow Syndicate",
      "AI Groups — Bandit Horde, Monster Clan, Rival Corporation",
      "Political Parties — Progressive Alliance, Conservative Council",
      "Species — Human Colony, Alien Hivemind, Robotic Collective",
      "Economic Classes — Nobility, Peasantry, Merchant Class",
    ],
    properties: [
      { name: "influence", type: "number", note: "Political/social power level" },
      { name: "military_strength", type: "number", note: "Combat capability" },
      { name: "treasury", type: "number", note: "Starting gold/resources" },
      { name: "morale", type: "number", note: "Affects action efficiency" },
      { name: "territory", type: "number", note: "Number of controlled zones" },
      { name: "diplomatic_stance", type: "enum", note: "aggressive/neutral/peaceful" },
    ],
    designTip: "Asymmetric factions (each with unique abilities) add deep replayability. Make sure each faction has a clear strategic identity that feels distinct from others.",
  },
  Location: {
    color: "text-green-400",
    border: "border-green-500/30",
    bg: "bg-green-500/5",
    badge: "bg-green-500/20 text-green-400 border-green-500/30",
    icon: "🗺️",
    tagline: "Spaces, zones, regions, tiles, or places players move through or control.",
    what: "Locations form the physical or abstract map of your game. They define where actions happen, what resources are available, how movement works, and what areas are worth controlling.",
    ideas: [
      "Tiles — Forest, Mountain, Desert, Ocean, Plains",
      "Zones — Market District, Industrial Quarter, Residential Area",
      "Regions — Northern Wastes, Trade Route, Neutral Territory",
      "Structures — Castle, Outpost, Factory, Space Station",
      "Abstract Spaces — Supply Chain Node, Political Seat, Trade Hub",
      "Dungeons — Dungeon Room, Treasure Vault, Boss Chamber",
    ],
    properties: [
      { name: "terrain_type", type: "enum", note: "forest/plains/water/mountain/urban" },
      { name: "capacity", type: "number", note: "Max units/players that can occupy" },
      { name: "resource_yield", type: "number", note: "Resources produced per turn" },
      { name: "defense_bonus", type: "number", note: "Combat modifier for occupants" },
      { name: "movement_cost", type: "number", note: "Action points to enter" },
      { name: "connected_to", type: "string", note: "Adjacent location names" },
    ],
    designTip: "Locations create the stage for conflict. Consider adjacency (which locations connect?), control value (what do you gain by holding it?), and chokepoints (high-value bottlenecks that generate tension).",
  },
  Event: {
    color: "text-amber-400",
    border: "border-amber-500/30",
    bg: "bg-amber-500/5",
    badge: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    icon: "⚡",
    tagline: "Triggers, incidents, crises, or opportunities that shake up the game state.",
    what: "Events introduce dynamic change and narrative tension. They can be random occurrences, player-triggered effects, scheduled milestones, or reactive consequences that alter the board state in meaningful ways.",
    ideas: [
      "Disasters — Plague, Famine, Earthquake, Economic Crash",
      "Opportunities — Trade Boom, Harvest Festival, Alliance Offer",
      "Triggers — War Declaration, Regime Change, Discovery",
      "Season Events — Winter Supply Shortage, Summer Harvest, Storm Season",
      "Political Events — Election, Revolt, Treaty, Betrayal",
      "Random Events — Bandit Raid, Magical Anomaly, Supply Drop",
    ],
    properties: [
      { name: "frequency", type: "enum", note: "once/rare/common/every_round" },
      { name: "severity", type: "number", note: "1-10 scale of impact" },
      { name: "duration", type: "number", note: "Rounds the effect lasts" },
      { name: "affects", type: "enum", note: "all_players/active_player/specific_faction" },
      { name: "trigger_condition", type: "string", note: "What causes this event to fire" },
      { name: "reversible", type: "boolean", note: "Can players undo the effect?" },
    ],
    designTip: "Events should feel meaningful but not arbitrary. The best events create interesting decisions (respond or ignore?), shift power dynamics temporarily, and give losing players a path back into the game.",
  },
};

const ENTITY_TYPES = ["Item", "Faction", "Location", "Event"] as const;
type EntityType = typeof ENTITY_TYPES[number];

// ── Badge helper ─────────────────────────────────────────────────────────────
function typeBadge(type: string) {
  const doc = ENTITY_DOCS[type as EntityType];
  return doc?.badge ?? "bg-gray-500/20 text-gray-400 border-gray-500/30";
}

// ════════════════════════════════════════════════════════════════════════════
// Main component
// ════════════════════════════════════════════════════════════════════════════
export default function OntologyTab({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient();
  const { data: entities, isLoading } = useListEntities(projectId, { query: { enabled: !!projectId } });
  const createEntity = useCreateEntity();
  const deleteEntity = useDeleteEntity();
  const { expandedEntities, toggleEntity } = useAppStore();

  const [newEntity, setNewEntity] = useState({ name: "", type: "Item", description: "" });
  const [showGuide, setShowGuide] = useState(false);
  const [activeGuideType, setActiveGuideType] = useState<EntityType>("Item");
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiPrompt, setAIPrompt] = useState("");
  const [aiCount, setAICount] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedEntities, setGeneratedEntities] = useState<AIEntity[]>([]);
  const [selectedEntities, setSelectedEntities] = useState<Set<number>>(new Set());

  const BASE = `${window.location.origin}/api`;

  const handleAIGenerate = async () => {
    setIsGenerating(true);
    setGeneratedEntities([]);
    try {
      const res = await fetch(`${BASE}/projects/${projectId}/ai-generate-entities`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: aiCount, prompt: aiPrompt }),
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedEntities(data);
        setSelectedEntities(new Set(data.map((_: unknown, i: number) => i)));
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddSelectedEntities = async () => {
    const toAdd = generatedEntities.filter((_, i) => selectedEntities.has(i));
    for (const entity of toAdd) {
      await new Promise<void>((resolve) => {
        createEntity.mutate({ projectId, data: { name: entity.name, type: entity.type, description: entity.description } }, {
          onSuccess: async (created) => {
            if (entity.properties && created.id) {
              for (const prop of entity.properties) {
                await fetch(`${BASE}/projects/${projectId}/entities/${created.id}/properties`, {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name: prop.name, dataType: prop.dataType, defaultValue: prop.defaultValue }),
                });
              }
            }
            resolve();
          },
          onError: () => resolve(),
        });
      });
    }
    queryClient.invalidateQueries({ queryKey: getListEntitiesQueryKey(projectId) });
    setGeneratedEntities([]);
    setShowAIPanel(false);
  };

  const handleCreateEntity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntity.name) return;
    createEntity.mutate({ projectId, data: newEntity }, {
      onSuccess: () => {
        setNewEntity({ name: "", type: "Item", description: "" });
        queryClient.invalidateQueries({ queryKey: getListEntitiesQueryKey(projectId) });
      }
    });
  };

  if (isLoading) return (
    <div className="flex items-center gap-2 text-muted-foreground p-8">
      <Loader2 className="w-4 h-4 animate-spin" /> Loading ontology...
    </div>
  );

  const guide = ENTITY_DOCS[activeGuideType];

  return (
    <div className="flex flex-col gap-5 w-full max-w-5xl mx-auto pb-20">

      {/* ── Header ── */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-white">Entity Engine</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            Define the objects, factions, places, and events that make up your game world.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => { setShowGuide(!showGuide); setShowAIPanel(false); }}
            variant="outline"
            size="sm"
            className={`border-border ${showGuide ? "text-white bg-muted/30" : "text-muted-foreground"} hover:text-white`}
          >
            <BookOpen className="w-4 h-4 mr-1.5" />
            Design Guide
          </Button>
          <Button
            onClick={() => { setShowAIPanel(!showAIPanel); setShowGuide(false); }}
            variant="outline"
            size="sm"
            className="border-primary/30 text-primary hover:bg-primary/10"
          >
            <Sparkles className="w-4 h-4 mr-1.5" />
            AI Generate
          </Button>
        </div>
      </div>

      {/* ── Entity Design Guide ── */}
      {showGuide && (
        <Card className="bg-card border-border overflow-hidden">
          <CardHeader className="py-3 px-5 border-b border-border bg-muted/10 flex-row items-center gap-2">
            <BookOpen className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium text-white flex-1">Entity Engine — Design Reference</CardTitle>
            <button onClick={() => setShowGuide(false)} className="text-muted-foreground hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </CardHeader>
          <CardContent className="p-0">
            {/* Type tabs */}
            <div className="flex border-b border-border bg-muted/5">
              {ENTITY_TYPES.map(type => {
                const d = ENTITY_DOCS[type];
                return (
                  <button
                    key={type}
                    onClick={() => setActiveGuideType(type)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeGuideType === type ? `border-current ${d.color}` : "border-transparent text-muted-foreground hover:text-white"}`}
                  >
                    <span>{d.icon}</span>
                    {type}
                  </button>
                );
              })}
            </div>

            <div className={`p-5 ${guide.bg}`}>
              {/* Tagline */}
              <p className={`text-sm font-semibold ${guide.color} mb-1`}>{guide.tagline}</p>
              <p className="text-sm text-muted-foreground mb-4">{guide.what}</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Ideas */}
                <div className="space-y-2">
                  <div className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider ${guide.color}`}>
                    <Lightbulb className="w-3.5 h-3.5" /> Examples & Ideas
                  </div>
                  <ul className="space-y-1">
                    {guide.ideas.map((idea, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                        <span className={`${guide.color} mt-0.5 shrink-0`}>→</span>
                        {idea}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Recommended Properties */}
                <div className="space-y-2">
                  <div className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider ${guide.color}`}>
                    <Settings className="w-3.5 h-3.5" /> Recommended Properties
                  </div>
                  <div className="space-y-2">
                    {guide.properties.map((prop, i) => (
                      <div key={i} className="text-xs">
                        <div className="flex items-center gap-1.5">
                          <code className="text-white font-mono">{prop.name}</code>
                          <Badge variant="outline" className="text-[10px] bg-secondary/30 font-mono">{prop.type}</Badge>
                        </div>
                        <p className="text-muted-foreground mt-0.5 pl-0.5">{prop.note}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Design Tip */}
                <div className="space-y-2">
                  <div className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider ${guide.color}`}>
                    <Info className="w-3.5 h-3.5" /> Design Tip
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{guide.designTip}</p>

                  <div className="mt-3 pt-3 border-t border-border/50">
                    <p className={`text-xs font-medium ${guide.color} mb-1.5`}>Quick-add {activeGuideType}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`text-xs border-current ${guide.color} hover:bg-current/10 w-full`}
                      onClick={() => {
                        setNewEntity({ ...newEntity, type: activeGuideType });
                        setShowGuide(false);
                        document.getElementById("entity-name")?.focus();
                      }}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Start a new {activeGuideType}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── AI Generate Panel ── */}
      {showAIPanel && (
        <Card className="bg-card border-primary/30 border overflow-hidden">
          <CardHeader className="py-3 px-5 border-b border-border bg-primary/5 flex-row items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <CardTitle className="text-sm font-medium text-primary flex-1">AI Entity Generator</CardTitle>
            <button onClick={() => setShowAIPanel(false)} className="text-muted-foreground hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="flex gap-3">
              <div className="flex-1 space-y-1">
                <Label className="text-xs text-muted-foreground">Optional Guidance</Label>
                <Textarea
                  value={aiPrompt}
                  onChange={e => setAIPrompt(e.target.value)}
                  placeholder="e.g. Focus on economic resources and trade items for a merchant empire theme..."
                  className="bg-input h-16 resize-none text-sm"
                />
              </div>
              <div className="w-24 space-y-1">
                <Label className="text-xs text-muted-foreground">Count</Label>
                <Select value={aiCount.toString()} onValueChange={v => setAICount(parseInt(v))}>
                  <SelectTrigger className="bg-input"><SelectValue /></SelectTrigger>
                  <SelectContent>{[3, 5, 8, 10].map(n => <SelectItem key={n} value={n.toString()}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleAIGenerate} disabled={isGenerating} className="bg-primary text-primary-foreground w-full">
              {isGenerating
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Generating entities...</>
                : <><Sparkles className="w-4 h-4 mr-2" />Generate {aiCount} Entities</>}
            </Button>

            {generatedEntities.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{generatedEntities.length} entities generated — select to add:</span>
                  <div className="flex gap-3">
                    <button className="text-primary hover:underline" onClick={() => setSelectedEntities(new Set(generatedEntities.map((_, i) => i)))}>All</button>
                    <button className="text-muted-foreground hover:underline" onClick={() => setSelectedEntities(new Set())}>None</button>
                  </div>
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {generatedEntities.map((entity, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedEntities.has(i) ? "border-primary/40 bg-primary/5" : "border-border bg-muted/10"}`}
                      onClick={() => setSelectedEntities(prev => { const next = new Set(prev); if (next.has(i)) next.delete(i); else next.add(i); return next; })}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${selectedEntities.has(i) ? "border-primary bg-primary" : "border-border"}`}>
                        {selectedEntities.has(i) && <Check className="w-3 h-3 text-primary-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-white text-sm">{entity.name}</span>
                          <Badge variant="outline" className={`text-[10px] ${typeBadge(entity.type)}`}>{entity.type}</Badge>
                          {entity.properties && <span className="text-xs text-muted-foreground">{entity.properties.length} props</span>}
                        </div>
                        {entity.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{entity.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
                <Button onClick={handleAddSelectedEntities} disabled={selectedEntities.size === 0} className="w-full bg-primary text-primary-foreground">
                  Add {selectedEntities.size} Selected {selectedEntities.size === 1 ? "Entity" : "Entities"} to Project
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Add Entity Form ── */}
      <Card className="bg-card border-border">
        <CardHeader className="py-3 px-5 border-b border-border bg-muted/10 flex-row items-center gap-2">
          <Plus className="w-4 h-4 text-primary" />
          <CardTitle className="text-sm font-medium text-white">Add Entity</CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <form onSubmit={handleCreateEntity} className="flex items-end gap-3">
            <div className="flex-1 space-y-1">
              <Label htmlFor="entity-name" className="text-xs text-muted-foreground">Name</Label>
              <Input
                id="entity-name"
                value={newEntity.name}
                onChange={e => setNewEntity({ ...newEntity, name: e.target.value })}
                placeholder="e.g. Gold Coin, Shadow Guild, Thornwood Forest, Plague Event"
                className="bg-input"
              />
            </div>
            <div className="w-44 space-y-1">
              <Label className="text-xs text-muted-foreground">Type</Label>
              <Select value={newEntity.type} onValueChange={v => setNewEntity({ ...newEntity, type: v })}>
                <SelectTrigger className="bg-input"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map(t => (
                    <SelectItem key={t} value={t}>
                      {ENTITY_DOCS[t].icon} {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">Description (optional)</Label>
              <Input
                value={newEntity.description}
                onChange={e => setNewEntity({ ...newEntity, description: e.target.value })}
                placeholder="Brief description..."
                className="bg-input"
              />
            </div>
            <Button type="submit" disabled={createEntity.isPending} className="shrink-0">
              {createEntity.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ── Entity List ── */}
      <div className="space-y-3">
        {entities?.map(entity => (
          <EntityCard
            key={entity.id}
            entity={entity}
            projectId={projectId}
            isExpanded={!!expandedEntities[entity.id]}
            onToggle={() => toggleEntity(entity.id)}
            onDelete={() => {
              if (confirm(`Delete "${entity.name}"?`)) {
                deleteEntity.mutate({ projectId, id: entity.id }, {
                  onSuccess: () => queryClient.invalidateQueries({ queryKey: getListEntitiesQueryKey(projectId) })
                });
              }
            }}
          />
        ))}

        {entities?.length === 0 && (
          <div className="text-center py-16 border border-dashed border-border rounded-xl">
            <Layers className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No entities yet.</p>
            <p className="text-muted-foreground/60 text-xs mt-1">Use "AI Generate" to create a full set, or add entities manually above.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Entity Card with AI Enhance
// ════════════════════════════════════════════════════════════════════════════
function EntityCard({ entity, projectId, isExpanded, onToggle, onDelete }: {
  entity: { id: number; name: string; type: string; description?: string | null };
  projectId: number;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const queryClient = useQueryClient();
  const [showEnhance, setShowEnhance] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhance, setEnhance] = useState<AIEnhance | null>(null);
  const [selectedProps, setSelectedProps] = useState<Set<number>>(new Set());
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  const BASE = `${window.location.origin}/api`;
  const doc = ENTITY_DOCS[entity.type as EntityType];

  const handleEnhance = async () => {
    setIsEnhancing(true);
    setEnhance(null);
    try {
      const res = await fetch(`${BASE}/projects/${projectId}/entities/${entity.id}/ai-enhance`, {
        method: "POST", headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data: AIEnhance = await res.json();
        setEnhance(data);
        setSelectedProps(new Set(data.suggestedProperties.map((_, i) => i)));
      }
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleApply = async () => {
    if (!enhance) return;
    setApplying(true);
    try {
      // Apply description
      await fetch(`${BASE}/projects/${projectId}/entities/${entity.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: enhance.description }),
      });
      // Add selected properties
      const propsToAdd = enhance.suggestedProperties.filter((_, i) => selectedProps.has(i));
      for (const prop of propsToAdd) {
        await fetch(`${BASE}/projects/${projectId}/entities/${entity.id}/properties`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: prop.name, dataType: prop.dataType, defaultValue: prop.defaultValue }),
        });
      }
      queryClient.invalidateQueries({ queryKey: getListEntitiesQueryKey(projectId) });
      setApplied(true);
      setTimeout(() => { setShowEnhance(false); setApplied(false); setEnhance(null); }, 1500);
    } finally {
      setApplying(false);
    }
  };

  return (
    <Card className={`bg-card border-border overflow-hidden transition-shadow hover:shadow-md hover:shadow-black/20`}>
      {/* Header row */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/10 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3 min-w-0">
          {isExpanded
            ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
            : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
          <span className={`text-base font-semibold ${doc?.color ?? "text-white"}`}>{entity.name}</span>
          <Badge variant="outline" className={`text-[10px] shrink-0 ${typeBadge(entity.type)}`}>{entity.type}</Badge>
          {entity.description && (
            <span className="text-xs text-muted-foreground truncate hidden md:block">{entity.description}</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-2" onClick={e => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            className={`text-xs h-7 px-2 gap-1 ${showEnhance ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary hover:bg-primary/10"}`}
            onClick={() => { setShowEnhance(!showEnhance); if (!showEnhance && !enhance) handleEnhance(); }}
          >
            <Wand2 className="w-3.5 h-3.5" />
            AI Enhance
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={onDelete}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* AI Enhance Panel */}
      {showEnhance && (
        <div className={`border-t border-border ${doc?.bg ?? "bg-muted/5"} px-5 py-4`}>
          {isEnhancing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              Analyzing entity and generating improvements...
            </div>
          )}

          {enhance && !isEnhancing && (
            <div className="space-y-4">
              {/* Description preview */}
              <div className="space-y-1.5">
                <div className={`flex items-center gap-1.5 text-xs font-semibold ${doc?.color ?? "text-primary"}`}>
                  <Sparkles className="w-3.5 h-3.5" />
                  Enhanced Description
                </div>
                <p className="text-sm text-white leading-relaxed bg-background/50 border border-border rounded-md p-3">
                  {enhance.description}
                </p>
              </div>

              {/* Lore & Design Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {enhance.lore && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Flavor / Lore</p>
                    <p className="text-xs text-muted-foreground italic leading-relaxed bg-background/40 border border-border/50 rounded p-2.5">
                      "{enhance.lore}"
                    </p>
                  </div>
                )}
                {enhance.designNotes && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Design Notes</p>
                    <p className="text-xs text-muted-foreground leading-relaxed bg-background/40 border border-border/50 rounded p-2.5">
                      {enhance.designNotes}
                    </p>
                  </div>
                )}
              </div>

              {/* Suggested Properties */}
              {enhance.suggestedProperties.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className={`text-xs font-semibold uppercase tracking-wider ${doc?.color ?? "text-primary"}`}>
                      Suggested Properties ({enhance.suggestedProperties.length})
                    </p>
                    <div className="flex gap-2 text-xs">
                      <button className="text-primary hover:underline" onClick={() => setSelectedProps(new Set(enhance.suggestedProperties.map((_, i) => i)))}>All</button>
                      <button className="text-muted-foreground hover:underline" onClick={() => setSelectedProps(new Set())}>None</button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {enhance.suggestedProperties.map((prop, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-2.5 p-2.5 rounded-md border cursor-pointer transition-colors ${selectedProps.has(i) ? "border-primary/40 bg-primary/5" : "border-border bg-muted/10"}`}
                        onClick={() => setSelectedProps(prev => { const next = new Set(prev); if (next.has(i)) next.delete(i); else next.add(i); return next; })}
                      >
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${selectedProps.has(i) ? "border-primary bg-primary" : "border-border"}`}>
                          {selectedProps.has(i) && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <code className="text-white text-xs font-mono">{prop.name}</code>
                            <Badge variant="outline" className="text-[10px] font-mono bg-secondary/30">{prop.dataType}</Badge>
                            {prop.defaultValue && <span className="text-xs text-muted-foreground font-mono">= {prop.defaultValue}</span>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{prop.reason}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-2 pt-1">
                <Button
                  onClick={handleApply}
                  disabled={applying || applied}
                  size="sm"
                  className="bg-primary text-primary-foreground"
                >
                  {applied
                    ? <><Check className="w-3.5 h-3.5 mr-1.5" />Applied!</>
                    : applying
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Applying...</>
                      : <><Wand2 className="w-3.5 h-3.5 mr-1.5" />Apply Description{selectedProps.size > 0 ? ` + ${selectedProps.size} ${selectedProps.size === 1 ? "Property" : "Properties"}` : ""}</>}
                </Button>
                <Button
                  onClick={handleEnhance}
                  disabled={isEnhancing}
                  size="sm"
                  variant="outline"
                  className="text-muted-foreground border-border hover:text-white"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  Regenerate
                </Button>
                <Button
                  onClick={() => setShowEnhance(false)}
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-white ml-auto"
                >
                  Dismiss
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Properties panel (expanded) */}
      {isExpanded && (
        <div className="px-5 py-4 border-t border-border bg-muted/5">
          <EntityProperties projectId={projectId} entityId={entity.id} />
        </div>
      )}
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Entity Properties sub-component
// ════════════════════════════════════════════════════════════════════════════
function EntityProperties({ projectId, entityId }: { projectId: number; entityId: number }) {
  const queryClient = useQueryClient();
  const { data: properties, isLoading } = useListProperties(projectId, entityId, { query: { enabled: !!entityId } });
  const createProperty = useCreateProperty();
  const deleteProperty = useDeleteProperty();

  const [newProp, setNewProp] = useState({ name: "", dataType: "number", defaultValue: "" });

  const handleAddProp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProp.name) return;
    createProperty.mutate({ projectId, entityId, data: newProp }, {
      onSuccess: () => {
        setNewProp({ name: "", dataType: "number", defaultValue: "" });
        queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey(projectId, entityId) });
      }
    });
  };

  if (isLoading) return <div className="text-sm text-muted-foreground py-1">Loading properties...</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        <Settings className="w-3.5 h-3.5" /> Properties
      </div>

      {properties && properties.length > 0 && (
        <div className="rounded-md border border-border overflow-hidden">
          <div className="grid grid-cols-12 gap-3 px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/20 border-b border-border">
            <div className="col-span-5">Name</div>
            <div className="col-span-3">Type</div>
            <div className="col-span-3">Default</div>
            <div className="col-span-1" />
          </div>
          {properties.map(prop => (
            <div key={prop.id} className="grid grid-cols-12 gap-3 px-3 py-2 items-center text-sm border-b border-border/40 last:border-0 hover:bg-muted/10">
              <div className="col-span-5 font-mono text-xs text-white">{prop.name}</div>
              <div className="col-span-3">
                <Badge variant="secondary" className="bg-secondary/40 font-mono text-[10px]">{prop.dataType}</Badge>
              </div>
              <div className="col-span-3 text-muted-foreground font-mono text-xs">{prop.defaultValue || "—"}</div>
              <div className="col-span-1 flex justify-end">
                <Button
                  variant="ghost" size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  onClick={() => deleteProperty.mutate({ projectId, entityId, id: prop.id }, {
                    onSuccess: () => queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey(projectId, entityId) })
                  })}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(!properties || properties.length === 0) && (
        <p className="text-xs text-muted-foreground/60 py-1">No properties yet. Add some below or use AI Enhance to get suggestions.</p>
      )}

      <form onSubmit={handleAddProp} className="flex gap-2 items-end">
        <div className="flex-1 space-y-1">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Property Name</Label>
          <Input size={1} className="h-8 text-xs bg-input font-mono" placeholder="property_name"
            value={newProp.name} onChange={e => setNewProp({ ...newProp, name: e.target.value })} />
        </div>
        <div className="w-32 space-y-1">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Type</Label>
          <Select value={newProp.dataType} onValueChange={v => setNewProp({ ...newProp, dataType: v })}>
            <SelectTrigger className="h-8 text-xs bg-input"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="number">number</SelectItem>
              <SelectItem value="string">string</SelectItem>
              <SelectItem value="boolean">boolean</SelectItem>
              <SelectItem value="enum">enum</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-32 space-y-1">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Default</Label>
          <Input size={1} className="h-8 text-xs bg-input font-mono" placeholder="0"
            value={newProp.defaultValue} onChange={e => setNewProp({ ...newProp, defaultValue: e.target.value })} />
        </div>
        <Button size="sm" className="h-8 shrink-0" type="submit" disabled={createProperty.isPending}>
          <Plus className="w-3.5 h-3.5 mr-1" />Add
        </Button>
      </form>
    </div>
  );
}
