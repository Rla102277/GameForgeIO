import { useParams, Link } from "wouter";
import { useGetProject, useGetProjectStats } from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppStore } from "@/lib/store";
import OntologyTab from "@/components/ontology-tab";
import RulesTab from "@/components/rules-tab";
import SimulatorTab from "@/components/simulator-tab";
import AssetsTab from "@/components/assets-tab";
import ExportTab from "@/components/export-tab";

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
    return <div className="min-h-screen flex items-center justify-center text-white">Loading project...</div>;
  }

  if (!project) {
    return <div className="min-h-screen flex items-center justify-center text-red-500">Project not found</div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-muted-foreground hover:text-white transition-colors">
            ← Dashboard
          </Link>
          <div className="h-6 w-px bg-border mx-2"></div>
          <div>
            <h1 className="text-xl font-bold text-white leading-tight">{project.name}</h1>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
              {project.genre && <span>{project.genre}</span>}
              {stats && (
                <>
                  <span className="flex items-center gap-1"><span className="text-blue-400">{stats.entityCount}</span> Entities</span>
                  <span className="flex items-center gap-1"><span className="text-amber-400">{stats.ruleCount}</span> Rules</span>
                  <span className="flex items-center gap-1"><span className="text-purple-400">{stats.assetCount}</span> Assets</span>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="px-6 pt-4 border-b border-border bg-background shrink-0">
            <TabsList className="bg-card border border-border">
              <TabsTrigger value="ontology">Ontology</TabsTrigger>
              <TabsTrigger value="rules">Rules Sandbox</TabsTrigger>
              <TabsTrigger value="simulator">Simulator</TabsTrigger>
              <TabsTrigger value="assets">Assets</TabsTrigger>
              <TabsTrigger value="export">Export</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <TabsContent value="ontology" className="h-full m-0 data-[state=active]:flex flex-col outline-none">
              <OntologyTab projectId={projectId} />
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

            <TabsContent value="export" className="h-full m-0 data-[state=active]:flex flex-col outline-none">
              <ExportTab projectId={projectId} />
            </TabsContent>
          </div>
        </Tabs>
      </main>
    </div>
  );
}
