import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Sparkles, Trash2, Loader2, X, Check, GitBranch,
  ChevronRight, ChevronDown, Pencil, MoveRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Node = {
  id: number; projectId: number; parentId: number | null;
  title: string; content: string; status: string; type: string;
  linkedRuleTitle: string | null; color: string; position: number;
  createdAt: string; updatedAt: string;
};

const STATUSES = [
  { id: "idea",      label: "Ideas",    bg: "bg-slate-900", border: "border-slate-700", badge: "bg-slate-700 text-slate-300" },
  { id: "exploring", label: "Exploring",bg: "bg-blue-950/60",border: "border-blue-800/50",badge: "bg-blue-900 text-blue-300" },
  { id: "proposed",  label: "Proposed", bg: "bg-amber-950/40",border: "border-amber-800/40",badge: "bg-amber-900 text-amber-300" },
  { id: "approved",  label: "Approved", bg: "bg-emerald-950/40",border: "border-emerald-800/40",badge: "bg-emerald-900 text-emerald-300" },
  { id: "rejected",  label: "Rejected", bg: "bg-red-950/30",border: "border-red-900/30",badge: "bg-red-900/50 text-red-400" },
];

const TYPE_COLORS: Record<string, string> = {
  rule_variant: "text-blue-400",
  mechanic: "text-violet-400",
  concept: "text-amber-400",
};
const TYPE_LABELS: Record<string, string> = {
  rule_variant: "Rule Variant",
  mechanic: "Mechanic",
  concept: "Concept",
};

function NodeCard({ node, allNodes, onCreate, onUpdate, onDelete }: {
  node: Node; allNodes: Node[];
  onCreate: (data: Partial<Node>) => void;
  onUpdate: (id: number, data: Partial<Node>) => void;
  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(node.title);
  const [content, setContent] = useState(node.content);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<Partial<Node>[]>([]);
  const [movingTo, setMovingTo] = useState<string | null>(null);
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const moveMenuRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const BASE = `${window.location.origin}/api`;

  const children = allNodes.filter(n => n.parentId === node.id);
  const statusMeta = STATUSES.find(s => s.id === node.status) ?? STATUSES[0];
  const otherStatuses = STATUSES.filter(s => s.id !== node.status);

  // Close move menu on outside click
  useEffect(() => {
    if (!showMoveMenu) return;
    const handler = (e: MouseEvent) => {
      if (moveMenuRef.current && !moveMenuRef.current.contains(e.target as HTMLElement)) {
        setShowMoveMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMoveMenu]);

  const save = () => {
    onUpdate(node.id, { title, content });
    setEditing(false);
  };

  const moveToStatus = async (statusId: string) => {
    setMovingTo(statusId);
    setShowMoveMenu(false);
    await onUpdate(node.id, { status: statusId });
    setMovingTo(null);
  };

  const getSuggestions = async () => {
    setSuggesting(true);
    try {
      const res = await fetch(`${BASE}/projects/${node.projectId}/storyboard-nodes/${node.id}/ai-suggest`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
      });
      if (res.ok) {
        const { suggestions: s } = await res.json();
        setSuggestions(s);
      } else {
        toast({ title: "AI suggest failed", variant: "destructive" });
      }
    } finally {
      setSuggesting(false);
    }
  };

  const acceptSuggestion = (s: Partial<Node>) => {
    onCreate({ ...s, parentId: node.id, status: "idea" });
    setSuggestions(prev => prev.filter(x => x !== s));
  };

  return (
    <div className="group">
      <div className={`rounded-xl border p-3.5 transition-all ${statusMeta.bg} ${statusMeta.border}`}>
        {/* Header row */}
        <div className="flex items-start gap-2">
          <button onClick={() => setExpanded(!expanded)} className="mt-0.5 text-muted-foreground hover:text-white transition-colors shrink-0">
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          <div className="flex-1 min-w-0">
            {editing ? (
              <Input value={title} onChange={e => setTitle(e.target.value)} autoFocus
                className="bg-black/20 border-white/10 text-white text-sm h-7 mb-1.5" />
            ) : (
              <p className="text-sm font-medium text-white leading-snug">{node.title}</p>
            )}
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span className={`text-[10px] font-medium ${TYPE_COLORS[node.type] ?? "text-muted-foreground"}`}>
                {TYPE_LABELS[node.type] ?? node.type}
              </span>
              {node.linkedRuleTitle && (
                <>
                  <span className="text-muted-foreground opacity-40">·</span>
                  <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">↳ {node.linkedRuleTitle}</span>
                </>
              )}
              {children.length > 0 && (
                <>
                  <span className="text-muted-foreground opacity-40">·</span>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                    <GitBranch className="w-2.5 h-2.5" />{children.length}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Move-to-column picker */}
            <div className="relative" ref={moveMenuRef}>
              <button
                onClick={() => setShowMoveMenu(!showMoveMenu)}
                title="Move to column"
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-white px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 transition-colors whitespace-nowrap"
              >
                {movingTo ? <Loader2 className="w-3 h-3 animate-spin" /> : <MoveRight className="w-3 h-3" />}
                Move
              </button>
              {showMoveMenu && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-lg shadow-xl overflow-hidden min-w-[130px]">
                  {otherStatuses.map(s => (
                    <button
                      key={s.id}
                      onClick={() => moveToStatus(s.id)}
                      className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-white/10 flex items-center gap-2 ${s.id === "approved" ? "text-emerald-400" : s.id === "rejected" ? "text-red-400" : s.id === "proposed" ? "text-amber-400" : s.id === "exploring" ? "text-blue-400" : "text-slate-300"}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.id === "approved" ? "bg-emerald-400" : s.id === "rejected" ? "bg-red-400" : s.id === "proposed" ? "bg-amber-400" : s.id === "exploring" ? "bg-blue-400" : "bg-slate-400"}`} />
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => setEditing(!editing)} className="p-1 text-muted-foreground hover:text-white transition-colors">
              <Pencil className="w-3 h-3" />
            </button>
            <button onClick={() => onDelete(node.id)} className="p-1 text-muted-foreground hover:text-red-400 transition-colors">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Expanded content */}
        {expanded && (
          <div className="mt-3 pl-5 space-y-3">
            {editing ? (
              <div className="space-y-2">
                <Textarea value={content} onChange={e => setContent(e.target.value)}
                  placeholder="Describe this variant…"
                  className="bg-black/20 border-white/10 text-sm text-slate-200 resize-none min-h-[60px]" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={save} className="h-7 text-xs bg-white/10 hover:bg-white/20 text-white border-0">
                    <Check className="w-3 h-3 mr-1" />Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setTitle(node.title); setContent(node.content); setEditing(false); }}
                    className="h-7 text-xs text-muted-foreground hover:text-white">
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ) : (
              node.content && <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">{node.content}</p>
            )}

            {/* Status chain */}
            <div className="flex items-center gap-1">
              {STATUSES.map((s, i) => (
                <button key={s.id} onClick={() => onUpdate(node.id, { status: s.id })}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${node.status === s.id ? s.badge : "text-muted-foreground hover:text-white bg-white/5"}`}>
                  {s.label}
                </button>
              ))}
            </div>

            {/* AI Suggest branch */}
            <div className="space-y-2">
              <Button size="sm" variant="ghost" onClick={getSuggestions} disabled={suggesting}
                className="h-7 text-xs text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 gap-1.5 px-2">
                {suggesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                AI suggest variants
              </Button>

              {suggestions.length > 0 && (
                <div className="space-y-1.5">
                  {suggestions.map((s, i) => (
                    <button key={i} onClick={() => acceptSuggestion(s)}
                      className="w-full text-left rounded-lg border border-violet-700/40 bg-violet-900/20 p-2.5 hover:bg-violet-900/30 transition-colors group/s">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-medium text-violet-300">{s.title}</p>
                        <Plus className="w-3 h-3 text-violet-400 shrink-0 mt-0.5 opacity-0 group-hover/s:opacity-100" />
                      </div>
                      {s.content && <p className="text-[11px] text-slate-400 mt-0.5">{s.content}</p>}
                    </button>
                  ))}
                  <button onClick={() => setSuggestions([])} className="text-xs text-muted-foreground hover:text-white transition-colors">Dismiss</button>
                </div>
              )}

              {/* Add child branch */}
              <button
                onClick={() => onCreate({ parentId: node.id, title: "New branch", content: "", status: "idea", type: node.type })}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors">
                <GitBranch className="w-3 h-3" /> Add branch
              </button>
            </div>

            {/* Children */}
            {children.length > 0 && (
              <div className="space-y-2 border-l-2 border-white/10 pl-3 mt-1">
                {children.map(child => (
                  <NodeCard key={child.id} node={child} allNodes={allNodes} onCreate={onCreate} onUpdate={onUpdate} onDelete={onDelete} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Column({ status, nodes, allNodes, onCreate, onUpdate, onDelete }: {
  status: typeof STATUSES[number]; nodes: Node[]; allNodes: Node[];
  onCreate: (data: Partial<Node>) => void;
  onUpdate: (id: number, data: Partial<Node>) => void;
  onDelete: (id: number) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("rule_variant");

  const add = () => {
    if (!title.trim()) return;
    onCreate({ title, content: "", status: status.id, type, parentId: null });
    setTitle(""); setAdding(false);
  };

  return (
    <div className="flex flex-col min-w-[260px] max-w-[300px]">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold text-white`}>{status.label}</span>
          <span className="text-xs text-muted-foreground bg-white/5 rounded-full px-1.5">{nodes.length}</span>
        </div>
        <button onClick={() => setAdding(!adding)}
          className="text-muted-foreground hover:text-white transition-colors p-0.5 rounded">
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-2.5 flex-1">
        {adding && (
          <div className={`rounded-xl border p-3 space-y-2 ${status.bg} ${status.border}`}>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Idea title…" autoFocus
              className="bg-black/20 border-white/10 text-white text-sm h-7"
              onKeyDown={e => e.key === "Enter" && add()} />
            <div className="flex gap-1.5">
              {Object.entries(TYPE_LABELS).map(([id, label]) => (
                <button key={id} onClick={() => setType(id)}
                  className={`text-[10px] px-2 py-0.5 rounded transition-colors ${type === id ? "bg-white/15 text-white" : "text-muted-foreground hover:text-white"}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              <Button size="sm" onClick={add} className="h-7 text-xs bg-white/10 hover:bg-white/20 text-white border-0 flex-1">Add</Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)} className="h-7 text-xs text-muted-foreground hover:text-white px-2">
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}

        {nodes.map(node => (
          <NodeCard key={node.id} node={node} allNodes={allNodes} onCreate={onCreate} onUpdate={onUpdate} onDelete={onDelete} />
        ))}

        {!adding && nodes.length === 0 && (
          <div className="text-center py-8 text-muted-foreground/40 text-xs border border-dashed border-white/5 rounded-xl">
            Empty
          </div>
        )}
      </div>
    </div>
  );
}

export default function StoryboardTab({ projectId }: { projectId: number }) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const BASE = `${window.location.origin}/api`;

  const load = useCallback(async () => {
    const res = await fetch(`${BASE}/projects/${projectId}/storyboard-nodes`);
    if (res.ok) setNodes(await res.json());
    setLoading(false);
  }, [projectId, BASE]);

  useEffect(() => { load(); }, [load]);

  const createNode = async (data: Partial<Node>) => {
    const res = await fetch(`${BASE}/projects/${projectId}/storyboard-nodes`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, projectId }),
    });
    if (res.ok) load();
  };

  const updateNode = async (id: number, updates: Partial<Node>) => {
    const res = await fetch(`${BASE}/projects/${projectId}/storyboard-nodes/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) load();
  };

  const deleteNode = async (id: number) => {
    await fetch(`${BASE}/projects/${projectId}/storyboard-nodes/${id}`, { method: "DELETE" });
    setNodes(n => n.filter(x => x.id !== id));
  };

  // Only show root nodes (no parent) in columns; children appear nested
  const rootNodes = nodes.filter(n => n.parentId === null);

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col">
      <div className="px-6 py-4 border-b border-border shrink-0">
        <h2 className="text-lg font-bold text-white">Storyboard</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Branch rule variants and explore design directions. Promote ideas → exploring → proposed → approved.
        </p>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-auto">
        <div className="flex gap-5 p-6 min-h-full" style={{ minWidth: `${STATUSES.length * 290}px` }}>
          {STATUSES.map(status => {
            const colNodes = rootNodes.filter(n => n.status === status.id);
            return (
              <Column
                key={status.id}
                status={status}
                nodes={colNodes}
                allNodes={nodes}
                onCreate={createNode}
                onUpdate={updateNode}
                onDelete={deleteNode}
              />
            );
          })}
        </div>
      </div>

      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-muted-foreground">
            <GitBranch className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium text-slate-500">No storyboard nodes yet</p>
            <p className="text-xs mt-1 opacity-60">Click + in any column to add a rule variant or design idea</p>
          </div>
        </div>
      )}
    </div>
  );
}
