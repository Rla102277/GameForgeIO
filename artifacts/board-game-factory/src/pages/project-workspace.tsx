import { useState, useCallback, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
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
import BalanceTab from "@/components/balance-tab";
import NotesTab from "@/components/notes-tab";
import StoryboardTab from "@/components/storyboard-tab";
import { Search, X, LogOut, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useUser, useClerk } from "@clerk/react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

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
  { id: "notes", label: "Notes" },
  { id: "storyboard", label: "Storyboard" },
  { id: "balance", label: "Balance" },
  { id: "export", label: "Export" },
];

type SearchResult = { type: string; name: string; description?: string; tab: string };

function WorkspaceUserMenu() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();

  const initials = (user?.fullName || user?.primaryEmailAddress?.emailAddress || "U")
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s: string) => s[0].toUpperCase())
    .join("");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="flex items-center gap-1.5 h-8 px-2 text-slate-400 hover:text-white hover:bg-slate-800">
          <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white">
            {initials}
          </div>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-slate-900 border-slate-800 text-slate-200">
        {user?.primaryEmailAddress && (
          <>
            <div className="px-3 py-2">
              <p className="text-xs text-white font-medium truncate">{user.fullName || user.primaryEmailAddress.emailAddress}</p>
              {user.fullName && <p className="text-[11px] text-slate-500 truncate">{user.primaryEmailAddress.emailAddress}</p>}
            </div>
            <DropdownMenuSeparator className="bg-slate-800" />
          </>
        )}
        <DropdownMenuItem
          className="gap-2 text-red-400 focus:text-red-300 focus:bg-red-500/10 cursor-pointer"
          onClick={() => signOut(() => setLocation("/"))}
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function GlobalSearch({ projectId, onClose, onNavigate }: { projectId: number; onClose: () => void; onNavigate: (tab: string) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const BASE = `${window.location.origin}/api`;

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    const lower = q.toLowerCase();
    try {
      const [entitiesRes, rulesRes, playersRes] = await Promise.all([
        fetch(`${BASE}/projects/${projectId}/entities`),
        fetch(`${BASE}/projects/${projectId}/rules`),
        fetch(`${BASE}/projects/${projectId}/players`),
      ]);
      const [entities, rules, players] = await Promise.all([
        entitiesRes.ok ? entitiesRes.json() : [],
        rulesRes.ok ? rulesRes.json() : [],
        playersRes.ok ? playersRes.json() : [],
      ]);
      const hits: SearchResult[] = [];
      for (const e of entities) {
        if (e.name?.toLowerCase().includes(lower) || e.description?.toLowerCase().includes(lower))
          hits.push({ type: e.type ?? "Entity", name: e.name, description: e.description, tab: "ontology" });
      }
      for (const r of rules) {
        if (r.title?.toLowerCase().includes(lower) || r.content?.toLowerCase().includes(lower))
          hits.push({ type: "Rule", name: r.title, description: r.content?.slice(0, 120), tab: "rules" });
      }
      for (const p of players) {
        if (p.name?.toLowerCase().includes(lower) || p.description?.toLowerCase().includes(lower))
          hits.push({ type: "Player", name: p.name, description: p.description, tab: "players" });
      }
      setResults(hits.slice(0, 12));
    } finally {
      setLoading(false);
    }
  }, [projectId, BASE]);

  useEffect(() => {
    const t = setTimeout(() => search(query), 200);
    return () => clearTimeout(t);
  }, [query, search]);

  const TYPE_COLOR: Record<string, string> = {
    Item: "bg-blue-500/20 text-blue-400",
    Faction: "bg-purple-500/20 text-purple-400",
    Location: "bg-green-500/20 text-green-400",
    Event: "bg-amber-500/20 text-amber-400",
    Rule: "bg-red-500/20 text-red-400",
    Player: "bg-cyan-500/20 text-cyan-400",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4" onClick={onClose}>
      <div className="w-full max-w-xl" onClick={e => e.stopPropagation()}>
        <div className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <Input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search entities, rules, players..."
              className="border-0 bg-transparent shadow-none focus-visible:ring-0 text-white placeholder:text-muted-foreground/60 h-auto py-0"
            />
            <button onClick={onClose} className="text-muted-foreground hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          {query.length >= 2 && (
            <div className="max-h-80 overflow-y-auto">
              {loading && (
                <div className="py-6 text-center text-sm text-muted-foreground">Searching...</div>
              )}
              {!loading && results.length === 0 && (
                <div className="py-6 text-center text-sm text-muted-foreground">No results for "{query}"</div>
              )}
              {!loading && results.map((r, i) => (
                <button key={i} className="w-full flex items-start gap-3 px-4 py-3 hover:bg-muted/10 text-left border-b border-border/50 last:border-0"
                  onClick={() => { onNavigate(r.tab); onClose(); }}>
                  <Badge variant="outline" className={`text-[10px] h-5 px-1.5 shrink-0 mt-0.5 ${TYPE_COLOR[r.type] ?? "bg-muted text-muted-foreground"}`}>
                    {r.type}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{r.name}</p>
                    {r.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{r.description}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground/50 shrink-0 capitalize">{r.tab}</span>
                </button>
              ))}
            </div>
          )}
          {query.length < 2 && (
            <div className="px-4 py-3 text-xs text-muted-foreground/60">Type at least 2 characters to search</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProjectWorkspace() {
  const params = useParams();
  const projectId = parseInt(params.id || "0", 10);
  const { activeTab, setActiveTab } = useAppStore();
  const [searchOpen, setSearchOpen] = useState(false);

  const { data: project, isLoading } = useGetProject(projectId, {
    query: { enabled: !!projectId }
  });

  const { data: stats } = useGetProjectStats(projectId, {
    query: { enabled: !!projectId }
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setSearchOpen(true); }
      if (e.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

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
      {searchOpen && (
        <GlobalSearch
          projectId={projectId}
          onClose={() => setSearchOpen(false)}
          onNavigate={(tab) => { setActiveTab(tab); setSearchOpen(false); }}
        />
      )}

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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-muted/20 hover:bg-muted/30 border border-border rounded-lg text-muted-foreground hover:text-white text-xs transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search</span>
            <kbd className="ml-1 text-[10px] bg-muted/30 px-1 rounded font-mono">⌘K</kbd>
          </button>
          <WorkspaceUserMenu />
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

            <TabsContent value="notes" className="m-0 outline-none">
              <NotesTab projectId={projectId} />
            </TabsContent>

            <TabsContent value="storyboard" className="h-full m-0 data-[state=active]:flex flex-col outline-none">
              <StoryboardTab projectId={projectId} />
            </TabsContent>

            <TabsContent value="balance" className="m-0 outline-none">
              <BalanceTab projectId={projectId} />
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
