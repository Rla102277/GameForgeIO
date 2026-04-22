import { useParams, Link } from "wouter";
import { useGetProject, useGetProjectStats } from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppStore } from "@/lib/store";
import OverviewTab from "@/components/overview-tab";
import OntologyTab from "@/components/ontology-tab";
import RulesTab from "@/components/rules-tab";
import SimulatorTab from "@/components/simulator-tab";
import AssetsTab from "@/components/assets-tab";
import ExportTab from "@/components/export-tab";
import PlayersTab from "@/components/players-tab";
import CollaborationTab from "@/components/collaboration-tab";
import PlaytestTab from "@/components/playtest-tab";
import ResearchTab from "@/components/research-tab";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "research", label: "Research" },
  { id: "ontology", label: "Ontology" },
  { id: "players", label: "Players" },
  { id: "rules", label: "Rules Sandbox" },
  { id: "simulator", label: "Simulator" },
  { id: "assets", label: "Assets" },
  { id: "playtest", label: "Playtesting" },
  { id: "tasks", label: "Tasks" },
  { id: "export", label: "Export" },
];

export default function ProjectWorkspace() {
  const params = useParams();
  const projectId = parseInt(params.id || "0", 10);
  const { activeTab, setActiveTab } = useAppStore();

  const { data: project, isLoading } = useGetProject(projectId, {
    query: { enabled: !!projectId }
  });

  const { data: stats } = useGetProjectStats(projectId, {
    query: { enabled: !!projectId }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">Loading project...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return <div className="min-h-screen flex items-center justify-center text-red-400">Project not found</div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm px-6 py-3 flex items-center justify-between shrink-0 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-muted-foreground hover:text-white transition-colors text-sm font-medium">
            ← Dashboard
          </Link>
          <div className="h-5 w-px bg-border" />
          <div>
            <h1 className="text-lg font-bold text-white leading-tight">{project.name}</h1>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
              {project.genre && <span className="text-primary/80 font-medium">{project.genre}</span>}
              {stats && (
                <>
                  <span><span className="text-blue-400 font-semibold">{stats.entityCount}</span> entities</span>
                  <span><span className="text-amber-400 font-semibold">{stats.ruleCount}</span> rules</span>
                  <span><span className="text-purple-400 font-semibold">{stats.assetCount}</span> assets</span>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="px-4 pt-0 border-b border-border bg-background shrink-0 overflow-x-auto">
            <TabsList className="bg-transparent border-0 p-0 gap-0 h-auto flex w-max">
              {TABS.map(tab => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-white text-muted-foreground hover:text-white/80 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <TabsContent value="overview" className="m-0 outline-none">
              <OverviewTab projectId={projectId} />
            </TabsContent>

            <TabsContent value="research" className="h-full m-0 data-[state=active]:flex flex-col outline-none">
              <ResearchTab projectId={projectId} />
            </TabsContent>

            <TabsContent value="ontology" className="h-full m-0 data-[state=active]:flex flex-col outline-none">
              <OntologyTab projectId={projectId} />
            </TabsContent>

            <TabsContent value="players" className="m-0 outline-none">
              <PlayersTab projectId={projectId} />
            </TabsContent>

            <TabsContent value="rules" className="h-full m-0 data-[state=active]:flex flex-col outline-none">
              <RulesTab projectId={projectId} />
            </TabsContent>

            <TabsContent value="simulator" className="h-full m-0 data-[state=active]:flex flex-col outline-none">
              <SimulatorTab projectId={projectId} />
            </TabsContent>

            <TabsContent value="assets" className="h-full m-0 data-[state=active]:flex flex-col outline-none">
              <AssetsTab projectId={projectId} />
            </TabsContent>

            <TabsContent value="playtest" className="m-0 outline-none">
              <PlaytestTab projectId={projectId} />
            </TabsContent>

            <TabsContent value="tasks" className="h-full m-0 data-[state=active]:flex flex-col outline-none">
              <CollaborationTab projectId={projectId} />
            </TabsContent>

            <TabsContent value="export" className="m-0 outline-none">
              <ExportTab projectId={projectId} />
            </TabsContent>
          </div>
        </Tabs>
      </main>
    </div>
  );
}
