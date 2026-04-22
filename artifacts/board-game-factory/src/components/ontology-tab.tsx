import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListEntities, useCreateEntity, useDeleteEntity, useListProperties, useCreateProperty, useDeleteProperty, getListEntitiesQueryKey, getListPropertiesQueryKey } from "@workspace/api-client-react";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Plus, Trash2, ChevronDown, ChevronRight, Settings } from "lucide-react";

export default function OntologyTab({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient();
  const { data: entities, isLoading } = useListEntities(projectId, { query: { enabled: !!projectId } });
  const createEntity = useCreateEntity();
  const deleteEntity = useDeleteEntity();
  const { expandedEntities, toggleEntity } = useAppStore();

  const [newEntity, setNewEntity] = useState({ name: "", type: "Item", description: "" });

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
      </div>

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
