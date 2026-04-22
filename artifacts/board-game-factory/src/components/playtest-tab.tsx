import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Star, Users, Clock, AlertCircle, CheckCircle, Lightbulb, ClipboardList } from "lucide-react";

type PlaytestSession = {
  id: number;
  title: string;
  date?: string;
  playerCount?: number;
  duration?: number;
  rating?: number;
  notes?: string;
  issues?: string[];
  positives?: string[];
  suggestions?: string[];
  createdAt: string;
};

function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={`w-5 h-5 ${onChange ? "cursor-pointer" : ""} ${i <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
          onClick={() => onChange?.(i)}
        />
      ))}
    </div>
  );
}

function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [input, setInput] = useState("");
  const add = () => {
    if (input.trim()) { onChange([...value, input.trim()]); setInput(""); }
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), add())} placeholder={placeholder} className="bg-input text-sm h-8" />
        <Button type="button" size="sm" variant="outline" className="h-8" onClick={add}>Add</Button>
      </div>
      <div className="flex flex-wrap gap-1">
        {value.map((tag, i) => (
          <Badge key={i} variant="outline" className="text-xs gap-1 pr-1">
            {tag}
            <button type="button" className="ml-1 text-muted-foreground hover:text-white" onClick={() => onChange(value.filter((_, j) => j !== i))}>×</button>
          </Badge>
        ))}
      </div>
    </div>
  );
}

export default function PlaytestTab({ projectId }: { projectId: number }) {
  const [sessions, setSessions] = useState<PlaytestSession[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [newSession, setNewSession] = useState({
    title: "", date: "", playerCount: 4, duration: 60, rating: 3,
    notes: "", issues: [] as string[], positives: [] as string[], suggestions: [] as string[],
  });

  const BASE = `${window.location.origin}/api`;

  const loadSessions = async () => {
    const res = await fetch(`${BASE}/projects/${projectId}/playtest-sessions`);
    if (res.ok) setSessions(await res.json());
  };

  useState(() => { loadSessions(); });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSession.title) return;
    const res = await fetch(`${BASE}/projects/${projectId}/playtest-sessions`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newSession),
    });
    if (res.ok) {
      setAddOpen(false);
      setNewSession({ title: "", date: "", playerCount: 4, duration: 60, rating: 3, notes: "", issues: [], positives: [], suggestions: [] });
      loadSessions();
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this session?")) return;
    await fetch(`${BASE}/projects/${projectId}/playtest-sessions/${id}`, { method: "DELETE" });
    loadSessions();
  };

  const avgRating = sessions.length > 0 ? sessions.reduce((a, s) => a + (s.rating ?? 0), 0) / sessions.length : 0;
  const totalIssues = sessions.reduce((a, s) => a + (s.issues?.length ?? 0), 0);
  const totalPositives = sessions.reduce((a, s) => a + (s.positives?.length ?? 0), 0);

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Playtesting Log</h2>
          <p className="text-muted-foreground text-sm mt-1">Track sessions, capture feedback, and iterate on your design.</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground">
              <Plus className="w-4 h-4 mr-2" />Log Session
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border sm:max-w-xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Log Playtest Session</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-5 pt-2">
              <div className="space-y-1">
                <Label className="text-xs">Session Title</Label>
                <Input value={newSession.title} onChange={e => setNewSession({...newSession, title: e.target.value})} placeholder="e.g. Alpha Test #3 — Economy Rules" className="bg-input" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Date</Label>
                  <Input type="date" value={newSession.date} onChange={e => setNewSession({...newSession, date: e.target.value})} className="bg-input" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Players</Label>
                  <Input type="number" value={newSession.playerCount} onChange={e => setNewSession({...newSession, playerCount: parseInt(e.target.value)})} min={1} max={10} className="bg-input" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Duration (min)</Label>
                  <Input type="number" value={newSession.duration} onChange={e => setNewSession({...newSession, duration: parseInt(e.target.value)})} min={1} className="bg-input" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Overall Rating</Label>
                <StarRating value={newSession.rating} onChange={v => setNewSession({...newSession, rating: v})} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Session Notes</Label>
                <Textarea value={newSession.notes} onChange={e => setNewSession({...newSession, notes: e.target.value})} className="bg-input h-24 resize-none" placeholder="What happened during the session..." />
              </div>
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5 text-emerald-400" />What Worked</Label>
                <TagInput value={newSession.positives} onChange={v => setNewSession({...newSession, positives: v})} placeholder="Add a positive observation" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5 text-red-400" />Issues Found</Label>
                <TagInput value={newSession.issues} onChange={v => setNewSession({...newSession, issues: v})} placeholder="Add an issue or bug" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1"><Lightbulb className="w-3.5 h-3.5 text-amber-400" />Suggestions</Label>
                <TagInput value={newSession.suggestions} onChange={v => setNewSession({...newSession, suggestions: v})} placeholder="Add a suggestion" />
              </div>
              <Button type="submit" className="w-full">Save Session</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary stats */}
      {sessions.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <ClipboardList className="w-5 h-5 mx-auto text-primary mb-1" />
            <div className="text-2xl font-bold text-white">{sessions.length}</div>
            <div className="text-xs text-muted-foreground">Sessions</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <Star className="w-5 h-5 mx-auto text-amber-400 mb-1" />
            <div className="text-2xl font-bold text-white">{avgRating.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">Avg Rating</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <AlertCircle className="w-5 h-5 mx-auto text-red-400 mb-1" />
            <div className="text-2xl font-bold text-white">{totalIssues}</div>
            <div className="text-xs text-muted-foreground">Issues Found</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <CheckCircle className="w-5 h-5 mx-auto text-emerald-400 mb-1" />
            <div className="text-2xl font-bold text-white">{totalPositives}</div>
            <div className="text-xs text-muted-foreground">Positives</div>
          </div>
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <h3 className="text-white font-medium mb-1">No sessions logged yet</h3>
          <p className="text-muted-foreground text-sm mb-4">Click "Log Session" after each playtest to track progress.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map(session => (
            <Card key={session.id} className="bg-card border-border overflow-hidden">
              <div
                className="flex items-start justify-between p-5 cursor-pointer hover:bg-muted/5"
                onClick={() => setExpandedId(expandedId === session.id ? null : session.id)}
              >
                <div className="flex items-start gap-4 flex-1">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-white">{session.title}</h3>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {session.date && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{session.date}</span>}
                      {session.playerCount && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{session.playerCount} players</span>}
                      {session.duration && <span>{session.duration} min</span>}
                      {session.rating && <StarRating value={session.rating} />}
                    </div>
                  </div>
                  <div className="flex gap-2 ml-auto mr-3">
                    {(session.issues?.length ?? 0) > 0 && <Badge variant="outline" className="text-xs bg-red-500/10 text-red-400 border-red-500/30">{session.issues?.length} issues</Badge>}
                    {(session.positives?.length ?? 0) > 0 && <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/30">{session.positives?.length} positives</Badge>}
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0" onClick={e => { e.stopPropagation(); handleDelete(session.id); }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>

              {expandedId === session.id && (
                <div className="border-t border-border p-5 space-y-4 bg-muted/5">
                  {session.notes && <p className="text-sm text-muted-foreground">{session.notes}</p>}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {session.positives && session.positives.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-emerald-400 flex items-center gap-1 mb-2"><CheckCircle className="w-3.5 h-3.5" />What Worked</p>
                        <ul className="space-y-1">{session.positives.map((p, i) => <li key={i} className="text-xs text-muted-foreground flex gap-1.5"><span className="text-emerald-500 mt-0.5">•</span>{p}</li>)}</ul>
                      </div>
                    )}
                    {session.issues && session.issues.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-red-400 flex items-center gap-1 mb-2"><AlertCircle className="w-3.5 h-3.5" />Issues</p>
                        <ul className="space-y-1">{session.issues.map((p, i) => <li key={i} className="text-xs text-muted-foreground flex gap-1.5"><span className="text-red-500 mt-0.5">•</span>{p}</li>)}</ul>
                      </div>
                    )}
                    {session.suggestions && session.suggestions.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-amber-400 flex items-center gap-1 mb-2"><Lightbulb className="w-3.5 h-3.5" />Suggestions</p>
                        <ul className="space-y-1">{session.suggestions.map((p, i) => <li key={i} className="text-xs text-muted-foreground flex gap-1.5"><span className="text-amber-500 mt-0.5">•</span>{p}</li>)}</ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
