import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Sparkles, Pin, Trash2, Loader2, X, Check, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Note = { id: number; title: string; content: string; color: string; pinned: boolean; createdAt: string; updatedAt: string };

const COLORS: { id: string; bg: string; border: string; dot: string }[] = [
  { id: "slate",  bg: "bg-slate-800/70",  border: "border-slate-700",   dot: "bg-slate-400" },
  { id: "blue",   bg: "bg-blue-900/40",   border: "border-blue-700/60", dot: "bg-blue-400" },
  { id: "amber",  bg: "bg-amber-900/30",  border: "border-amber-700/50",dot: "bg-amber-400" },
  { id: "green",  bg: "bg-emerald-900/30",border: "border-emerald-700/50",dot: "bg-emerald-400" },
  { id: "purple", bg: "bg-violet-900/30", border: "border-violet-700/50",dot: "bg-violet-400" },
  { id: "red",    bg: "bg-red-900/30",    border: "border-red-700/50",  dot: "bg-red-400" },
];
const colorFor = (id: string) => COLORS.find(c => c.id === id) ?? COLORS[0];

function NoteCard({ note, onUpdate, onDelete }: {
  note: Note;
  onUpdate: (id: number, updates: Partial<Note>) => void;
  onDelete: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const c = colorFor(note.color);

  const save = () => {
    onUpdate(note.id, { title, content });
    setEditing(false);
  };

  return (
    <div className={`relative group rounded-xl border p-4 flex flex-col gap-2 transition-all ${c.bg} ${c.border} ${note.pinned ? "ring-1 ring-white/10" : ""}`}>
      {/* Color dots row */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {COLORS.map(col => (
          <button key={col.id} onClick={() => onUpdate(note.id, { color: col.id })}
            className={`w-3 h-3 rounded-full ${col.dot} ${note.color === col.id ? "ring-2 ring-white/60" : "opacity-50 hover:opacity-100"} transition-all`}
          />
        ))}
        <div className="w-px h-3 bg-white/10 mx-0.5" />
        <button onClick={() => onUpdate(note.id, { pinned: !note.pinned })}
          className={`p-0.5 rounded transition-colors ${note.pinned ? "text-amber-300" : "text-muted-foreground hover:text-white"}`}>
          <Pin className="w-3 h-3" />
        </button>
        <button onClick={() => setEditing(!editing)}
          className="p-0.5 rounded text-muted-foreground hover:text-white transition-colors">
          <Pencil className="w-3 h-3" />
        </button>
        <button onClick={() => onDelete(note.id)}
          className="p-0.5 rounded text-muted-foreground hover:text-red-400 transition-colors">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {editing ? (
        <>
          <Input
            value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Note title…"
            className="bg-black/20 border-white/10 text-white text-sm font-medium h-8"
            autoFocus
          />
          <Textarea
            value={content} onChange={e => setContent(e.target.value)}
            placeholder="Note content…"
            className="bg-black/20 border-white/10 text-sm text-slate-200 resize-none min-h-[80px]"
          />
          <div className="flex gap-2 mt-1">
            <Button size="sm" onClick={save} className="h-7 text-xs bg-white/10 hover:bg-white/20 text-white border-0">
              <Check className="w-3 h-3 mr-1" />Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setTitle(note.title); setContent(note.content); setEditing(false); }}
              className="h-7 text-xs text-muted-foreground hover:text-white">
              <X className="w-3 h-3" />
            </Button>
          </div>
        </>
      ) : (
        <div className="cursor-default" onDoubleClick={() => setEditing(true)}>
          {note.title && <p className="font-semibold text-white text-sm leading-snug mb-1">{note.title}</p>}
          {note.content && <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{note.content}</p>}
          {!note.title && !note.content && <p className="text-xs text-muted-foreground italic">Empty note — double-click to edit</p>}
        </div>
      )}
    </div>
  );
}

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

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-xl border border-dashed border-slate-700 p-4 text-slate-500 hover:text-slate-300 hover:border-slate-500 transition-all flex items-center gap-2 text-sm w-full"
      >
        <Plus className="w-4 h-4" /> New note
      </button>
    );
  }

  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-2 ${c.bg} ${c.border}`}>
      <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title (optional)…"
        className="bg-black/20 border-white/10 text-white text-sm h-8" autoFocus />
      <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Your idea or note…"
        className="bg-black/20 border-white/10 text-sm text-slate-200 resize-none min-h-[72px]"
        onKeyDown={e => { if (e.key === "Enter" && e.metaKey) save(); }}
      />
      <div className="flex items-center gap-3 mt-1">
        <div className="flex gap-1.5">
          {COLORS.map(col => (
            <button key={col.id} onClick={() => setColor(col.id)}
              className={`w-3.5 h-3.5 rounded-full ${col.dot} ${color === col.id ? "ring-2 ring-white/60" : "opacity-50 hover:opacity-100"} transition-all`}
            />
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

export default function NotesTab({ projectId }: { projectId: number }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [brainstormTopic, setBrainstormTopic] = useState("");
  const [isBrainstorming, setIsBrainstorming] = useState(false);
  const [pendingIdeas, setPendingIdeas] = useState<Partial<Note>[]>([]);
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
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) load();
  };

  const updateNote = async (id: number, updates: Partial<Note>) => {
    const res = await fetch(`${BASE}/projects/${projectId}/notes/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) load();
  };

  const deleteNote = async (id: number) => {
    await fetch(`${BASE}/projects/${projectId}/notes/${id}`, { method: "DELETE" });
    setNotes(n => n.filter(x => x.id !== id));
  };

  const brainstorm = async () => {
    setIsBrainstorming(true);
    setPendingIdeas([]);
    try {
      const res = await fetch(`${BASE}/projects/${projectId}/notes/ai-brainstorm`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: brainstormTopic }),
      });
      if (res.ok) {
        const { ideas } = await res.json();
        setPendingIdeas(ideas);
      } else {
        toast({ title: "Brainstorm failed", variant: "destructive" });
      }
    } finally {
      setIsBrainstorming(false);
    }
  };

  const acceptIdea = async (idea: Partial<Note>) => {
    await createNote(idea);
    setPendingIdeas(p => p.filter(x => x !== idea));
  };

  const pinnedNotes = notes.filter(n => n.pinned);
  const unpinnedNotes = notes.filter(n => !n.pinned);

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="h-[calc(100vh-180px)] overflow-y-auto px-6 py-5 max-w-6xl mx-auto">

      {/* Header + brainstorm */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">Notes</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Capture ideas, observations, and design directions freely</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Input
            value={brainstormTopic}
            onChange={e => setBrainstormTopic(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !isBrainstorming && brainstorm()}
            placeholder="Topic (optional)…"
            className="bg-slate-800/60 border-slate-700 h-9 text-sm w-44 rounded-lg"
          />
          <Button
            onClick={brainstorm}
            disabled={isBrainstorming}
            className="bg-violet-600 hover:bg-violet-500 text-white h-9 text-sm gap-1.5"
          >
            {isBrainstorming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            AI Brainstorm
          </Button>
        </div>
      </div>

      {/* Pending AI ideas */}
      {pendingIdeas.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <p className="text-sm font-medium text-violet-400">AI Suggestions — click to add</p>
            <button onClick={() => setPendingIdeas([])} className="ml-auto text-xs text-muted-foreground hover:text-white transition-colors">
              Clear all
            </button>
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

      {/* Pinned */}
      {pinnedNotes.length > 0 && (
        <div className="mb-5">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <Pin className="w-3 h-3" /> Pinned
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pinnedNotes.map(note => (
              <NoteCard key={note.id} note={note} onUpdate={updateNote} onDelete={deleteNote} />
            ))}
          </div>
        </div>
      )}

      {/* All notes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <AddNoteCard onCreate={createNote} />
        {unpinnedNotes.map(note => (
          <NoteCard key={note.id} note={note} onUpdate={updateNote} onDelete={deleteNote} />
        ))}
      </div>

      {notes.length === 0 && pendingIdeas.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-sm mb-1">No notes yet</p>
          <p className="text-xs opacity-70">Use AI Brainstorm to generate ideas, or click "New note" to start writing</p>
        </div>
      )}
    </div>
  );
}
