import { useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getListEntitiesQueryKey, getListRulesQueryKey, useGetProject, useUpdateProject } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Upload, Link2, Trash2, Sparkles, FileText, Globe, CheckCircle,
  Loader2, ChevronRight, Users, Layers, BookOpen, Wand2, Check,
  Printer, FlaskConical, ArrowRight,
} from "lucide-react";

type ProjectFile = { id: number; filename: string; fileType: string; sourceUrl?: string; extractedText?: string; createdAt: string };
type Blueprint = {
  overview?: { summary?: string; theme?: string; mechanics?: string[]; playerCount?: string; duration?: string; complexity?: string };
  entities?: { name: string; type: string; description: string }[];
  rules?: { title: string; content: string; category: string }[];
  players?: { name: string }[];
};

const ENHANCE_ACTIONS = [
  { id: "shorter", label: "Shorter", icon: "↑" },
  { id: "longer", label: "Longer", icon: "↓" },
  { id: "rephrase", label: "Rephrase", icon: "↺" },
  { id: "vivid", label: "More Vivid", icon: "✦" },
  { id: "punchy", label: "Punchy", icon: "⚡" },
  { id: "formal", label: "Formal", icon: "◈" },
] as const;

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
  const [isEnhancing, setIsEnhancing] = useState<string | null>(null);
  const [enhancedPreview, setEnhancedPreview] = useState<string | null>(null);
  const [researchItemCount, setResearchItemCount] = useState(0);
  const [analyzeSource, setAnalyzeSource] = useState<"files" | "research">("files");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const BASE = `${window.location.origin}/api`;

  const loadFiles = useCallback(async () => {
    const [filesRes, researchRes] = await Promise.all([
      fetch(`${BASE}/projects/${projectId}/files`),
      fetch(`${BASE}/projects/${projectId}/research-items`),
    ]);
    if (filesRes.ok) setFiles(await filesRes.json());
    if (researchRes.ok) {
      const items = await researchRes.json();
      setResearchItemCount(items.length);
    }
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

  const runStreamingAnalyze = async (endpoint: string) => {
    setIsAnalyzing(true);
    setAnalyzeStream("");
    setBlueprint(null);
    setPopulateResult(null);
    let fullText = "";
    try {
      const res = await fetch(`${BASE}/projects/${projectId}/${endpoint}`, { method: "POST" });
      if (!res.body) throw new Error("No response body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.content) { fullText += data.content; setAnalyzeStream(fullText); }
            if (data.done && data.raw) {
              const match = data.raw.match(/\{[\s\S]*\}/);
              if (match) { try { setBlueprint(JSON.parse(match[0])); } catch { /* ignore */ } }
            }
            if (data.error) console.error("Analysis error:", data.error);
          } catch { /* ignore */ }
        }
      }
      if (!blueprint) {
        const match = fullText.match(/\{[\s\S]*\}/);
        if (match) { try { setBlueprint(JSON.parse(match[0])); } catch { /* ignore */ } }
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnalyze = () => {
    if (analyzeSource === "research") {
      runStreamingAnalyze("analyze-and-build-with-research");
    } else {
      runStreamingAnalyze("analyze-and-build");
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

  const handleDescriptionEnhance = async (action: string) => {
    setIsEnhancing(action);
    setEnhancedPreview(null);
    try {
      const res = await fetch(`${BASE}/projects/${projectId}/description/ai-enhance`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, currentDescription: descriptionDraft || project?.description || "" }),
      });
      if (res.ok) {
        const { description } = await res.json();
        setEnhancedPreview(description);
      }
    } finally {
      setIsEnhancing(null);
    }
  };

  const handleAcceptEnhanced = () => {
    if (!enhancedPreview) return;
    setDescriptionDraft(enhancedPreview);
    setEnhancedPreview(null);
  };

  const handleSaveDescription = () => {
    updateProject.mutate({ id: projectId, data: { description: descriptionDraft } });
    setEditDescription(false);
    setEnhancedPreview(null);
  };

  const handleOpenRulebook = () => {
    window.open(`${BASE}/projects/${projectId}/rulebook-print`, "_blank");
  };

  return (
    <div className="flex flex-col gap-5 max-w-5xl mx-auto pb-20">

      {/* ── Game Overview ── */}
      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border py-4 px-5 flex-row items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          <CardTitle className="text-white text-base font-semibold flex-1">Game Overview</CardTitle>
          <Button
            variant="ghost" size="sm"
            className="h-7 text-xs text-muted-foreground hover:text-white gap-1.5"
            onClick={handleOpenRulebook}
          >
            <Printer className="w-3.5 h-3.5" /> Print Rulebook
          </Button>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground text-xs uppercase tracking-wider">Title</span>
              <p className="text-white font-medium mt-1">{project?.name}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs uppercase tracking-wider">Genre</span>
              <p className="text-white font-medium mt-1">{project?.genre || "Not set"}</p>
            </div>
            {project?.playerCount && <div><span className="text-muted-foreground text-xs uppercase tracking-wider">Players</span><p className="text-white font-medium mt-1">{project.playerCount}</p></div>}
            {project?.targetDuration && <div><span className="text-muted-foreground text-xs uppercase tracking-wider">Duration</span><p className="text-white font-medium mt-1">{project.targetDuration}</p></div>}
          </div>

          {/* Description with AI enhance */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Description</Label>
              <Button
                variant="ghost" size="sm"
                className="h-6 text-xs text-muted-foreground"
                onClick={() => { setEditDescription(!editDescription); setDescriptionDraft(project?.description || ""); setEnhancedPreview(null); }}
              >
                {editDescription ? "Cancel" : "Edit"}
              </Button>
            </div>

            {editDescription ? (
              <div className="space-y-3">
                <Textarea
                  value={descriptionDraft}
                  onChange={e => setDescriptionDraft(e.target.value)}
                  className="bg-input min-h-[80px] text-sm"
                  placeholder="Describe your game..."
                />

                {/* AI enhance toolbar */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <Wand2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground mr-1">AI:</span>
                  {ENHANCE_ACTIONS.map(action => (
                    <Button
                      key={action.id}
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-xs border-border text-muted-foreground hover:text-primary hover:border-primary/40"
                      disabled={isEnhancing !== null}
                      onClick={() => handleDescriptionEnhance(action.id)}
                    >
                      {isEnhancing === action.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <span>{action.icon}</span>}
                      <span className="ml-1">{action.label}</span>
                    </Button>
                  ))}
                </div>

                {/* Enhanced preview */}
                {enhancedPreview && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                      <Sparkles className="w-3.5 h-3.5" /> AI Suggestion
                    </div>
                    <p className="text-sm text-white leading-relaxed">{enhancedPreview}</p>
                    <div className="flex gap-2">
                      <Button size="sm" className="h-7 text-xs bg-primary text-primary-foreground" onClick={handleAcceptEnhanced}>
                        <Check className="w-3 h-3 mr-1" /> Use This
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => setEnhancedPreview(null)}>
                        Dismiss
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveDescription} className="bg-primary text-primary-foreground">Save Description</Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground leading-relaxed">{project?.description || "No description yet. Click Edit to add one."}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Reference Materials ── */}
      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border py-4 px-5 flex-row items-center gap-2">
          <Upload className="w-4 h-4 text-primary" />
          <div className="flex-1">
            <CardTitle className="text-white text-base font-semibold">Reference Materials</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Upload files or fetch URLs as source material for the AI architect</p>
          </div>
          {researchItemCount > 0 && (
            <Badge variant="outline" className="text-violet-400 border-violet-500/30 bg-violet-500/10 text-xs">
              <FlaskConical className="w-3 h-3 mr-1" />
              {researchItemCount} research items
            </Badge>
          )}
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <div
            className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file && fileInputRef.current) {
                const dt = new DataTransfer(); dt.items.add(file);
                fileInputRef.current.files = dt.files;
                fileInputRef.current.dispatchEvent(new Event("change", { bubbles: true }));
              }
            }}
          >
            <Upload className="w-7 h-7 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Drag & drop or click to upload PDF, TXT, or any text file</p>
            <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.txt,.md,.json,.csv" onChange={handleFileUpload} />
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Globe className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleUrlFetch()}
                placeholder="https://... fetch a rulebook or reference page"
                className="pl-9 bg-input text-sm"
              />
            </div>
            <Button onClick={handleUrlFetch} disabled={isUploadingUrl || !urlInput.trim()} variant="outline" size="sm">
              {isUploadingUrl ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              Fetch
            </Button>
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              {files.map(file => (
                <div key={file.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border border-border">
                  {file.fileType === "text/url"
                    ? <Globe className="w-4 h-4 text-blue-400 shrink-0" />
                    : <FileText className="w-4 h-4 text-green-400 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{file.filename}</p>
                    <p className="text-xs text-muted-foreground">{file.extractedText ? `${file.extractedText.length.toLocaleString()} chars` : "No text"}</p>
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

      {/* ── AI Game Architect ── */}
      <Card className="bg-card border-border border-primary/20">
        <CardHeader className="border-b border-border py-4 px-5 flex-row items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <div className="flex-1">
            <CardTitle className="text-white text-base font-semibold">AI Game Architect</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Generate a complete game blueprint from your materials</p>
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          {/* Source selector */}
          <div className="flex gap-2 p-1 bg-muted/20 border border-border rounded-lg w-fit">
            <button
              onClick={() => setAnalyzeSource("files")}
              className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${analyzeSource === "files" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-white"}`}
            >
              <Upload className="w-3.5 h-3.5 inline mr-1.5" />
              From Files ({files.length})
            </button>
            <button
              onClick={() => setAnalyzeSource("research")}
              className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${analyzeSource === "research" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-white"}`}
            >
              <FlaskConical className="w-3.5 h-3.5 inline mr-1.5" />
              From Research ({researchItemCount})
            </button>
          </div>

          {analyzeSource === "research" && researchItemCount === 0 && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
              <FlaskConical className="w-4 h-4 shrink-0" />
              No research items yet. Go to the Research tab to fetch rulebooks and gather material, then come back here.
              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            </div>
          )}

          <Button
            onClick={handleAnalyze}
            disabled={isAnalyzing || (analyzeSource === "research" && researchItemCount === 0)}
            className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            {isAnalyzing
              ? <><Loader2 className="w-5 h-5 animate-spin mr-2" />Generating Blueprint...</>
              : <><Sparkles className="w-5 h-5 mr-2" />Generate Complete Blueprint from {analyzeSource === "research" ? "Research" : "Files"}</>}
          </Button>

          {isAnalyzing && analyzeStream && (
            <div className="bg-muted/20 rounded-lg p-4 border border-border max-h-48 overflow-y-auto">
              <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap">{analyzeStream.slice(-2000)}</pre>
            </div>
          )}

          {blueprint && (
            <div className="space-y-4">
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                  <CheckCircle className="w-4 h-4" /> Blueprint Generated
                </div>

                {blueprint.overview?.summary && (
                  <p className="text-sm text-white leading-relaxed">{blueprint.overview.summary}</p>
                )}

                {blueprint.overview?.mechanics && (
                  <div className="flex flex-wrap gap-1.5">
                    {blueprint.overview.mechanics.map(m => <Badge key={m} variant="outline" className="text-xs">{m}</Badge>)}
                    {blueprint.overview.playerCount && <Badge variant="outline" className="text-xs text-muted-foreground">{blueprint.overview.playerCount}</Badge>}
                    {blueprint.overview.duration && <Badge variant="outline" className="text-xs text-muted-foreground">{blueprint.overview.duration}</Badge>}
                    {blueprint.overview.complexity && <Badge variant="outline" className="text-xs text-muted-foreground">{blueprint.overview.complexity}</Badge>}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { icon: Layers, val: blueprint.entities?.length, label: "Entities", color: "blue" },
                    { icon: BookOpen, val: blueprint.rules?.length, label: "Rules", color: "amber" },
                    { icon: Users, val: blueprint.players?.length, label: "Player Types", color: "purple" },
                  ].map(({ icon: Icon, val, label, color }) => (
                    <div key={label} className={`bg-${color}-500/10 border border-${color}-500/20 rounded-lg p-3 text-center`}>
                      <Icon className={`w-4 h-4 text-${color}-400 mx-auto mb-1`} />
                      <div className={`text-xl font-bold text-${color}-400`}>{val ?? 0}</div>
                      <div className="text-xs text-muted-foreground">{label}</div>
                    </div>
                  ))}
                </div>

                {blueprint.entities && blueprint.entities.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2">Entities Preview</p>
                    <div className="flex flex-wrap gap-1.5">
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
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span className="text-sm font-medium">
                    Added {populateResult.entities} entities, {populateResult.rules} rules, {populateResult.players} player types.
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
