import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Scale, AlertTriangle, CheckCircle, Info, Sparkles, ChevronDown, ChevronUp, ShieldAlert } from "lucide-react";

type StatEntry = { entityName: string; type: string; value: number };
type PropStat = { propName: string; entries: StatEntry[]; min: number; max: number; avg: number; stddev: number; outliers: StatEntry[] };
type BalanceData = { entities: { id: number; name: string; type: string; description?: string }[]; stats: PropStat[]; balanceScore: number | null };
type ComplexityData = { score: number; label: string; breakdown: { factor: string; score: number; max: number; note: string }[] };
type ConflictData = { conflicts: { severity: string; ruleIds: number[]; title: string; description: string; resolution: string }[]; summary: string };

const TYPE_COLOR: Record<string, string> = {
  Item: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Faction: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  Location: "bg-green-500/20 text-green-400 border-green-500/30",
  Event: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: "border-red-500/30 bg-red-500/5 text-red-400",
  warning: "border-amber-500/30 bg-amber-500/5 text-amber-400",
  suggestion: "border-blue-500/30 bg-blue-500/5 text-blue-400",
};

function ScoreRing({ score, label, size = 80 }: { score: number; label: string; size?: number }) {
  const r = size / 2 - 8;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const color = score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1f2937" strokeWidth="6" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${filled} ${circ - filled}`} strokeLinecap="round" />
      </svg>
      <div style={{ marginTop: -(size / 2 + 12), zIndex: 1, position: "relative", textAlign: "center" }}>
        <div className="text-white font-bold text-lg leading-none">{score}</div>
        <div className="text-muted-foreground text-[10px]">/100</div>
      </div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function BarChart({ entries, min, max, avg }: { entries: StatEntry[]; min: number; max: number; avg: number }) {
  const range = max - min || 1;
  return (
    <div className="space-y-1.5">
      {entries.sort((a, b) => b.value - a.value).map((e, i) => {
        const pct = ((e.value - min) / range) * 100;
        const isOutlier = Math.abs(e.value - avg) > 1.5 * (max - min) / 4;
        return (
          <div key={i} className="flex items-center gap-2">
            <div className="w-28 text-xs text-muted-foreground truncate shrink-0">{e.entityName}</div>
            <div className="flex-1 h-4 bg-muted/20 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${isOutlier ? "bg-red-400/70" : "bg-primary/60"}`}
                style={{ width: `${Math.max(pct, 3)}%` }} />
            </div>
            <div className={`text-xs font-mono w-10 text-right shrink-0 ${isOutlier ? "text-red-400" : "text-muted-foreground"}`}>
              {e.value}
            </div>
            <Badge variant="outline" className={`text-[9px] h-4 px-1 shrink-0 ${TYPE_COLOR[e.type] ?? "text-muted-foreground"}`}>
              {e.type[0]}
            </Badge>
          </div>
        );
      })}
      <div className="flex items-center gap-2 pt-1 border-t border-border/50">
        <div className="w-28 text-[10px] text-muted-foreground/60">avg</div>
        <div className="flex-1 h-px bg-muted/20 relative">
          <div className="absolute top-[-3px] h-2 w-px bg-primary/40"
            style={{ left: `${((avg - min) / range) * 100}%` }} />
        </div>
        <div className="text-[10px] text-muted-foreground/60 w-10 text-right">{avg}</div>
      </div>
    </div>
  );
}

export default function BalanceTab({ projectId }: { projectId: number }) {
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [complexity, setComplexity] = useState<ComplexityData | null>(null);
  const [conflicts, setConflicts] = useState<ConflictData | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [loadingComplexity, setLoadingComplexity] = useState(false);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [expandedProps, setExpandedProps] = useState<Set<string>>(new Set());

  const BASE = `${window.location.origin}/api`;

  const loadAll = useCallback(async () => {
    setLoadingBalance(true);
    setLoadingComplexity(true);
    const [bRes, cRes] = await Promise.all([
      fetch(`${BASE}/projects/${projectId}/balance-analysis`),
      fetch(`${BASE}/projects/${projectId}/complexity-score`),
    ]);
    if (bRes.ok) setBalance(await bRes.json());
    if (cRes.ok) setComplexity(await cRes.json());
    setLoadingBalance(false);
    setLoadingComplexity(false);
  }, [projectId, BASE]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleCheckConflicts = async () => {
    setCheckingConflicts(true);
    setConflicts(null);
    try {
      const res = await fetch(`${BASE}/projects/${projectId}/rules/check-conflicts`, { method: "POST" });
      if (res.ok) setConflicts(await res.json());
    } finally {
      setCheckingConflicts(false);
    }
  };

  const toggleProp = (name: string) => {
    setExpandedProps(prev => { const s = new Set(prev); if (s.has(name)) s.delete(name); else s.add(name); return s; });
  };

  const balanceColor = (score: number | null) =>
    score === null ? "" : score >= 70 ? "text-emerald-400" : score >= 40 ? "text-amber-400" : "text-red-400";

  const complexityColor = (score: number) =>
    score < 30 ? "text-emerald-400" : score < 60 ? "text-amber-400" : "text-red-400";

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-20">
      <div>
        <h2 className="text-xl font-bold text-white">Balance & Complexity</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Analyze your game's numerical balance, design complexity, and rule consistency.</p>
      </div>

      {/* ── Score Overview ── */}
      <div className="grid grid-cols-3 gap-4">
        {/* Balance Score */}
        <Card className="bg-card border-border">
          <CardContent className="p-5 flex flex-col items-center text-center gap-2">
            {loadingBalance ? <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /> :
              balance?.balanceScore !== null && balance?.balanceScore !== undefined
                ? <ScoreRing score={balance.balanceScore} label="Balance" />
                : <div className="text-muted-foreground text-sm py-4">No numeric properties yet</div>}
            <p className="text-xs text-muted-foreground">
              {balance?.stats.length ? `${balance.stats.length} numeric property types` : "Add numeric properties to entities"}
            </p>
          </CardContent>
        </Card>

        {/* Complexity Score */}
        <Card className="bg-card border-border">
          <CardContent className="p-5 flex flex-col items-center text-center gap-2">
            {loadingComplexity ? <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /> :
              complexity
                ? <>
                    <ScoreRing score={complexity.score} label="Complexity" />
                    <Badge variant="outline" className={`text-xs ${complexityColor(complexity.score)} border-current/30`}>
                      {complexity.label}
                    </Badge>
                  </>
                : <div className="text-muted-foreground text-sm py-4">Not calculated</div>}
          </CardContent>
        </Card>

        {/* Rule Conflict */}
        <Card className="bg-card border-border">
          <CardContent className="p-5 flex flex-col items-center text-center gap-3">
            <ShieldAlert className="w-10 h-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {conflicts ? `${conflicts.conflicts.length} issue${conflicts.conflicts.length !== 1 ? "s" : ""} found` : "Rule conflict scan"}
            </p>
            <Button size="sm" variant="outline" className="w-full border-border text-muted-foreground hover:text-white" onClick={handleCheckConflicts} disabled={checkingConflicts}>
              {checkingConflicts ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Scanning...</> : <><Sparkles className="w-3.5 h-3.5 mr-1.5" />Check Rules</>}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ── Complexity Breakdown ── */}
      {complexity && (
        <Card className="bg-card border-border">
          <CardHeader className="border-b border-border py-3 px-5">
            <CardTitle className="text-white text-sm font-semibold flex items-center gap-2">
              <Scale className="w-4 h-4 text-primary" /> Complexity Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-3">
            {complexity.breakdown.map((item) => (
              <div key={item.factor} className="flex items-center gap-3">
                <div className="w-36 text-xs text-muted-foreground shrink-0">{item.factor}</div>
                <div className="flex-1 h-3 bg-muted/20 rounded-full overflow-hidden">
                  <div className="h-full bg-primary/60 rounded-full" style={{ width: `${(item.score / item.max) * 100}%` }} />
                </div>
                <div className="text-xs font-mono text-muted-foreground w-12 text-right shrink-0">{item.score}/{item.max}</div>
                <div className="text-xs text-muted-foreground/60 w-28 shrink-0 truncate">{item.note}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Rule Conflicts ── */}
      {conflicts && (
        <Card className="bg-card border-border">
          <CardHeader className="border-b border-border py-3 px-5">
            <CardTitle className="text-white text-sm font-semibold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-primary" />
              Rule Analysis
              <Badge variant="outline" className="ml-auto text-xs">
                {conflicts.conflicts.length} issues
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-3">
            <p className="text-sm text-muted-foreground italic">{conflicts.summary}</p>
            {conflicts.conflicts.length === 0 ? (
              <div className="flex items-center gap-2 text-emerald-400 text-sm p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <CheckCircle className="w-4 h-4" /> No conflicts detected — rules look consistent!
              </div>
            ) : (
              conflicts.conflicts.map((c, i) => (
                <div key={i} className={`border rounded-xl p-4 space-y-2 ${SEVERITY_COLOR[c.severity] ?? "border-border"}`}>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span className="font-semibold text-sm">{c.title}</span>
                    <Badge variant="outline" className="ml-auto text-xs capitalize border-current/30">{c.severity}</Badge>
                  </div>
                  <p className="text-xs leading-relaxed opacity-80">{c.description}</p>
                  <div className="flex items-start gap-1.5 text-xs opacity-70">
                    <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span><strong>Fix:</strong> {c.resolution}</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Property Balance Charts ── */}
      {balance && balance.stats.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="border-b border-border py-3 px-5">
            <CardTitle className="text-white text-sm font-semibold flex items-center gap-2">
              <Scale className="w-4 h-4 text-primary" />
              Property Balance Charts
              <span className="text-xs text-muted-foreground font-normal ml-1">— red bars are outliers ({">"}2σ from average)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-3">
            {balance.stats.map(stat => (
              <div key={stat.propName} className="border border-border rounded-xl overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/10 text-left"
                  onClick={() => toggleProp(stat.propName)}
                >
                  <span className="text-sm font-medium text-white flex-1">{stat.propName}</span>
                  <span className="text-xs text-muted-foreground">min {stat.min} · max {stat.max} · avg {stat.avg}</span>
                  {stat.outliers.length > 0 && (
                    <Badge variant="outline" className="text-xs text-red-400 border-red-500/30 bg-red-500/10">
                      {stat.outliers.length} outlier{stat.outliers.length !== 1 ? "s" : ""}
                    </Badge>
                  )}
                  {expandedProps.has(stat.propName)
                    ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>
                {expandedProps.has(stat.propName) && (
                  <div className="px-4 pb-4 border-t border-border/50 pt-3">
                    <BarChart entries={stat.entries} min={stat.min} max={stat.max} avg={stat.avg} />
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {balance && balance.stats.length === 0 && !loadingBalance && (
        <Card className="bg-card border-border">
          <CardContent className="p-10 text-center space-y-2">
            <Scale className="w-10 h-10 mx-auto text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No numeric properties to analyze yet.</p>
            <p className="text-xs text-muted-foreground/60">Go to the Ontology tab and add numeric properties (like "attack", "cost", "health") to your entities.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
