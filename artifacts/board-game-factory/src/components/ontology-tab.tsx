import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListEntities, useCreateEntity, useDeleteEntity, useListProperties, useCreateProperty, useDeleteProperty, getListEntitiesQueryKey, getListPropertiesQueryKey } from "@workspace/api-client-react";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, ChevronDown, ChevronRight, Settings, Sparkles, Loader2, Check } from "lucide-react";

type AIEntity = { name: string; type: string; description: string; properties?: { name: string; dataType: string; defaultValue?: string }[] };

export default function OntologyTab({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient();
  const { data: entities, isLoading } = useListEntities(projectId, { query: { enabled: !!projectId } });
  const createEntity = useCreateEntity();
  const deleteEntity = useDeleteEntity();
  const { expandedEntities, toggleEntity } = useAppStore();

  const [newEntity, setNewEntity] = useState({ name: "", type: "Item", description: "" });
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

  const getBadgeColor = (type: string) => {
    switch (type) {
      case "Item": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "Faction": return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "Location": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "Event": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      default: return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  if (isLoading) return <div>Loading ontology...</div>;

  return (
    <div className="flex flex-col gap-6 w-full max-w-5xl mx-auto pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Entity Builder</h2>
          <p className="text-muted-foreground text-sm">Define the objects and concepts in your game.</p>
        </div>
        <Button
          onClick={() => setShowAIPanel(!showAIPanel)}
          variant="outline"
          className="border-primary/30 text-primary hover:bg-primary/10"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          AI Generate Entities
        </Button>
      </div>

      {/* AI Generate Panel */}
      {showAIPanel && (
        <Card className="bg-card border-primary/30 border">
          <CardHeader className="py-4 px-6 border-b border-border bg-primary/5">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-primary">
              <Sparkles className="w-4 h-4" />
              AI Entity Generator
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="flex gap-3">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Optional Guidance</Label>
                <Textarea
                  value={aiPrompt}
                  onChange={e => setAIPrompt(e.target.value)}
                  placeholder="e.g. Focus on economic resources and trade items..."
                  className="bg-input h-16 resize-none text-sm"
                />
              </div>
              <div className="w-24 space-y-1">
                <Label className="text-xs">Count</Label>
                <Select value={aiCount.toString()} onValueChange={v => setAICount(parseInt(v))}>
                  <SelectTrigger className="bg-input"><SelectValue /></SelectTrigger>
                  <SelectContent>{[3,5,8,10].map(n => <SelectItem key={n} value={n.toString()}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleAIGenerate} disabled={isGenerating} className="bg-primary text-primary-foreground w-full">
              {isGenerating ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Generating...</> : <><Sparkles className="w-4 h-4 mr-2" />Generate Entities</>}
            </Button>

            {generatedEntities.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Select entities to add:</span>
                  <div className="flex gap-2">
                    <button className="text-xs text-primary hover:underline" onClick={() => setSelectedEntities(new Set(generatedEntities.map((_, i) => i)))}>All</button>
                    <button className="text-xs text-muted-foreground hover:underline" onClick={() => setSelectedEntities(new Set())}>None</button>
                  </div>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {generatedEntities.map((entity, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedEntities.has(i) ? "border-primary/40 bg-primary/5" : "border-border bg-muted/10"}`}
                      onClick={() => setSelectedEntities(prev => { const next = new Set(prev); if (next.has(i)) next.delete(i); else next.add(i); return next; })}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 ${selectedEntities.has(i) ? "border-primary bg-primary" : "border-border"}`}>
                        {selectedEntities.has(i) && <Check className="w-3 h-3 text-primary-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white text-sm">{entity.name}</span>
                          <Badge variant="outline" className={`text-[10px] ${entity.type === "Item" ? "bg-blue-500/10 text-blue-400 border-blue-500/30" : entity.type === "Faction" ? "bg-purple-500/10 text-purple-400 border-purple-500/30" : entity.type === "Location" ? "bg-green-500/10 text-green-400 border-green-500/30" : "bg-amber-500/10 text-amber-400 border-amber-500/30"}`}>{entity.type}</Badge>
                          {entity.properties && <span className="text-xs text-muted-foreground">{entity.properties.length} props</span>}
                        </div>
                        {entity.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{entity.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
                <Button onClick={handleAddSelectedEntities} disabled={selectedEntities.size === 0} className="w-full bg-primary text-primary-foreground">
                  Add {selectedEntities.size} Selected Entities to Project
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="bg-card border-border">
        <CardHeader className="py-4 px-6 border-b border-border bg-muted/20">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" />
            Add New Entity
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleCreateEntity} className="flex items-end gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="entity-name">Name</Label>
              <Input 
                id="entity-name" 
                value={newEntity.name} 
                onChange={(e) => setNewEntity({ ...newEntity, name: e.target.value })} 
                placeholder="e.g. Gold Coin, Space Station"
                className="bg-input"
              />
            </div>
            <div className="w-48 space-y-2">
              <Label htmlFor="entity-type">Type</Label>
              <Select value={newEntity.type} onValueChange={(v) => setNewEntity({ ...newEntity, type: v })}>
                <SelectTrigger id="entity-type" className="bg-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Item">Item</SelectItem>
                  <SelectItem value="Faction">Faction</SelectItem>
                  <SelectItem value="Location">Location</SelectItem>
                  <SelectItem value="Event">Event</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={createEntity.isPending}>Add Entity</Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4 mt-4">
        {entities?.map((entity) => (
          <Card key={entity.id} className="bg-card border-border overflow-hidden">
            <div 
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/10 transition-colors"
              onClick={() => toggleEntity(entity.id)}
            >
              <div className="flex items-center gap-3">
                {expandedEntities[entity.id] ? 
                  <ChevronDown className="w-5 h-5 text-muted-foreground" /> : 
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                }
                <h3 className="text-lg font-semibold text-white">{entity.name}</h3>
                <Badge variant="outline" className={getBadgeColor(entity.type)}>{entity.type}</Badge>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={(e) => {
                  e.stopPropagation();
                  if(confirm("Delete entity?")) deleteEntity.mutate({ projectId, id: entity.id }, {
                    onSuccess: () => queryClient.invalidateQueries({ queryKey: getListEntitiesQueryKey(projectId) })
                  });
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>

            {expandedEntities[entity.id] && (
              <div className="p-4 border-t border-border bg-muted/5">
                <EntityProperties projectId={projectId} entityId={entity.id} />
              </div>
            )}
          </Card>
        ))}
        {entities?.length === 0 && (
          <div className="text-center py-12 border border-dashed border-border rounded-lg text-muted-foreground">
            No entities defined yet. Create your first entity above.
          </div>
        )}
      </div>
    </div>
  );
}

function EntityProperties({ projectId, entityId }: { projectId: number, entityId: number }) {
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

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading properties...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-4">
        <Settings className="w-4 h-4" />
        Properties
      </div>

      <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">
        <div className="col-span-4">Name</div>
        <div className="col-span-3">Type</div>
        <div className="col-span-4">Default Value</div>
        <div className="col-span-1"></div>
      </div>

      {properties?.map(prop => (
        <div key={prop.id} className="grid grid-cols-12 gap-4 px-4 py-2 items-center text-sm border-b border-border/50 last:border-0 hover:bg-muted/10">
          <div className="col-span-4 font-medium text-white">{prop.name}</div>
          <div className="col-span-3">
            <Badge variant="secondary" className="bg-secondary/50 font-mono text-[10px]">{prop.dataType}</Badge>
          </div>
          <div className="col-span-4 text-muted-foreground font-mono">{prop.defaultValue || "-"}</div>
          <div className="col-span-1 flex justify-end">
            <Button 
              variant="ghost" 
              size="icon" 
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

      <form onSubmit={handleAddProp} className="grid grid-cols-12 gap-4 px-4 pt-4 mt-2">
        <div className="col-span-4">
          <Input 
            size={1} 
            className="h-8 text-sm bg-input" 
            placeholder="New property name" 
            value={newProp.name}
            onChange={e => setNewProp({...newProp, name: e.target.value})}
          />
        </div>
        <div className="col-span-3">
          <Select value={newProp.dataType} onValueChange={v => setNewProp({...newProp, dataType: v})}>
            <SelectTrigger className="h-8 text-sm bg-input">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="number">number</SelectItem>
              <SelectItem value="string">string</SelectItem>
              <SelectItem value="boolean">boolean</SelectItem>
              <SelectItem value="enum">enum</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-4">
          <Input 
            size={1} 
            className="h-8 text-sm bg-input" 
            placeholder="Default value (opt)" 
            value={newProp.defaultValue}
            onChange={e => setNewProp({...newProp, defaultValue: e.target.value})}
          />
        </div>
        <div className="col-span-1">
          <Button size="sm" className="h-8 w-full" type="submit" disabled={createProperty.isPending}>Add</Button>
        </div>
      </form>
    </div>
  );
}
