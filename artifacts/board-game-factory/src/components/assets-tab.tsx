import { useState } from "react";
import { useListAssets, useCreateAsset, useDeleteAsset, useListEntities } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Trash2, Image as ImageIcon, Sparkles, Plus, Loader2, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AssetsTab({ projectId }: { projectId: number }) {
  const { data: assets, refetch } = useListAssets(projectId, { query: { enabled: !!projectId } });
  const { data: entities } = useListEntities(projectId, { query: { enabled: !!projectId } });
  const deleteAsset = useDeleteAsset();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  return (
    <div className="h-full flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-white">Asset Generator</h2>
          <p className="text-muted-foreground text-sm">Generate cards, tokens, and art assets for your game.</p>
        </div>
        <div className="flex items-center gap-2">
          {(assets?.length ?? 0) > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="border-border text-muted-foreground hover:text-white"
              onClick={() => {
                const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Print Sheet</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:sans-serif;background:#fff;color:#111}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:20px}
.card{border:2px solid #222;border-radius:8px;overflow:hidden;page-break-inside:avoid;height:280px;display:flex;flex-direction:column}
.card-img{height:140px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;overflow:hidden}
.card-img img{width:100%;height:100%;object-fit:cover}
.card-img-placeholder{font-size:32px}
.card-body{padding:8px;flex:1;display:flex;flex-direction:column}
.card-type{font-size:8px;text-transform:uppercase;letter-spacing:1px;color:#888;font-weight:bold}
.card-name{font-size:14px;font-weight:700;margin:2px 0 4px}
.card-desc{font-size:9px;line-height:1.4;color:#444;flex:1;overflow:hidden}
.card-flavor{font-size:8px;color:#666;font-style:italic;border-top:1px solid #eee;padding-top:4px;margin-top:4px}
@media print{body{margin:0}.grid{gap:8px;padding:10px}}
</style></head><body>
<div style="text-align:center;padding:10px 0 5px;font-size:12px;font-weight:bold;color:#666">PRINT & PLAY CARD SHEET</div>
<div class="grid">
${(assets ?? []).map(a => `<div class="card">
  <div class="card-img">${a.imageData ? `<img src="data:image/png;base64,${a.imageData}" />` : `<div class="card-img-placeholder">🃏</div>`}</div>
  <div class="card-body">
    <div class="card-type">${a.assetType ?? "card"}</div>
    <div class="card-name">${a.name}</div>
    <div class="card-desc">${a.description ?? ""}</div>
    ${a.flavorText ? `<div class="card-flavor">"${a.flavorText}"</div>` : ""}
  </div>
</div>`).join("")}
</div>
<script>window.onload=()=>window.print();<\/script>
</body></html>`;
                const w = window.open("", "_blank");
                w?.document.write(html);
                w?.document.close();
              }}
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              Print Sheet
            </Button>
          )}
          <AssetCreatorDialog
            projectId={projectId}
            entities={entities || []}
            open={isDialogOpen}
            onOpenChange={setIsDialogOpen}
            onSuccess={() => {
              setIsDialogOpen(false);
              refetch();
            }}
          />
        </div>
      </div>

      {assets?.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-border rounded-xl bg-card/50">
          <ImageIcon className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-white mb-2">No assets yet</h3>
          <p className="text-muted-foreground mb-4 text-center max-w-md">Generate artwork and descriptions for cards, tokens, and other game components.</p>
          <Button onClick={() => setIsDialogOpen(true)}><Plus className="w-4 h-4 mr-2" /> Create Asset</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 overflow-y-auto pb-20">
          {assets?.map(asset => (
            <Card key={asset.id} className="overflow-hidden bg-card border-border flex flex-col">
              <div className="relative aspect-square bg-muted/20 border-b border-border flex items-center justify-center group">
                {asset.imageData ? (
                  <img src={`data:image/png;base64,${asset.imageData}`} alt={asset.name} className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-12 h-12 text-muted-foreground opacity-20" />
                )}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button 
                    variant="destructive" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={() => {
                      if(confirm("Delete this asset?")) {
                        deleteAsset.mutate({ projectId, id: asset.id }, { onSuccess: () => refetch() });
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="p-4 flex flex-col flex-1">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-white truncate">{asset.name}</h3>
                  <span className="text-[10px] uppercase tracking-wider bg-primary/20 text-primary px-2 py-0.5 rounded font-semibold">{asset.assetType}</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{asset.description}</p>
                </div>
                {asset.flavorText && (
                  <p className="text-xs italic text-muted-foreground mt-4 pt-3 border-t border-border/50">
                    "{asset.flavorText}"
                  </p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function AssetCreatorDialog({ 
  projectId, 
  entities, 
  open, 
  onOpenChange,
  onSuccess
}: { 
  projectId: number, 
  entities: any[],
  open: boolean,
  onOpenChange: (open: boolean) => void,
  onSuccess: () => void
}) {
  const createAsset = useCreateAsset();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    assetType: "card",
    entityId: "",
    description: "",
    flavorText: "",
    imagePrompt: "",
    imageData: ""
  });

  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  const handleGenerateDesc = async () => {
    if (!formData.name) {
      toast({ title: "Name required", description: "Please enter a name first.", variant: "destructive" });
      return;
    }
    
    setIsGeneratingDesc(true);
    setFormData(prev => ({ ...prev, description: "", flavorText: "" }));

    try {
      const response = await fetch(`/api/projects/${projectId}/generate-card-description`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          cardName: formData.name,
          cardType: formData.assetType,
          entityId: formData.entityId ? parseInt(formData.entityId) : undefined
        }),
      });

      if (!response.body) throw new Error("No body");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(Boolean);
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '');
            if (dataStr === '[DONE]') continue;
            try {
              const data = JSON.parse(dataStr);
              if (data.content) {
                fullText += data.content;
                // Rough attempt to split description and flavor text if AI formatted it that way
                const parts = fullText.split('FLAVOR:');
                setFormData(prev => ({ 
                  ...prev, 
                  description: parts[0].trim(),
                  flavorText: parts[1] ? parts[1].trim().replace(/"/g, '') : prev.flavorText
                }));
              }
            } catch (e) {
              console.error(e);
            }
          }
        }
      }
    } catch (e) {
      toast({ title: "Generation failed", variant: "destructive" });
    } finally {
      setIsGeneratingDesc(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!formData.imagePrompt && !formData.name) {
      toast({ title: "Prompt required", description: "Please enter an image prompt or asset name.", variant: "destructive" });
      return;
    }

    setIsGeneratingImage(true);
    // Use raw fetch for image since the hook structure isn't entirely clear on the body wrapping
    try {
      const res = await fetch(`/api/projects/${projectId}/generate-asset-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: formData.imagePrompt || `A board game ${formData.assetType} art for: ${formData.name}`,
          size: "1024x1024"
        })
      });
      if (!res.ok) throw new Error("Failed to generate");
      const data = await res.json();
      if (data.b64_json) {
        setFormData(prev => ({ ...prev, imageData: data.b64_json }));
        toast({ title: "Image generated successfully" });
      }
    } catch (e) {
      toast({ title: "Image generation failed", variant: "destructive" });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleSave = () => {
    if (!formData.name) return;
    
    createAsset.mutate({
      projectId,
      data: {
        ...formData,
        entityId: formData.entityId ? parseInt(formData.entityId) : null
      }
    }, {
      onSuccess: () => {
        toast({ title: "Asset saved" });
        setFormData({
          name: "", assetType: "card", entityId: "", description: "", flavorText: "", imagePrompt: "", imageData: ""
        });
        onSuccess();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" /> Create Asset
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl bg-card border-border text-foreground grid grid-cols-2 gap-6 p-0 overflow-hidden">
        <div className="p-6 space-y-4 border-r border-border max-h-[80vh] overflow-y-auto custom-scrollbar">
          <DialogHeader className="mb-4">
            <DialogTitle>New Game Asset</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <Label>Asset Name</Label>
            <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="bg-input" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Asset Type</Label>
              <Select value={formData.assetType} onValueChange={v => setFormData({...formData, assetType: v})}>
                <SelectTrigger className="bg-input"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="token">Token</SelectItem>
                  <SelectItem value="board_tile">Board Tile</SelectItem>
                  <SelectItem value="player_mat">Player Mat</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Link to Entity (Optional)</Label>
              <Select value={formData.entityId || "none"} onValueChange={v => setFormData({...formData, entityId: v === "none" ? "" : v})}>
                <SelectTrigger className="bg-input"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {entities.map(e => <SelectItem key={e.id} value={e.id.toString()}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t border-border">
            <div className="flex justify-between items-center">
              <Label>Mechanics / Description</Label>
              <Button size="sm" variant="secondary" className="h-7 text-xs bg-primary/20 text-primary hover:bg-primary/30 border-0" onClick={handleGenerateDesc} disabled={isGeneratingDesc || !formData.name}>
                {isGeneratingDesc ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                Auto-generate
              </Button>
            </div>
            <Textarea 
              value={formData.description} 
              onChange={e => setFormData({...formData, description: e.target.value})} 
              className="h-24 bg-input resize-none" 
            />
          </div>

          <div className="space-y-2">
            <Label>Flavor Text</Label>
            <Input 
              value={formData.flavorText} 
              onChange={e => setFormData({...formData, flavorText: e.target.value})} 
              className="bg-input italic" 
            />
          </div>
        </div>

        <div className="p-6 space-y-4 flex flex-col bg-muted/5 max-h-[80vh]">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Image Prompt</Label>
              <Button size="sm" variant="secondary" className="h-7 text-xs bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 border-0" onClick={handleGenerateImage} disabled={isGeneratingImage}>
                {isGeneratingImage ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <ImageIcon className="w-3 h-3 mr-1" />}
                Generate Art
              </Button>
            </div>
            <Textarea 
              value={formData.imagePrompt} 
              onChange={e => setFormData({...formData, imagePrompt: e.target.value})} 
              placeholder="Describe the artwork... (or leave blank to use asset name)"
              className="h-16 bg-input resize-none text-sm" 
            />
          </div>

          <div className="flex-1 border border-border rounded-lg bg-card/50 flex items-center justify-center overflow-hidden relative">
            {isGeneratingImage ? (
              <div className="flex flex-col items-center text-muted-foreground gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                <span className="text-sm animate-pulse">Generating artwork via DALL-E 3...</span>
              </div>
            ) : formData.imageData ? (
              <img src={`data:image/png;base64,${formData.imageData}`} alt="Generated" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center text-muted-foreground gap-2 opacity-50">
                <ImageIcon className="w-12 h-12" />
                <span className="text-sm">No image generated</span>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-border flex justify-end gap-3 shrink-0">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createAsset.isPending || !formData.name}>
              {createAsset.isPending ? "Saving..." : "Save Asset"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
