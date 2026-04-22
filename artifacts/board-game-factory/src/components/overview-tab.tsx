import { useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getListEntitiesQueryKey, getListRulesQueryKey, useGetProject, useUpdateProject } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, Link2, Trash2, Sparkles, FileText, Globe, CheckCircle, AlertCircle, Loader2, ChevronRight, Users, Layers, BookOpen } from "lucide-react";

type ProjectFile = { id: number; filename: string; fileType: string; sourceUrl?: string; extractedText?: string; createdAt: string };

type BlueprintOverview = {
  summary?: string;
  theme?: string;
  mechanics?: string[];
  playerCount?: string;
  duration?: string;
  complexity?: string;
};

type BlueprintEntity = {
  name: string;
  type: string;
  description: string;
  properties?: { name: string; dataType: string; defaultValue?: string }[];
};

type BlueprintRule = {
  title: string;
  content: string;
  category: string;
  priority?: number;
};

type BlueprintPlayer = {
  name: string;
  archetype: string;
  description: string;
  victoryCondition: string;
  specialAbility: string;
  playstyle: string;
  startingResources?: Record<string, number | string>;
};

type Blueprint = {
  overview?: BlueprintOverview;
  entities?: BlueprintEntity[];
  rules?: BlueprintRule[];
  players?: BlueprintPlayer[];
};

export default function OverviewTab({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient();
  const { data: project } = useGetProject(projectId, { query: { enabled: !!projectId } });
  const updateProject = useUpdateProject();

  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [isUploadingUrl, setIsUploadingUrl] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPopulating, setIsPopulating] = useState(false);
  const [analyzeStream, setAnalyzeStream] = useState("");
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [populateResult, setPopulateResult] = useState<{ entities: number; rules: number; players: number } | null>(null);
  const [editDescription, setEditDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState(project?.description || "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const BASE = `${window.location.origin}/api`;

  const loadFiles = useCallback(async () => {
    const res = await fetch(`${BASE}/projects/${projectId}/files`);
    if (res.ok) setFiles(await res.json());
  }, [projectId, BASE]);

  useState(() => { loadFiles(); });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE}/projects/${projectId}/files/upload`, { method: "POST", body: form });
    if (res.ok) loadFiles();
  };

  const handleUrlFetch = async () => {
    if (!urlInput.trim()) return;
    setIsUploadingUrl(true);
    try {
      const res = await fetch(`${BASE}/projects/${projectId}/files/fetch-url`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput }),
      });
      if (res.ok) { setUrlInput(""); loadFiles(); }
    } finally {
      setIsUploadingUrl(false);
    }
  };

  const handleDeleteFile = async (id: number) => {
    await fetch(`${BASE}/projects/${projectId}/files/${id}`, { method: "DELETE" });
    loadFiles();
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setAnalyzeStream("");
    setBlueprint(null);

    let fullText = "";
    try {
      const res = await fetch(`${BASE}/projects/${projectId}/analyze-and-build`, { method: "POST" });
      if (!res.body) throw new Error("No response body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) { fullText += data.content; setAnalyzeStream(fullText); }
              if (data.done && data.raw) {
                const match = data.raw.match(/\{[\s\S]*\}/);
                if (match) {
                  try { setBlueprint(JSON.parse(match[0])); } catch { /* ignore parse errors */ }
                }
              }
            } catch { /* ignore */ }
          }
        }
      }
      // Try to parse from fullText if done event didn't fire
      if (!blueprint) {
        const match = fullText.match(/\{[\s\S]*\}/);
        if (match) {
          try { setBlueprint(JSON.parse(match[0])); } catch { /* ignore */ }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePopulate = async (clearExisting: boolean) => {
    if (!blueprint) return;
    setIsPopulating(true);
    try {
      const res = await fetch(`${BASE}/projects/${projectId}/populate-from-blueprint`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blueprint, clearExisting }),
      });
      if (res.ok) {
        const result = await res.json();
        setPopulateResult(result);
        queryClient.invalidateQueries({ queryKey: getListEntitiesQueryKey(projectId) });
        queryClient.invalidateQueries({ queryKey: getListRulesQueryKey(projectId) });
      }
    } finally {
      setIsPopulating(false);
    }
  };

  const handleSaveDescription = () => {
    updateProject.mutate({ id: projectId, data: { description: descriptionDraft } });
    setEditDescription(false);
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-20">
      {/* Game Overview */}
      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            Game Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Title</span>
              <p className="text-white font-medium mt-1">{project?.name}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Genre</span>
              <p className="text-white font-medium mt-1">{project?.genre || "Not set"}</p>
            </div>
            {project?.playerCount && <div><span className="text-muted-foreground">Players</span><p className="text-white font-medium mt-1">{project.playerCount}</p></div>}
            {project?.targetDuration && <div><span className="text-muted-foreground">Duration</span><p className="text-white font-medium mt-1">{project.targetDuration}</p></div>}
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-muted-foreground text-sm">Description</span>
              <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground" onClick={() => { setEditDescription(!editDescription); setDescriptionDraft(project?.description || ""); }}>
                {editDescription ? "Cancel" : "Edit"}
              </Button>
            </div>
            {editDescription ? (
              <div className="space-y-2">
                <Textarea value={descriptionDraft} onChange={e => setDescriptionDraft(e.target.value)} className="bg-input min-h-[80px]" />
                <Button size="sm" onClick={handleSaveDescription}>Save</Button>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">{project?.description || "No description yet."}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Reference Material Upload */}
      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-white flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            Reference Materials
          </CardTitle>
          <p className="text-muted-foreground text-sm mt-1">Upload PDFs, text files, or paste URLs. AI will analyze them to build your game.</p>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {/* File upload */}
          <div
            className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) { const input = fileInputRef.current; if (input) { const dt = new DataTransfer(); dt.items.add(file); input.files = dt.files; input.dispatchEvent(new Event("change", { bubbles: true })); } } }}
          >
            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Drag & drop or click to upload PDF, TXT, or any text file</p>
            <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.txt,.md,.json,.csv" onChange={handleFileUpload} />
          </div>

          {/* URL input */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Globe className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleUrlFetch()}
                placeholder="https://boardgamegeek.com/boardgame/... or any URL"
                className="pl-9 bg-input"
              />
            </div>
            <Button onClick={handleUrlFetch} disabled={isUploadingUrl || !urlInput.trim()} variant="outline">
              {isUploadingUrl ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              Fetch
            </Button>
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-2">
              {files.map(file => (
                <div key={file.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border border-border">
                  {file.fileType === "text/url" ? <Globe className="w-4 h-4 text-blue-400 shrink-0" /> : <FileText className="w-4 h-4 text-green-400 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{file.filename}</p>
                    <p className="text-xs text-muted-foreground">{file.extractedText ? `${file.extractedText.length.toLocaleString()} chars extracted` : "No text extracted"}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0" onClick={() => handleDeleteFile(file.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Analyze & Build */}
      <Card className="bg-card border-border border-primary/30">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            AI Game Architect
          </CardTitle>
          <p className="text-muted-foreground text-sm mt-1">AI will analyze your materials and generate a complete game blueprint — entities, rules, and player archetypes.</p>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <Button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base"
          >
            {isAnalyzing ? (
              <><Loader2 className="w-5 h-5 animate-spin mr-2" />Analyzing & Generating Blueprint...</>
            ) : (
              <><Sparkles className="w-5 h-5 mr-2" />Generate Complete Game Blueprint</>
            )}
          </Button>

          {isAnalyzing && analyzeStream && (
            <div className="bg-muted/20 rounded-lg p-4 border border-border max-h-48 overflow-y-auto">
              <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap">{analyzeStream.slice(-2000)}</pre>
            </div>
          )}

          {blueprint && (
            <div className="space-y-4">
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-primary font-semibold">
                  <CheckCircle className="w-5 h-5" />
                  Blueprint Generated
                </div>

                {blueprint.overview && (
                  <div className="space-y-2">
                    <p className="text-white text-sm">{blueprint.overview.summary}</p>
                    <div className="flex flex-wrap gap-2">
                      {blueprint.overview.mechanics?.map(m => <Badge key={m} variant="outline" className="text-xs">{m}</Badge>)}
                      {blueprint.overview.playerCount && <Badge variant="outline" className="text-xs text-muted-foreground">{blueprint.overview.playerCount} players</Badge>}
                      {blueprint.overview.duration && <Badge variant="outline" className="text-xs text-muted-foreground">{blueprint.overview.duration}</Badge>}
                      {blueprint.overview.complexity && <Badge variant="outline" className="text-xs text-muted-foreground">{blueprint.overview.complexity}</Badge>}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-center">
                    <Layers className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                    <div className="text-2xl font-bold text-blue-400">{blueprint.entities?.length ?? 0}</div>
                    <div className="text-xs text-muted-foreground">Entities</div>
                  </div>
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-center">
                    <BookOpen className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                    <div className="text-2xl font-bold text-amber-400">{blueprint.rules?.length ?? 0}</div>
                    <div className="text-xs text-muted-foreground">Rules</div>
                  </div>
                  <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 text-center">
                    <Users className="w-5 h-5 text-purple-400 mx-auto mb-1" />
                    <div className="text-2xl font-bold text-purple-400">{blueprint.players?.length ?? 0}</div>
                    <div className="text-xs text-muted-foreground">Player Types</div>
                  </div>
                </div>

                {/* Entity preview */}
                {blueprint.entities && blueprint.entities.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2">Entities Preview</p>
                    <div className="flex flex-wrap gap-2">
                      {blueprint.entities.map(e => (
                        <Badge key={e.name} variant="outline" className={
                          e.type === "Item" ? "bg-blue-500/10 text-blue-400 border-blue-500/30" :
                          e.type === "Faction" ? "bg-purple-500/10 text-purple-400 border-purple-500/30" :
                          e.type === "Location" ? "bg-green-500/10 text-green-400 border-green-500/30" :
                          "bg-amber-500/10 text-amber-400 border-amber-500/30"
                        }>{e.name}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {populateResult ? (
                <div className="flex items-center gap-2 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
                  <CheckCircle className="w-5 h-5 shrink-0" />
                  <span className="text-sm font-medium">
                    Populated: {populateResult.entities} entities, {populateResult.rules} rules, {populateResult.players} player types added to your project.
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Button onClick={() => handlePopulate(false)} disabled={isPopulating} variant="outline" className="border-primary/30 text-primary hover:bg-primary/10">
                    {isPopulating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ChevronRight className="w-4 h-4 mr-2" />}
                    Add to Existing
                  </Button>
                  <Button onClick={() => handlePopulate(true)} disabled={isPopulating} className="bg-primary text-primary-foreground">
                    {isPopulating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                    Replace & Populate
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
