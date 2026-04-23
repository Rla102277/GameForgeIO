import { useState, useRef } from "react";
import { useListSimulations, useRunSimulation } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Area, ComposedChart } from 'recharts';
import { Play, Activity, Wand2, Loader2, BarChart2 } from "lucide-react";

export default function SimulatorTab({ projectId }: { projectId: number }) {
  const { data: simulations, refetch } = useListSimulations(projectId, { query: { enabled: !!projectId } });
  const runSim = useRunSimulation();
  const BASE = `${window.location.origin}/api`;

  const [mode, setMode] = useState<"economy" | "playthrough">("economy");
  const [config, setConfig] = useState({
    iterations: 500,
    turns: 20,
    startingGold: 10,
    goldPerTurn: 5,
    goldSpendPerTurn: 4,
    incomeVariance: 0.2,
    spendVariance: 0.3,
    label: "Base Economy Test"
  });
  const [activeSimId, setActiveSimId] = useState<number | null>(null);

  // AI Playthrough state
  const [playthroughTurns, setPlaythroughTurns] = useState(5);
  const [isPlaythrough, setIsPlaythrough] = useState(false);
  const [playthroughText, setPlaythroughText] = useState("");
  const playthroughRef = useRef<HTMLDivElement>(null);

  const handleRun = () => {
    runSim.mutate({ projectId, data: config }, {
      onSuccess: (data) => { refetch(); setActiveSimId(data.id); }
    });
  };

  const handlePlaythrough = async () => {
    setIsPlaythrough(true);
    setPlaythroughText("");
    try {
      const res = await fetch(`${BASE}/projects/${projectId}/simulate-playthrough`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turns: playthroughTurns }),
      });
      if (!res.body) throw new Error("No body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.content) {
              text += data.content;
              setPlaythroughText(text);
              setTimeout(() => playthroughRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
            }
          } catch { /* ignore */ }
        }
      }
    } finally {
      setIsPlaythrough(false);
    }
  };

  const activeSim = simulations?.find(s => s.id === activeSimId) || simulations?.[0];

  const getHealthColor = (score: number) => {
    if (score >= 70) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    if (score >= 40) return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    return "bg-red-500/20 text-red-400 border-red-500/30";
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Mode Toggle */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => setMode("economy")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${mode === "economy" ? "bg-primary/20 text-primary border border-primary/30" : "text-muted-foreground hover:text-white border border-transparent"}`}
        >
          <BarChart2 className="w-3.5 h-3.5" /> Economy Simulator
        </button>
        <button
          onClick={() => setMode("playthrough")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${mode === "playthrough" ? "bg-primary/20 text-primary border border-primary/30" : "text-muted-foreground hover:text-white border border-transparent"}`}
        >
          <Wand2 className="w-3.5 h-3.5" /> AI Playthrough
        </button>
      </div>

      <div className="flex flex-1 gap-6 min-h-0">
        {/* Left Panel */}
        <div className="w-[300px] flex flex-col gap-4 shrink-0 overflow-y-auto pr-2 pb-10">
          <h2 className="text-xl font-bold text-white">
            {mode === "economy" ? "Simulator Config" : "Playthrough Config"}
          </h2>

          {mode === "economy" ? (
            <Card className="bg-card border-border">
              <CardContent className="p-4 space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs">Simulation Label</Label>
                  <Input value={config.label} onChange={e => setConfig({...config, label: e.target.value})} className="h-8 text-sm" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-xs">Turns</Label>
                    <span className="text-xs text-muted-foreground">{config.turns}</span>
                  </div>
                  <Slider value={[config.turns]} max={100} step={1} onValueChange={v => setConfig({...config, turns: v[0]})} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-xs">Iterations</Label>
                    <span className="text-xs text-muted-foreground">{config.iterations}</span>
                  </div>
                  <Slider value={[config.iterations]} max={5000} step={100} onValueChange={v => setConfig({...config, iterations: v[0]})} />
                </div>
                <div className="h-px bg-border my-4" />
                <div className="space-y-2">
                  <Label className="text-xs">Starting Gold</Label>
                  <Input type="number" value={config.startingGold} onChange={e => setConfig({...config, startingGold: parseInt(e.target.value) || 0})} className="h-8" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Gold Per Turn (Income)</Label>
                  <Input type="number" value={config.goldPerTurn} onChange={e => setConfig({...config, goldPerTurn: parseInt(e.target.value) || 0})} className="h-8" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Gold Spend Per Turn</Label>
                  <Input type="number" value={config.goldSpendPerTurn} onChange={e => setConfig({...config, goldSpendPerTurn: parseInt(e.target.value) || 0})} className="h-8" />
                </div>
                <div className="h-px bg-border my-4" />
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-xs">Income Variance</Label>
                    <span className="text-xs text-muted-foreground">{(config.incomeVariance * 100).toFixed(0)}%</span>
                  </div>
                  <Slider value={[config.incomeVariance]} max={1} step={0.05} onValueChange={v => setConfig({...config, incomeVariance: v[0]})} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-xs">Spend Variance</Label>
                    <span className="text-xs text-muted-foreground">{(config.spendVariance * 100).toFixed(0)}%</span>
                  </div>
                  <Slider value={[config.spendVariance]} max={1} step={0.05} onValueChange={v => setConfig({...config, spendVariance: v[0]})} />
                </div>
                <Button className="w-full mt-4" onClick={handleRun} disabled={runSim.isPending}>
                  <Play className="w-4 h-4 mr-2" />
                  {runSim.isPending ? "Running..." : "Run Simulation"}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-card border-border">
              <CardContent className="p-4 space-y-5">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs">Number of Turns</Label>
                    <span className="text-xs text-muted-foreground font-mono">{playthroughTurns}</span>
                  </div>
                  <Slider value={[playthroughTurns]} min={2} max={8} step={1} onValueChange={v => setPlaythroughTurns(v[0])} />
                  <p className="text-xs text-muted-foreground">AI will simulate {playthroughTurns} full turns using your game's entities, rules, and player archetypes.</p>
                </div>
                <Button className="w-full" onClick={handlePlaythrough} disabled={isPlaythrough}>
                  {isPlaythrough
                    ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Simulating...</>
                    : <><Wand2 className="w-4 h-4 mr-2" />Start AI Playthrough</>}
                </Button>
                {playthroughText && (
                  <Button variant="outline" size="sm" className="w-full border-border text-muted-foreground" onClick={() => setPlaythroughText("")}>
                    Clear
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {mode === "economy" && simulations && simulations.length > 0 && (
            <div className="space-y-2 mt-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">History</h3>
              {simulations.slice(0, 5).map(sim => (
                <div
                  key={sim.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors text-sm ${activeSimId === sim.id || (activeSim?.id === sim.id) ? 'bg-primary/10 border-primary' : 'bg-card border-border hover:border-primary/50'}`}
                  onClick={() => setActiveSimId(sim.id)}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-white truncate pr-2">{sim.label || `Run #${sim.id}`}</span>
                    <Badge variant="outline" className={`text-[10px] px-1 py-0 ${getHealthColor(sim.economyHealthScore)}`}>
                      {sim.economyHealthScore}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">Mean: {sim.mean.toFixed(1)} gold</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div className="flex-1 flex flex-col min-h-0">
          {mode === "economy" ? (
            activeSim ? (
              <Card className="flex-1 flex flex-col bg-card border-border overflow-hidden">
                <CardHeader className="border-b border-border bg-muted/10 shrink-0 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-xl text-white">{activeSim.label || `Simulation Run #${activeSim.id}`}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">Monte Carlo Projection ({activeSim.config.iterations} iterations)</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Economy Health</p>
                      <p className="text-2xl font-bold font-mono">
                        <span className={activeSim.economyHealthScore >= 70 ? 'text-emerald-400' : activeSim.economyHealthScore >= 40 ? 'text-amber-400' : 'text-red-400'}>
                          {activeSim.economyHealthScore}
                        </span>
                        <span className="text-sm text-muted-foreground ml-1">/100</span>
                      </p>
                    </div>
                    <Activity className={`w-8 h-8 ${activeSim.economyHealthScore >= 70 ? 'text-emerald-400' : activeSim.economyHealthScore >= 40 ? 'text-amber-400' : 'text-red-400'}`} />
                  </div>
                </CardHeader>
                <CardContent className="flex-1 p-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={activeSim.turnData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                      <XAxis dataKey="turn" stroke="#ffffff50" tick={{fill: '#ffffff50'}} />
                      <YAxis stroke="#ffffff50" tick={{fill: '#ffffff50'}} />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                        itemStyle={{ color: '#fff' }}
                        labelStyle={{ color: '#94a3b8' }}
                      />
                      <Area type="monotone" dataKey="p90" stroke="none" fill="#3b82f6" fillOpacity={0.1} />
                      <Area type="monotone" dataKey="p10" stroke="none" fill="#0f172a" fillOpacity={1} />
                      <Line type="monotone" dataKey="p90" stroke="#3b82f650" dot={false} strokeDasharray="5 5" name="90th Percentile" />
                      <Line type="monotone" dataKey="mean" stroke="#3b82f6" strokeWidth={2} dot={false} name="Mean Average" />
                      <Line type="monotone" dataKey="p10" stroke="#3b82f650" dot={false} strokeDasharray="5 5" name="10th Percentile" />
                    </ComposedChart>
                  </ResponsiveContainer>
                  <div className="flex justify-center gap-6 mt-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-2"><div className="w-3 h-0.5 bg-[#3b82f6] border border-[#3b82f6]" /> Mean Gold</span>
                    <span className="flex items-center gap-2"><div className="w-3 h-3 bg-[#3b82f620] border border-[#3b82f650] border-dashed" /> Confidence Interval (P10-P90)</span>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="h-full border border-dashed border-border rounded-xl flex items-center justify-center text-muted-foreground flex-col gap-4 bg-muted/5">
                <Activity className="w-12 h-12 opacity-20" />
                <p>Configure parameters on the left and run a simulation to view economic balance data.</p>
              </div>
            )
          ) : (
            <Card className="flex-1 flex flex-col bg-card border-border overflow-hidden">
              <CardHeader className="border-b border-border bg-muted/10 shrink-0">
                <CardTitle className="text-white flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-primary" />
                  AI Playthrough Narrative
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  The AI simulates a full game session using your entities, rules, and player archetypes.
                </p>
              </CardHeader>
              <div className="flex-1 overflow-y-auto p-6">
                {!playthroughText && !isPlaythrough && (
                  <div className="h-full flex flex-col items-center justify-center text-center gap-4 text-muted-foreground">
                    <Wand2 className="w-12 h-12 opacity-20" />
                    <div>
                      <p className="font-medium text-white">AI Playthrough</p>
                      <p className="text-sm mt-1">Set the number of turns and click "Start AI Playthrough" to watch a full game session unfold.</p>
                    </div>
                  </div>
                )}
                {(playthroughText || isPlaythrough) && (
                  <div className="prose prose-sm prose-invert max-w-none">
                    <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap font-mono">
                      {playthroughText}
                      {isPlaythrough && <span className="animate-pulse text-primary">▊</span>}
                    </div>
                    <div ref={playthroughRef} />
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
