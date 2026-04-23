import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, GripVertical, Clock, User, AlertTriangle, CheckCircle2, Circle, Timer, History, ChevronDown, ChevronUp } from "lucide-react";

type ChangeEntry = {
  id: number; entityType: string; action: string; description: string;
  author?: string; createdAt: string;
};

type Task = {
  id: number;
  title: string;
  description?: string;
  status: "todo" | "in_progress" | "review" | "done";
  priority: "low" | "medium" | "high" | "critical";
  assignee?: string;
  category?: string;
  dueDate?: string;
  createdAt: string;
};

const STATUS_COLUMNS: { key: Task["status"]; label: string; color: string; icon: React.ReactNode }[] = [
  { key: "todo", label: "To Do", color: "border-gray-500/30", icon: <Circle className="w-4 h-4 text-gray-400" /> },
  { key: "in_progress", label: "In Progress", color: "border-blue-500/30", icon: <Timer className="w-4 h-4 text-blue-400" /> },
  { key: "review", label: "Review", color: "border-amber-500/30", icon: <AlertTriangle className="w-4 h-4 text-amber-400" /> },
  { key: "done", label: "Done", color: "border-emerald-500/30", icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" /> },
];

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  medium: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  high: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
};

const CATEGORY_OPTIONS = ["Design", "Rules", "Playtesting", "Art", "Production", "Research", "Balance", "Other"];

export default function CollaborationTab({ projectId }: { projectId: number }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);
  const [changelog, setChangelog] = useState<ChangeEntry[]>([]);
  const [showChangelog, setShowChangelog] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "", description: "", status: "todo" as Task["status"],
    priority: "medium" as Task["priority"], assignee: "", category: "Design", dueDate: "",
  });

  const BASE = `${window.location.origin}/api`;

  const loadTasks = useCallback(async () => {
    const res = await fetch(`${BASE}/projects/${projectId}/tasks`);
    if (res.ok) setTasks(await res.json());
  }, [BASE, projectId]);

  const loadChangelog = useCallback(async () => {
    const res = await fetch(`${BASE}/projects/${projectId}/changelog`);
    if (res.ok) setChangelog(await res.json());
  }, [BASE, projectId]);

  useEffect(() => { loadTasks(); loadChangelog(); }, [loadTasks, loadChangelog]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title) return;
    const res = await fetch(`${BASE}/projects/${projectId}/tasks`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newTask),
    });
    if (res.ok) {
      setAddOpen(false);
      setNewTask({ title: "", description: "", status: "todo", priority: "medium", assignee: "", category: "Design", dueDate: "" });
      await loadTasks();
    }
  };

  const handleStatusChange = async (id: number, status: Task["status"]) => {
    await fetch(`${BASE}/projects/${projectId}/tasks/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    await loadChangelog();
  };

  const handleDelete = async (id: number) => {
    await fetch(`${BASE}/projects/${projectId}/tasks/${id}`, { method: "DELETE" });
    setTasks(prev => prev.filter(t => t.id !== id));
    await loadChangelog();
  };

  const tasksByStatus = (status: Task["status"]) => tasks.filter(t => t.status === status);

  const handleDragStart = (id: number) => setDragging(id);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (status: Task["status"]) => {
    if (dragging !== null) {
      handleStatusChange(dragging, status);
      setDragging(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Task Board</h2>
          <p className="text-muted-foreground text-sm mt-1">Collaborate, assign, and track design tasks across your team.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="text-white font-medium">{tasks.filter(t => t.status !== "done").length}</span> active
            <span className="text-white font-medium ml-2">{tasks.filter(t => t.status === "done").length}</span> done
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground">
                <Plus className="w-4 h-4 mr-2" />Add Task
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>New Task</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4 pt-2">
                <div className="space-y-1">
                  <Label className="text-xs">Title</Label>
                  <Input value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} placeholder="Task title" className="bg-input" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Description</Label>
                  <Textarea value={newTask.description} onChange={e => setNewTask({...newTask, description: e.target.value})} className="bg-input h-20 resize-none" placeholder="Optional details..." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Priority</Label>
                    <Select value={newTask.priority} onValueChange={v => setNewTask({...newTask, priority: v as Task["priority"]})}>
                      <SelectTrigger className="bg-input"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["low","medium","high","critical"].map(p => <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Category</Label>
                    <Select value={newTask.category} onValueChange={v => setNewTask({...newTask, category: v})}>
                      <SelectTrigger className="bg-input"><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORY_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Assignee</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                      <Input value={newTask.assignee} onChange={e => setNewTask({...newTask, assignee: e.target.value})} placeholder="Name or email" className="bg-input pl-8" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Due Date</Label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                      <Input type="date" value={newTask.dueDate} onChange={e => setNewTask({...newTask, dueDate: e.target.value})} className="bg-input pl-8" />
                    </div>
                  </div>
                </div>
                <Button type="submit" className="w-full">Create Task</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Changelog Section */}
      <div className="border border-border rounded-xl overflow-hidden">
        <button
          className="w-full flex items-center gap-2 px-5 py-3 bg-muted/10 hover:bg-muted/20 text-left"
          onClick={() => setShowChangelog(!showChangelog)}
        >
          <History className="w-4 h-4 text-primary" />
          <span className="font-semibold text-white text-sm">Changelog</span>
          <Badge variant="outline" className="ml-1 text-xs text-muted-foreground">{changelog.length}</Badge>
          {showChangelog ? <ChevronUp className="w-4 h-4 ml-auto text-muted-foreground" /> : <ChevronDown className="w-4 h-4 ml-auto text-muted-foreground" />}
        </button>
        {showChangelog && (
          <div className="max-h-64 overflow-y-auto divide-y divide-border/50">
            {changelog.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">No changes logged yet. Changes are tracked automatically as you edit the game.</div>
            ) : changelog.map(c => (
              <div key={c.id} className="flex items-start gap-3 px-5 py-3 hover:bg-muted/5">
                <div className="w-2 h-2 rounded-full bg-primary/60 mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">{c.entityType}</Badge>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-primary/70 border-primary/20 capitalize">{c.action}</Badge>
                    <span className="text-xs text-muted-foreground">{c.author || "Designer"}</span>
                    <span className="text-[10px] text-muted-foreground/40 ml-auto">{new Date(c.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-4 gap-4">
        {STATUS_COLUMNS.map(col => (
          <div
            key={col.key}
            className={`flex flex-col gap-3 min-h-[400px] p-3 rounded-xl border ${col.color} bg-muted/5`}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(col.key)}
          >
            <div className="flex items-center gap-2 px-1">
              {col.icon}
              <span className="font-semibold text-sm text-white">{col.label}</span>
              <span className="ml-auto text-xs text-muted-foreground bg-muted/20 rounded-full px-2 py-0.5">{tasksByStatus(col.key).length}</span>
            </div>

            {tasksByStatus(col.key).map(task => (
              <Card
                key={task.id}
                draggable
                onDragStart={() => handleDragStart(task.id)}
                className="bg-card border-border p-3 cursor-grab active:cursor-grabbing group hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <GripVertical className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5 opacity-0 group-hover:opacity-100" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white leading-snug">{task.title}</p>
                    {task.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <Badge variant="outline" className={`text-[10px] ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</Badge>
                      {task.category && <Badge variant="outline" className="text-[10px] bg-secondary/30">{task.category}</Badge>}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      {task.assignee && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <User className="w-3 h-3" />{task.assignee}
                        </div>
                      )}
                      {task.dueDate && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                          <Clock className="w-3 h-3" />{new Date(task.dueDate).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 mt-2 pt-2 border-t border-border/50">
                  {STATUS_COLUMNS.filter(c => c.key !== task.status).map(c => (
                    <Button key={c.key} variant="ghost" size="sm" className="h-6 text-[10px] text-muted-foreground hover:text-white flex-1" onClick={() => handleStatusChange(task.id, c.key)}>
                      → {c.label}
                    </Button>
                  ))}
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0" onClick={() => handleDelete(task.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </Card>
            ))}

            {tasksByStatus(col.key).length === 0 && (
              <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground/40 border border-dashed border-border/30 rounded-lg">
                Drop here
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
