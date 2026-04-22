import { useState } from "react";
import { useExportRulebook, useExportTabletopSimulator, useGetProject } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Download, FileText, Box, BookOpen, Copy, Check, ExternalLink } from "lucide-react";

export default function ExportTab({ projectId }: { projectId: number }) {
  const { data: rulebook, isLoading: isLoadingRulebook } = useExportRulebook(projectId, { query: { enabled: !!projectId } });
  const { data: ttsExport, isLoading: isLoadingTTS } = useExportTabletopSimulator(projectId, { query: { enabled: !!projectId } });
  const { data: project } = useGetProject(projectId, { query: { enabled: !!projectId } });

  const [copied, setCopied] = useState(false);

  const notebookLMUrl = `${window.location.origin}/api/projects/${projectId}/notebooklm`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(notebookLMUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const el = document.createElement("textarea");
      el.value = notebookLMUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleOpenNotebookLM = () => {
    window.open("https://notebooklm.google.com/", "_blank", "noopener");
  };

  const handleDownloadRulebook = () => {
    if (!rulebook) return;
    const title = (project as { name?: string } | undefined)?.name ?? "game";
    const blob = new Blob([rulebook.markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, "-")}-rulebook.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadTTS = () => {
    if (!ttsExport) return;
    const blob = new Blob([JSON.stringify(ttsExport, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tts-export-${projectId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Export & Distribution</h2>
        <p className="text-muted-foreground text-sm">Take your game design out of the factory and onto the table.</p>
      </div>

      {/* NotebookLM Source Link */}
      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border bg-muted/10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-white">
                <BookOpen className="w-5 h-5 text-violet-400" />
                NotebookLM Source
              </CardTitle>
              <CardDescription className="mt-1">
                A public URL that packages your full game design — entities, rules, and player archetypes — as a readable document. Paste it directly into NotebookLM as a source.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 bg-muted/20 border border-border rounded-md px-3 py-2 font-mono text-xs text-muted-foreground truncate">
              {notebookLMUrl}
            </div>
            <Button
              onClick={handleCopyLink}
              variant="outline"
              size="sm"
              className={`shrink-0 transition-colors ${copied ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10" : "border-violet-500/30 text-violet-400 hover:bg-violet-500/10"}`}
            >
              {copied ? <><Check className="w-4 h-4 mr-1.5" />Copied!</> : <><Copy className="w-4 h-4 mr-1.5" />Copy Link</>}
            </Button>
            <Button
              onClick={handleOpenNotebookLM}
              variant="outline"
              size="sm"
              className="shrink-0 border-border text-muted-foreground hover:text-white"
            >
              <ExternalLink className="w-4 h-4 mr-1.5" />
              Open NotebookLM
            </Button>
          </div>

          <div className="bg-muted/10 border border-border rounded-md p-4 space-y-1.5">
            <p className="text-xs font-medium text-white">How to use:</p>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Click <span className="text-violet-400 font-medium">Copy Link</span> to copy the source URL above</li>
              <li>Click <span className="text-white font-medium">Open NotebookLM</span> to go to NotebookLM</li>
              <li>Create a new notebook, then click <span className="text-white font-medium">+ Add Source</span></li>
              <li>Choose <span className="text-white font-medium">Website</span> and paste the link — NotebookLM will ingest all entities, rules, and archetypes</li>
            </ol>
          </div>

          <a
            href={notebookLMUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 hover:underline"
          >
            Preview the document <ExternalLink className="w-3 h-3" />
          </a>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-card border-border flex flex-col h-[500px]">
          <CardHeader className="border-b border-border bg-muted/10">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-white">
                  <FileText className="w-5 h-5 text-blue-400" />
                  Rulebook Export
                </CardTitle>
                <CardDescription className="mt-1">Compiled markdown of all rules and entities.</CardDescription>
              </div>
              <Button onClick={handleDownloadRulebook} disabled={isLoadingRulebook || !rulebook} variant="secondary" className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 shrink-0">
                <Download className="w-4 h-4 mr-2" /> Download .md
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden relative">
            {isLoadingRulebook ? (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">Generating rulebook...</div>
            ) : rulebook ? (
              <div className="h-full overflow-y-auto p-6 bg-muted/5 font-mono text-xs text-muted-foreground whitespace-pre-wrap">
                {rulebook.markdown}
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">Failed to load rulebook</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border flex flex-col h-[500px]">
          <CardHeader className="border-b border-border bg-muted/10">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Box className="w-5 h-5 text-emerald-400" />
                  Tabletop Simulator
                </CardTitle>
                <CardDescription className="mt-1">JSON object state for TTS modding.</CardDescription>
              </div>
              <Button onClick={handleDownloadTTS} disabled={isLoadingTTS || !ttsExport} variant="secondary" className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 shrink-0">
                <Download className="w-4 h-4 mr-2" /> Download .json
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden relative">
            {isLoadingTTS ? (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">Compiling TTS objects...</div>
            ) : ttsExport ? (
              <div className="h-full overflow-y-auto p-6 bg-muted/5 font-mono text-xs text-muted-foreground whitespace-pre-wrap">
                {JSON.stringify(ttsExport, null, 2)}
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">No assets available for TTS export</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
