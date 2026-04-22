import { useExportRulebook, useExportTabletopSimulator } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Download, FileText, Box } from "lucide-react";

export default function ExportTab({ projectId }: { projectId: number }) {
  const { data: rulebook, isLoading: isLoadingRulebook } = useExportRulebook(projectId, { query: { enabled: !!projectId } });
  const { data: ttsExport, isLoading: isLoadingTTS } = useExportTabletopSimulator(projectId, { query: { enabled: !!projectId } });

  const handleDownloadRulebook = () => {
    if (!rulebook) return;
    const blob = new Blob([rulebook.markdown], { type: 'text/markdown' });
    const url = URL.createUrlObject(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${rulebook.title.toLowerCase().replace(/\s+/g, '-')}-rulebook.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadTTS = () => {
    if (!ttsExport) return;
    const blob = new Blob([JSON.stringify(ttsExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
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
              <Button onClick={handleDownloadRulebook} disabled={isLoadingRulebook || !rulebook} variant="secondary" className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30">
                <Download className="w-4 h-4 mr-2" /> Download .md
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden relative">
            {isLoadingRulebook ? (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">Generating rulebook...</div>
            ) : rulebook ? (
              <div className="h-full overflow-y-auto p-6 bg-muted/5 font-mono text-xs text-muted-foreground whitespace-pre-wrap custom-scrollbar">
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
              <Button onClick={handleDownloadTTS} disabled={isLoadingTTS || !ttsExport} variant="secondary" className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30">
                <Download className="w-4 h-4 mr-2" /> Download .json
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden relative">
            {isLoadingTTS ? (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">Compiling TTS objects...</div>
            ) : ttsExport ? (
              <div className="h-full overflow-y-auto p-6 bg-muted/5 font-mono text-xs text-muted-foreground whitespace-pre-wrap custom-scrollbar">
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
