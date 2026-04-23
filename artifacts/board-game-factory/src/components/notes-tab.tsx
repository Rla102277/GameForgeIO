import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Sparkles, Pin, Trash2, Loader2, X, Check, Pencil,
  GitMerge, Wand2, FileEdit, FilePlus, LayoutList, LayoutGrid,
  Clock, Layers, RefreshCw, ChevronDown, ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Note = {
  id: number; title: string; content: string; color: string;
  pinned: boolean; topic: string | null; lookAtLater: boolean;
  createdAt: string; updatedAt: string;
};
type RuleChange = {
  type: "create" | "update"; ruleId?: number; ruleTitle: string;
  proposedTitle?: string; currentContent?: string; proposedContent: string;
  rationale: string; category?: string;
};

// ── Topics ───────────────────────────────────────────────────────────────────
const TOPICS = [
  { id: "core_loop",         label: "Core Loop",          icon: "🔄", cls: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  { id: "mechanics",         label: "Mechanics",           icon: "⚙️", cls: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  { id: "player_experience", label: "Player Experience",   icon: "🎮", cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  { id: "economy",           label: "Economy",             icon: "💰", cls: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" },
  { id: "theme",             label: "Theme & Story",       icon: "📖", cls: "text-violet-400 bg-violet-500/10 border-violet-500/20" },
  { id: "balance",           label: "Balance",             icon: "⚖️", cls: "text-red-400 bg-red-500/10 border-red-500/20" },
  { id: "accessibility",     label: "Accessibility",       icon: "♿", cls: "text-slate-400 bg-slate-500/10 border-slate-500/20" },
  { id: "marketing",         label: "Marketing",           icon: "📣", cls: "text-pink-400 bg-pink-500/10 border-pink-500/20" },
] as const;

type TopicId = typeof TOPICS[number]["id"];
const topicFor = (id: string | null) => TOPICS.find(t => t.id === id) ?? null;

// ── Colors ───────────────────────────────────────────────────────────────────
const COLORS = [
  { id: "slate",  bg: "bg-slate-800/70",  border: "border-slate-700",    dot: "bg-slate-400" },
  { id: "blue",   bg: "bg-blue-900/40",   border: "border-blue-700/60",  dot: "bg-blue-400" },
  { id: "amber",  bg: "bg-amber-900/30",  border: "border-amber-700/50", dot: "bg-amber-400" },
  { id: "green",  bg: "bg-emerald-900/30",border: "border-emerald-700/50",dot: "bg-emerald-400" },
  { id: "purple", bg: "bg-violet-900/30", border: "border-violet-700/50",dot: "bg-violet-400" },
  { id: "red",    bg: "bg-red-900/30",    border: "border-red-700/50",   dot: "bg-red-400" },
];
const colorFor = (id: string) => COLORS.find(c => c.id === id) ?? COLORS[0];

const CAT_COLORS: Record<string, string> = {
  movement: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  combat: "bg-red-500/20 text-red-400 border-red-500/30",
  economy: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  turn_structure: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  variant: "bg-violet-500/20 text-violet-400 border-violet-500/30",
};

// ── Topic Picker ──────────────────────────────────────────────────────────────
function TopicPicker({ current, onChange }: { current: string | null; onChange: (t: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const topic = topicFor(current);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
          topic ? topic.cls : "text-muted-foreground border-border bg-transparent hover:border-slate-500"
        }`}
      >
        {topic ? <><span>{topic.icon}</span><span>{topic.label}</span></> : <span className="opacity-60">+ topic</span>}
      </button>
      {open && (
        <div className="absolute bottom-full mb-1 left-0 z-50 bg-slate-900 border border-border rounded-xl shadow-xl p-1.5 min-w-[180px]">
          <button
            onClick={() => { onChange(null); setOpen(false); }}
            className="w-full text-left text-[11px] px-2 py-1.5 rounded-lg text-muted-foreground hover:bg-white/5 hover:text-white transition-colors"
          >
            — No topic
          </button>
          {TOPICS.map(t => (
            <button
              key={t.id}
              onClick={() => { onChange(t.id); setOpen(false); }}
              className={`w-full text-left text-[11px] px-2 py-1.5 rounded-lg flex items-center gap-2 transition-colors ${
                current === t.id ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span>{t.icon}</span><span>{t.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Rule Change Panel ─────────────────────────────────────────────────────────
function RuleChangePanel({ changes, projectId, onDone }: { changes: RuleChange[]; projectId: number; onDone: () => void }) {
  const [pending, setPending] = useState<RuleChange[]>(changes);
  const [applying, setApplying] = useState<Set<number>>(new Set());
  const [applied, setApplied] = useState<Set<number>>(new Set());
  const { toast } = useToast();
  const BASE = `${window.location.origin}/api`;

  const applyChange = async (change: RuleChange, index: number) => {
    setApplying(s => new Set(s).add(index));
    try {
      if (change.type === "update" && change.ruleId) {
        const body: Record<string, unknown> = { content: change.proposedContent };
        if (change.proposedTitle && change.proposedTitle !== change.ruleTitle) body.title = change.proposedTitle;
        await fetch(`${BASE}/projects/${projectId}/rules/${change.ruleId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        toast({ title: `Updated "${change.proposedTitle || change.ruleTitle}"` });
      } else if (change.type === "create") {
        await fetch(`${BASE}/projects/${projectId}/rules`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: change.ruleTitle, content: change.proposedContent, category: change.category ?? "variant", priority: 1 }),
        });
        toast({ title: `Created "${change.ruleTitle}"` });
      }
      setApplied(s => new Set(s).add(index));
    } catch {
      toast({ title: "Failed to apply change", variant: "destructive" });
    } finally {
      setApplying(s => { const n = new Set(s); n.delete(index); return n; });
    }
  };

  if (pending.length === 0) return (
    <div className="text-center py-3 text-xs text-muted-foreground">
      All changes processed. <button onClick={onDone} className="text-primary hover:underline">Close</button>
    </div>
  );

  return (
    <div className="space-y-3">
      {pending.map((change, i) => (
        <div key={i} className={`rounded-xl border p-3 space-y-2 ${applied.has(i) ? "opacity-50 border-emerald-500/20 bg-emerald-500/5" : "border-border bg-muted/10"}`}>
          <div className="flex items-start gap-2">
            <div className={`mt-0.5 shrink-0 ${change.type === "create" ? "text-emerald-400" : "text-blue-400"}`}>
              {change.type === "create" ? <FilePlus className="w-3.5 h-3.5" /> : <FileEdit className="w-3.5 h-3.5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-white">{change.type === "create" ? "New: " : "Update: "}{change.proposedTitle || change.ruleTitle}</span>
                {change.category && <span className={`text-[10px] px-1.5 py-0.5 rounded border ${CAT_COLORS[change.category] ?? "bg-muted text-muted-foreground border-border"}`}>{change.category}</span>}
                {applied.has(i) && <span className="text-[10px] text-emerald-400 flex items-center gap-0.5"><Check className="w-3 h-3" />Applied</span>}
              </div>
              <p className="text-[11px] text-muted-foreground italic mt-0.5">{change.rationale}</p>
            </div>
          </div>
          {change.type === "update" && change.currentContent && (
            <p className="text-xs text-muted-foreground/60 line-through leading-relaxed bg-red-500/5 border border-red-500/10 rounded p-2 ml-5">{change.currentContent}</p>
          )}
          <p className="text-xs text-slate-200 leading-relaxed bg-emerald-500/5 border border-emerald-500/20 rounded p-2 ml-5 whitespace-pre-wrap">{change.proposedContent}</p>
          {!applied.has(i) && (
            <div className="flex gap-2 ml-5">
              <Button size="sm" onClick={() => applyChange(change, i)} disabled={applying.has(i)} className="h-7 text-xs gap-1">
                {applying.has(i) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Apply
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPending(p => p.filter((_, j) => j !== i))} className="h-7 text-xs text-muted-foreground hover:text-white gap-1">
                <X className="w-3 h-3" /> Dismiss
              </Button>
            </div>
          )}
        </div>
      ))}
      <div className="flex justify-end"><Button size="sm" variant="ghost" onClick={onDone} className="text-xs text-muted-foreground hover:text-white">Close panel</Button></div>
    </div>
  );
}

// ── Note Card ─────────────────────────────────────────────────────────────────
function NoteCard({ note, projectId, onUpdate, onDelete }: {
  note: Note; projectId: number;
  onUpdate: (id: number, updates: Partial<Note>) => void;
  onDelete: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [suggesting, setSuggesting] = useState(false);
  const [ruleChanges, setRuleChanges] = useState<RuleChange[] | null>(null);
  const [sendingToBoard, setSendingToBoard] = useState(false);
  const { toast } = useToast();
  const BASE = `${window.location.origin}/api`;
  const c = colorFor(note.color);

  const save = () => { onUpdate(note.id, { title, content }); setEditing(false); };

  const suggestRuleChanges = async () => {
    setSuggesting(true); setRuleChanges(null);
    try {
      const res = await fetch(`${BASE}/projects/${projectId}/notes/${note.id}/suggest-rule-changes`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      if (res.ok) {
        const { changes } = await res.json();
        if (!changes?.length) toast({ title: "No rule changes suggested" });
        else setRuleChanges(changes);
      } else toast({ title: "Suggestion failed", variant: "destructive" });
    } finally { setSuggesting(false); }
  };

  const sendToStoryboard = async () => {
    setSendingToBoard(true);
    try {
      const res = await fetch(`${BASE}/projects/${projectId}/storyboard-nodes`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: note.title || note.content.slice(0, 60), content: note.content, type: "note_idea", status: "idea", color: "blue" }),
      });
      if (res.ok) toast({ title: "Sent to Storyboard ✓" });
      else toast({ title: "Failed to send", variant: "destructive" });
    } finally { setSendingToBoard(false); }
  };

  return (
    <div className={`relative group rounded-xl border flex flex-col transition-all ${c.bg} ${c.border} ${note.pinned ? "ring-1 ring-white/10" : ""} ${note.lookAtLater ? "ring-1 ring-amber-500/30" : ""}`}>
      {/* Note body */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        {/* Hover action bar */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          {COLORS.map(col => (
            <button key={col.id} onClick={() => onUpdate(note.id, { color: col.id })}
              className={`w-3 h-3 rounded-full ${col.dot} ${note.color === col.id ? "ring-2 ring-white/60" : "opacity-50 hover:opacity-100"} transition-all`} />
          ))}
          <div className="w-px h-3 bg-white/10 mx-0.5" />
          <button onClick={() => onUpdate(note.id, { pinned: !note.pinned })}
            className={`p-0.5 rounded transition-colors ${note.pinned ? "text-amber-300" : "text-muted-foreground hover:text-white"}`}>
            <Pin className="w-3 h-3" />
          </button>
          <button onClick={() => setEditing(!editing)} className="p-0.5 rounded text-muted-foreground hover:text-white transition-colors">
            <Pencil className="w-3 h-3" />
          </button>
          <button onClick={() => onDelete(note.id)} className="p-0.5 rounded text-muted-foreground hover:text-red-400 transition-colors">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>

        {editing ? (
          <>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Note title…"
              className="bg-black/20 border-white/10 text-white text-sm font-medium h-8" autoFocus />
            <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Note content…"
              className="bg-black/20 border-white/10 text-sm text-slate-200 resize-none min-h-[80px]" />
            <div className="flex gap-2 mt-1">
              <Button size="sm" onClick={save} className="h-7 text-xs bg-white/10 hover:bg-white/20 text-white border-0">
                <Check className="w-3 h-3 mr-1" />Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setTitle(note.title); setContent(note.content); setEditing(false); }}
                className="h-7 text-xs text-muted-foreground hover:text-white"><X className="w-3 h-3" /></Button>
            </div>
          </>
        ) : (
          <div className="cursor-default" onDoubleClick={() => setEditing(true)}>
            {note.title && <p className="font-semibold text-white text-sm leading-snug mb-1 pr-20">{note.title}</p>}
            {note.content && <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{note.content}</p>}
            {!note.title && !note.content && <p className="text-xs text-muted-foreground italic">Empty note — double-click to edit</p>}
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      {!editing && (
        <div className="border-t border-white/5 px-3 py-2 flex items-center gap-2 flex-wrap">
          <TopicPicker current={note.topic} onChange={t => onUpdate(note.id, { topic: t })} />
          <div className="flex items-center gap-1 ml-auto">
            {/* Look at later */}
            <button
              onClick={() => onUpdate(note.id, { lookAtLater: !note.lookAtLater })}
              title={note.lookAtLater ? "Remove 'look at later'" : "Mark 'look at later'"}
              className={`p-1 rounded transition-colors ${note.lookAtLater ? "text-amber-400" : "text-muted-foreground hover:text-amber-400"}`}
            >
              <Clock className="w-3.5 h-3.5" />
            </button>
            {/* Send to storyboard */}
            <button
              onClick={sendToStoryboard}
              disabled={sendingToBoard}
              title="Send to Storyboard"
              className="p-1 rounded text-muted-foreground hover:text-violet-400 transition-colors disabled:opacity-40"
            >
              {sendingToBoard ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
            </button>
            {/* Suggest rule changes */}
            <button
              onClick={ruleChanges ? () => setRuleChanges(null) : suggestRuleChanges}
              disabled={suggesting}
              title="Suggest rule changes from this note"
              className={`p-1 rounded transition-colors ${ruleChanges ? "text-emerald-400" : "text-muted-foreground hover:text-emerald-400"} disabled:opacity-40`}
            >
              {suggesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitMerge className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      )}

      {/* Rule changes panel */}
      {ruleChanges && ruleChanges.length > 0 && (
        <div className="border-t border-white/10 bg-black/20 rounded-b-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <GitMerge className="w-4 h-4 text-emerald-400" />
            <p className="text-xs font-semibold text-emerald-400">Rule Changes from Note</p>
          </div>
          <RuleChangePanel changes={ruleChanges} projectId={projectId} onDone={() => setRuleChanges(null)} />
        </div>
      )}
    </div>
  );
}

// ── Add Note Card ─────────────────────────────────────────────────────────────
function AddNoteCard({ onCreate }: { onCreate: (note: Partial<Note>) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [color, setColor] = useState("slate");
  const c = colorFor(color);

  const save = () => {
    if (!title.trim() && !content.trim()) return;
    onCreate({ title, content, color });
    setTitle(""); setContent(""); setColor("slate"); setOpen(false);
  };

  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="rounded-xl border border-dashed border-slate-700 p-4 text-slate-500 hover:text-slate-300 hover:border-slate-500 transition-all flex items-center gap-2 text-sm w-full min-h-[80px]">
      <Plus className="w-4 h-4" /> New note
    </button>
  );

  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-2 ${c.bg} ${c.border}`}>
      <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title (optional)…"
        className="bg-black/20 border-white/10 text-white text-sm h-8" autoFocus />
      <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Your idea or note…"
        className="bg-black/20 border-white/10 text-sm text-slate-200 resize-none min-h-[72px]"
        onKeyDown={e => { if (e.key === "Enter" && e.metaKey) save(); }} />
      <div className="flex items-center gap-3 mt-1">
        <div className="flex gap-1.5">
          {COLORS.map(col => (
            <button key={col.id} onClick={() => setColor(col.id)}
              className={`w-3.5 h-3.5 rounded-full ${col.dot} ${color === col.id ? "ring-2 ring-white/60" : "opacity-50 hover:opacity-100"} transition-all`} />
          ))}
        </div>
        <div className="flex gap-2 ml-auto">
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)} className="h-7 text-xs text-muted-foreground hover:text-white">Cancel</Button>
          <Button size="sm" onClick={save} className="h-7 text-xs bg-white/10 hover:bg-white/20 text-white border-0">Add note</Button>
        </div>
      </div>
    </div>
  );
}

// ── Guide View ────────────────────────────────────────────────────────────────
function GuideView({ notes, projectId, onUpdate, onDelete, onOrganize, organizing }: {
  notes: Note[]; projectId: number;
  onUpdate: (id: number, updates: Partial<Note>) => void;
  onDelete: (id: number) => void;
  onOrganize: () => void;
  organizing: boolean;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setCollapsed(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const { toast } = useToast();
  const BASE = `${window.location.origin}/api`;

  const sendToStoryboard = async (note: Note) => {
    const res = await fetch(`${BASE}/projects/${projectId}/storyboard-nodes`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: note.title || note.content.slice(0, 60), content: note.content, type: "note_idea", status: "idea", color: "blue" }),
    });
    if (res.ok) toast({ title: "Sent to Storyboard ✓" });
    else toast({ title: "Failed", variant: "destructive" });
  };

  const sections = [
    ...TOPICS.map(t => ({ id: t.id, label: t.label, icon: t.icon, cls: t.cls, notes: notes.filter(n => n.topic === t.id) })),
    { id: "look_at_later", label: "Look at Later", icon: "🕐", cls: "text-amber-400 bg-amber-500/10 border-amber-500/20", notes: notes.filter(n => n.lookAtLater && !n.topic) },
    { id: "unsorted", label: "Unsorted", icon: "📌", cls: "text-muted-foreground bg-muted/10 border-border", notes: notes.filter(n => !n.topic) },
  ].filter(s => s.notes.length > 0);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 mb-4">
        <p className="text-xs text-muted-foreground flex-1">{notes.length} notes organized across {sections.filter(s => s.id !== "unsorted").length} topics</p>
        <Button size="sm" variant="ghost" onClick={onOrganize} disabled={organizing}
          className="h-7 text-xs text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 gap-1.5 border border-violet-500/20">
          {organizing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          AI Organize
        </Button>
      </div>

      {sections.map(section => (
        <div key={section.id} className="rounded-xl border border-border/40 overflow-hidden mb-2">
          <button
            onClick={() => toggle(section.id)}
            className="w-full flex items-center gap-3 px-4 py-3 bg-muted/5 hover:bg-muted/10 transition-colors"
          >
            <span className="text-base">{section.icon}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${section.cls}`}>{section.label}</span>
            <span className="text-xs text-muted-foreground">{section.notes.length} note{section.notes.length !== 1 ? "s" : ""}</span>
            <div className="ml-auto text-muted-foreground">
              {collapsed.has(section.id) ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          {!collapsed.has(section.id) && (
            <div className="divide-y divide-border/30">
              {section.notes.map(note => {
                const c = colorFor(note.color);
                return (
                  <div key={note.id} className={`flex items-start gap-3 px-4 py-3 ${c.bg}/30 group/row`}>
                    <div className="flex-1 min-w-0">
                      {note.title && <p className="text-sm font-medium text-white leading-snug">{note.title}</p>}
                      {note.content && <p className="text-xs text-slate-400 leading-relaxed mt-0.5 line-clamp-2">{note.content}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover/row:opacity-100 transition-opacity">
                      <TopicPicker current={note.topic} onChange={t => onUpdate(note.id, { topic: t })} />
                      <button onClick={() => onUpdate(note.id, { lookAtLater: !note.lookAtLater })}
                        className={`p-1 rounded transition-colors ${note.lookAtLater ? "text-amber-400" : "text-muted-foreground hover:text-amber-400"}`}>
                        <Clock className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => sendToStoryboard(note)} title="Send to Storyboard"
                        className="p-1 rounded text-muted-foreground hover:text-violet-400 transition-colors">
                        <Layers className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => onDelete(note.id)} className="p-1 rounded text-muted-foreground hover:text-red-400 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {sections.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No notes yet. Add some notes and use AI Organize to sort them.</p>
        </div>
      )}
    </div>
  );
}

// ── Global Changes Panel ──────────────────────────────────────────────────────
function GlobalChangesPanel({ projectId, onClose }: { projectId: number; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [changes, setChanges] = useState<RuleChange[]>([]);
  const { toast } = useToast();
  const BASE = `${window.location.origin}/api`;

  const fetchChanges = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/projects/${projectId}/notes/suggest-global-changes`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      if (res.ok) { const { changes: c } = await res.json(); setChanges(c ?? []); }
      else toast({ title: "Global suggestion failed", variant: "destructive" });
    } finally { setLoading(false); }
  }, [projectId, BASE]);

  useEffect(() => { fetchChanges(); }, [fetchChanges]);

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-5 mb-6 space-y-4">
      <div className="flex items-center gap-2">
        <Wand2 className="w-4 h-4 text-emerald-400 shrink-0" />
        <p className="text-sm font-semibold text-emerald-400 flex-1">Global Rule Suggestions — from all notes</p>
        <Button size="sm" variant="ghost" onClick={fetchChanges} disabled={loading}
          className="h-7 text-xs text-muted-foreground hover:text-white gap-1">
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Regenerate
        </Button>
        <button onClick={onClose} className="text-muted-foreground hover:text-white"><X className="w-4 h-4" /></button>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-400" /> Analyzing all notes and rules…
        </div>
      ) : changes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No suggestions — add more notes or rules first.</p>
      ) : (
        <RuleChangePanel changes={changes} projectId={projectId} onDone={onClose} />
      )}
    </div>
  );
}

// ── Main Notes Tab ────────────────────────────────────────────────────────────
export default function NotesTab({ projectId }: { projectId: number }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [brainstormTopic, setBrainstormTopic] = useState("");
  const [isBrainstorming, setIsBrainstorming] = useState(false);
  const [pendingIdeas, setPendingIdeas] = useState<Partial<Note>[]>([]);
  const [showGlobalChanges, setShowGlobalChanges] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "guide">("grid");
  const [filterTopic, setFilterTopic] = useState<string | null>(null);
  const [filterLater, setFilterLater] = useState(false);
  const [organizing, setOrganizing] = useState(false);
  const { toast } = useToast();
  const BASE = `${window.location.origin}/api`;

  const load = useCallback(async () => {
    const res = await fetch(`${BASE}/projects/${projectId}/notes`);
    if (res.ok) setNotes(await res.json());
    setLoading(false);
  }, [projectId, BASE]);

  useEffect(() => { load(); }, [load]);

  const createNote = async (data: Partial<Note>) => {
    const res = await fetch(`${BASE}/projects/${projectId}/notes`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    if (res.ok) load();
  };

  const updateNote = async (id: number, updates: Partial<Note>) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));
    await fetch(`${BASE}/projects/${projectId}/notes/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates),
    });
  };

  const deleteNote = async (id: number) => {
    await fetch(`${BASE}/projects/${projectId}/notes/${id}`, { method: "DELETE" });
    setNotes(n => n.filter(x => x.id !== id));
  };

  const brainstorm = async () => {
    setIsBrainstorming(true); setPendingIdeas([]);
    try {
      const res = await fetch(`${BASE}/projects/${projectId}/notes/ai-brainstorm`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: brainstormTopic }),
      });
      if (res.ok) { const { ideas } = await res.json(); setPendingIdeas(ideas); }
      else toast({ title: "Brainstorm failed", variant: "destructive" });
    } finally { setIsBrainstorming(false); }
  };

  const organizeTopics = async () => {
    setOrganizing(true);
    try {
      const res = await fetch(`${BASE}/projects/${projectId}/notes/ai-organize-topics`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      if (res.ok) {
        const { assignments } = await res.json();
        for (const { noteId, topic } of assignments) {
          await fetch(`${BASE}/projects/${projectId}/notes/${noteId}`, {
            method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic }),
          });
        }
        await load();
        toast({ title: `Organized ${assignments.length} notes into topics` });
      } else toast({ title: "AI organize failed", variant: "destructive" });
    } finally { setOrganizing(false); }
  };

  const acceptIdea = async (idea: Partial<Note>) => {
    await createNote(idea);
    setPendingIdeas(p => p.filter(x => x !== idea));
  };

  // Filtering
  let visibleNotes = notes;
  if (filterLater) visibleNotes = visibleNotes.filter(n => n.lookAtLater);
  if (filterTopic) visibleNotes = visibleNotes.filter(n => n.topic === filterTopic);

  const pinnedNotes = visibleNotes.filter(n => n.pinned);
  const unpinnedNotes = visibleNotes.filter(n => !n.pinned);
  const laterCount = notes.filter(n => n.lookAtLater).length;

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="h-[calc(100vh-180px)] overflow-y-auto px-6 py-5 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-white">Notes</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Capture ideas · organize by topic · send to storyboard</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-border overflow-hidden">
            <button onClick={() => setViewMode("grid")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors ${viewMode === "grid" ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white"}`}>
              <LayoutGrid className="w-3.5 h-3.5" /> Grid
            </button>
            <button onClick={() => setViewMode("guide")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors border-l border-border ${viewMode === "guide" ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white"}`}>
              <LayoutList className="w-3.5 h-3.5" /> Design Guide
            </button>
          </div>
          {/* Look at later filter */}
          {laterCount > 0 && (
            <button onClick={() => setFilterLater(f => !f)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${filterLater ? "border-amber-500/50 text-amber-400 bg-amber-500/10" : "border-border text-muted-foreground hover:text-amber-400 hover:border-amber-500/30"}`}>
              <Clock className="w-3.5 h-3.5" /> Look at Later {laterCount > 0 && <span className="ml-0.5 opacity-70">({laterCount})</span>}
            </button>
          )}
          {/* Global changes */}
          <Button onClick={() => setShowGlobalChanges(!showGlobalChanges)} variant="outline"
            className={`h-9 text-sm gap-1.5 ${showGlobalChanges ? "border-emerald-500/50 text-emerald-400 bg-emerald-500/10" : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"}`}>
            <Wand2 className="w-4 h-4" /> Suggest global changes
          </Button>
          {/* Brainstorm */}
          <div className="flex items-center gap-2">
            <Input value={brainstormTopic} onChange={e => setBrainstormTopic(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !isBrainstorming && brainstorm()}
              placeholder="Topic (optional)…" className="bg-slate-800/60 border-slate-700 h-9 text-sm w-36 rounded-lg" />
            <Button onClick={brainstorm} disabled={isBrainstorming}
              className="bg-violet-600 hover:bg-violet-500 text-white h-9 text-sm gap-1.5">
              {isBrainstorming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Brainstorm
            </Button>
          </div>
        </div>
      </div>

      {/* Topic filter pills */}
      {viewMode === "grid" && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <button onClick={() => setFilterTopic(null)}
            className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${!filterTopic ? "bg-white/10 border-white/20 text-white" : "border-border text-muted-foreground hover:text-white hover:border-white/20"}`}>
            All
          </button>
          {TOPICS.map(t => {
            const count = notes.filter(n => n.topic === t.id).length;
            if (count === 0) return null;
            return (
              <button key={t.id} onClick={() => setFilterTopic(filterTopic === t.id ? null : t.id)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] border transition-colors ${
                  filterTopic === t.id ? `${t.cls}` : "border-border text-muted-foreground hover:text-white hover:border-white/20"
                }`}>
                {t.icon} {t.label} <span className="opacity-60">({count})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Global changes panel */}
      {showGlobalChanges && <GlobalChangesPanel projectId={projectId} onClose={() => setShowGlobalChanges(false)} />}

      {/* Pending AI ideas */}
      {pendingIdeas.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <p className="text-sm font-medium text-violet-400">AI Suggestions — click to add</p>
            <button onClick={() => setPendingIdeas([])} className="ml-auto text-xs text-muted-foreground hover:text-white transition-colors">Clear all</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingIdeas.map((idea, i) => {
              const c = colorFor(idea.color ?? "slate");
              return (
                <button key={i} onClick={() => acceptIdea(idea)}
                  className={`text-left rounded-xl border p-4 transition-all hover:ring-2 hover:ring-violet-500/50 ${c.bg} ${c.border}`}>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    {idea.title && <p className="font-semibold text-white text-sm">{idea.title}</p>}
                    <Plus className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />
                  </div>
                  {idea.content && <p className="text-xs text-slate-300 leading-relaxed">{idea.content}</p>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Design Guide view */}
      {viewMode === "guide" && (
        <GuideView notes={notes} projectId={projectId} onUpdate={updateNote} onDelete={deleteNote} onOrganize={organizeTopics} organizing={organizing} />
      )}

      {/* Grid view */}
      {viewMode === "grid" && (
        <>
          {pinnedNotes.length > 0 && (
            <div className="mb-5">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Pin className="w-3 h-3" /> Pinned
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {pinnedNotes.map(note => <NoteCard key={note.id} note={note} projectId={projectId} onUpdate={updateNote} onDelete={deleteNote} />)}
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {!filterTopic && !filterLater && <AddNoteCard onCreate={createNote} />}
            {unpinnedNotes.map(note => <NoteCard key={note.id} note={note} projectId={projectId} onUpdate={updateNote} onDelete={deleteNote} />)}
          </div>
          {notes.length === 0 && pendingIdeas.length === 0 && !showGlobalChanges && (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-sm mb-1">No notes yet</p>
              <p className="text-xs opacity-70">Click "New note" or use AI Brainstorm to get started</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
