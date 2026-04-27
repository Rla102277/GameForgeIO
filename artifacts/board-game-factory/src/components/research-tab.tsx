import { useState, useRef, useEffect, useCallback } from "react";
import { renderMarkdown } from "@/lib/markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Send, Trash2, Globe, FileText, Bot, User, Loader2,
  BookOpen, Plus, ChevronDown, ChevronRight, Link2, Sparkles,
  X, Search, Copy, Check, Wand2, Download, AlertCircle,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

type ResearchItem = {
  id: number; title: string; content?: string; sourceUrl?: string;
  type: string; tags?: string[]; createdAt: string;
};
type Message = { role: "user" | "assistant"; content: string; savedItem?: ResearchItem | null };

type GeneratedData = {
  overview?: { summary?: string; theme?: string; mechanics?: string[]; playerCount?: string; duration?: string; complexity?: string };
  entities?: { name: string; type: string; description: string; properties?: object[] }[];
  rules?: { title: string; content: string; category: string; priority: number }[];
  players?: { name: string; archetype?: string; description: string; victoryCondition?: string; specialAbility?: string; playstyle?: string; startingResources?: object }[];
};

const TYPE_BADGE: Record<string, string> = {
  url: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  file: "bg-green-500/15 text-green-400 border-green-500/30",
  ai_note: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  text: "bg-slate-500/15 text-slate-400 border-slate-500/30",
};
const TYPE_ICON: Record<string, React.ReactNode> = {
  url: <Globe className="w-3 h-3" />,
  file: <FileText className="w-3 h-3" />,
  ai_note: <Sparkles className="w-3 h-3" />,
  text: <FileText className="w-3 h-3" />,
};

const EXAMPLE_PROMPTS = [
  "What are the core mechanics that make Dominion's deck-building so addictive?",
  "Fetch https://en.wikipedia.org/wiki/Catan and extract reusable design patterns",
  "What makes a good resource-trading mechanic for 3-5 players?",
  "Compare the action selection systems in Viticulture vs Agricola",
  "Summarize key tension-building mechanics in modern euro games",
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={copy} className="text-muted-foreground hover:text-white transition-colors p-1 rounded">
      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

// ── Generate from Research modal ──────────────────────────────────────────────
function GenerateModal({
  open, onClose, projectId, onApplied,
}: { open: boolean; onClose: () => void; projectId: number; onApplied: () => void }) {
  const [phase, setPhase] = useState<"idle" | "generating" | "review" | "applying" | "done">("idle");
  const [streamText, setStreamText] = useState("");
  const [parsed, setParsed] = useState<GeneratedData | null>(null);
  const [applyError, setApplyError] = useState("");
  const { toast } = useToast();
  const BASE = `${window.location.origin}/api`;
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [streamText]);

  const startGenerate = async () => {
    setPhase("generating");
    setStreamText("");
    setParsed(null);
    setApplyError("");

    try {
      const res = await fetch(`${BASE}/projects/${projectId}/analyze-and-build-with-research`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
      });
      if (!res.body) throw new Error("No stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const d = JSON.parse(line.slice(6));
            if (d.content) { full += d.content; setStreamText(full); }
            if (d.error) throw new Error(d.error);
          } catch { /* ignore */ }
        }
      }

      // Extract JSON from response
      const jsonMatch = full.match(/```json\n?([\s\S]*?)\n?```/) || full.match(/\{[\s\S]*"entities"[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const data = JSON.parse(jsonMatch[1] ?? jsonMatch[0]);
          setParsed(data);
          setPhase("review");
          return;
        } catch { /* fall through */ }
      }
      // Try parsing the whole thing
      try {
        const data = JSON.parse(full.trim());
        setParsed(data);
        setPhase("review");
      } catch {
        setPhase("review");
      }
    } catch (e) {
      toast({ title: "Generation failed", description: String(e), variant: "destructive" });
      setPhase("idle");
    }
  };

  const applyToProject = async () => {
    if (!parsed) return;
    setPhase("applying");
    setApplyError("");
    let entityCount = 0, ruleCount = 0, playerCount = 0;

    try {
      if (parsed.entities?.length) {
        await Promise.all(parsed.entities.map(async e => {
          const r = await fetch(`${BASE}/projects/${projectId}/entities`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: e.name, type: e.type, description: e.description }),
          });
          if (r.ok) entityCount++;
        }));
      }
      if (parsed.rules?.length) {
        await Promise.all(parsed.rules.map(async r => {
          const res = await fetch(`${BASE}/projects/${projectId}/rules`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: r.title, content: r.content, category: r.category, priority: r.priority }),
          });
          if (res.ok) ruleCount++;
        }));
      }
      if (parsed.players?.length) {
        await Promise.all(parsed.players.map(async p => {
          const res = await fetch(`${BASE}/projects/${projectId}/players`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: p.name, archetype: p.archetype, description: p.description,
              victoryCondition: p.victoryCondition, specialAbilities: p.specialAbility ? [p.specialAbility] : [],
              playstyle: p.playstyle, startingResources: p.startingResources,
            }),
          });
          if (res.ok) playerCount++;
        }));
      }
      setPhase("done");
      toast({
        title: "Applied to project!",
        description: `Added ${entityCount} entities, ${ruleCount} rules, ${playerCount} player archetypes.`,
      });
      onApplied();
    } catch (e) {
      setApplyError(String(e));
      setPhase("review");
    }
  };

  const handleClose = () => {
    setPhase("idle");
    setStreamText("");
    setParsed(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-2xl w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Wand2 className="w-4 h-4 text-violet-400" />
            Build Game Design from Research
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Claude will read your research library and synthesize a complete game design — entities, rules, and player archetypes.
          </DialogDescription>
        </DialogHeader>

        {phase === "idle" && (
          <div className="space-y-4 py-2">
            <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4 text-sm text-slate-300 space-y-2">
              <p className="font-medium text-white">What gets generated:</p>
              <div className="grid grid-cols-3 gap-3 mt-2">
                {[
                  { icon: "📦", label: "8+ entities", desc: "Items, factions, locations, events" },
                  { icon: "📋", label: "12+ rules", desc: "Movement, combat, economy, setup" },
                  { icon: "👤", label: "3+ archetypes", desc: "Player types with abilities" },
                ].map(x => (
                  <div key={x.label} className="bg-slate-900/60 rounded-lg p-3 text-center border border-slate-700/50">
                    <div className="text-xl mb-1">{x.icon}</div>
                    <div className="font-semibold text-white text-xs">{x.label}</div>
                    <div className="text-slate-500 text-[10px] mt-0.5">{x.desc}</div>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Generated content is added to your project — existing data is preserved.
            </p>
            <Button onClick={startGenerate} className="w-full bg-violet-600 hover:bg-violet-500 text-white">
              <Wand2 className="w-4 h-4 mr-2" />
              Generate from Research Library
            </Button>
          </div>
        )}

        {phase === "generating" && (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2 text-sm text-violet-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Claude is analyzing your research and designing your game…
            </div>
            <ScrollArea className="h-64 bg-slate-950 border border-slate-800 rounded-lg p-3">
              <pre className="text-xs text-slate-400 font-mono whitespace-pre-wrap leading-relaxed">
                {streamText}
                <span className="inline-block w-1.5 h-3.5 bg-violet-400 animate-pulse ml-0.5 rounded-sm align-middle" />
              </pre>
              <div ref={endRef} />
            </ScrollArea>
          </div>
        )}

        {(phase === "review" || phase === "applying") && parsed && (
          <div className="space-y-4 py-2">
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-sm">
              <p className="font-semibold text-emerald-400 mb-1">Generation complete!</p>
              {parsed.overview?.summary && <p className="text-slate-300 text-xs">{parsed.overview.summary}</p>}
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {[
                { count: parsed.entities?.length ?? 0, label: "Entities", color: "text-blue-400" },
                { count: parsed.rules?.length ?? 0, label: "Rules", color: "text-amber-400" },
                { count: parsed.players?.length ?? 0, label: "Player types", color: "text-purple-400" },
              ].map(x => (
                <div key={x.label} className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 text-center">
                  <div className={`text-2xl font-bold ${x.color}`}>{x.count}</div>
                  <div className="text-slate-400 text-xs mt-0.5">{x.label}</div>
                </div>
              ))}
            </div>

            {parsed.overview?.mechanics && (
              <div>
                <p className="text-xs text-slate-400 mb-1.5 font-medium">Core Mechanics</p>
                <div className="flex flex-wrap gap-1.5">
                  {parsed.overview.mechanics.map(m => (
                    <Badge key={m} variant="outline" className="text-xs border-slate-700 text-slate-300">{m}</Badge>
                  ))}
                </div>
              </div>
            )}

            {applyError && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {applyError}
              </div>
            )}

            <p className="text-xs text-slate-500">
              This will add the generated content to your project. Your existing data is not affected.
            </p>

            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose} className="border-slate-700 text-slate-400 hover:text-white flex-1">
                Cancel
              </Button>
              <Button
                onClick={applyToProject}
                disabled={phase === "applying"}
                className="bg-violet-600 hover:bg-violet-500 text-white flex-1"
              >
                {phase === "applying"
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Applying…</>
                  : <><Download className="w-4 h-4 mr-2" />Apply to Project</>}
              </Button>
            </div>
          </div>
        )}

        {phase === "done" && (
          <div className="py-4 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto">
              <Check className="w-6 h-6 text-emerald-400" />
            </div>
            <p className="font-semibold text-white">Applied to project!</p>
            <p className="text-sm text-slate-400">Your entities, rules, and player archetypes have been added. Visit the Ontology, Rules, and Players tabs to review them.</p>
            <Button onClick={handleClose} className="bg-slate-800 hover:bg-slate-700 text-white">Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ResearchTab({ projectId }: { projectId: number }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Welcome to the **Research Lab** — your AI-powered game design research assistant.\n\nI can:\n- Fetch and analyze any URL (rulebooks, BGG pages, Wikipedia)\n- Summarize mechanics, design patterns, and thematic inspiration\n- Extract reusable ideas from competitor games\n- Auto-save key findings to your research library\n\nOnce your library has some items, use **Build from Research** to synthesize a complete game design automatically.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [library, setLibrary] = useState<ResearchItem[]>([]);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [showAddNote, setShowAddNote] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showGenerate, setShowGenerate] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const BASE = `${window.location.origin}/api`;

  const loadLibrary = useCallback(async () => {
    const res = await fetch(`${BASE}/projects/${projectId}/research-items`);
    if (res.ok) setLibrary(await res.json());
  }, [projectId, BASE]);

  useEffect(() => { loadLibrary(); }, [loadLibrary]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSend = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || isStreaming) return;
    setInput("");

    const historyForAPI = messages.filter(m => messages.indexOf(m) > 0).map(m => ({ role: m.role, content: m.content }));
    setMessages(prev => [...prev, { role: "user", content: msg }, { role: "assistant", content: "" }]);
    setIsStreaming(true);

    let assistantMsg = "";
    try {
      const res = await fetch(`${BASE}/projects/${projectId}/research/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, history: historyForAPI.slice(-8) }),
      });

      if (!res.body) throw new Error("No stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let savedItem: ResearchItem | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.content) {
              assistantMsg += data.content;
              setMessages(prev => { const n = [...prev]; n[n.length - 1] = { role: "assistant", content: assistantMsg }; return n; });
            }
            if (data.savedItem) savedItem = data.savedItem;
          } catch { /* ignore */ }
        }
      }

      if (savedItem) {
        setMessages(prev => { const n = [...prev]; n[n.length - 1] = { role: "assistant", content: assistantMsg, savedItem }; return n; });
        loadLibrary();
      }
    } catch (e) {
      setMessages(prev => { const n = [...prev]; n[n.length - 1] = { role: "assistant", content: `Error: ${e instanceof Error ? e.message : String(e)}` }; return n; });
    } finally {
      setIsStreaming(false);
    }
  };

  const handleFetchUrl = async () => {
    if (!urlInput.trim()) return;
    setIsFetchingUrl(true);
    try {
      const res = await fetch(`${BASE}/projects/${projectId}/research-items/fetch-url`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput }),
      });
      if (res.ok) {
        setUrlInput("");
        loadLibrary();
        toast({ title: "URL saved to library" });
      } else {
        toast({ title: "Failed to fetch URL", variant: "destructive" });
      }
    } finally {
      setIsFetchingUrl(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteTitle.trim()) return;
    setIsAddingNote(true);
    try {
      await fetch(`${BASE}/projects/${projectId}/research-items`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: noteTitle, content: noteContent, type: "text" }),
      });
      setNoteTitle(""); setNoteContent(""); setShowAddNote(false);
      loadLibrary();
    } finally {
      setIsAddingNote(false);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`${BASE}/projects/${projectId}/research-items/${id}`, { method: "DELETE" });
    loadLibrary();
  };

  const toggleExpand = (id: number) => {
    setExpandedItems(prev => { const s = new Set(prev); if (s.has(id)) s.delete(id); else s.add(id); return s; });
  };

  const cleanContent = (text: string) => text.replace(/<save_research>[\s\S]*?<\/save_research>/g, "").trim();

  const filteredLibrary = library.filter(item =>
    !searchQuery || item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.sourceUrl?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex gap-0 h-[calc(100vh-180px)] min-h-[600px] max-w-full">

      {/* ── LEFT: AI Chat ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-border">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div>
            <h2 className="font-semibold text-white text-sm">Research Assistant</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Ask about game mechanics, paste URLs, or get design inspiration</p>
          </div>
          <Button
            size="sm"
            onClick={() => setShowGenerate(true)}
            disabled={library.length === 0}
            className="bg-violet-600 hover:bg-violet-500 text-white h-8 text-xs gap-1.5"
          >
            <Wand2 className="w-3.5 h-3.5" />
            Build from Research
            {library.length > 0 && (
              <span className="bg-white/20 rounded-full px-1.5 text-[10px] font-bold ml-0.5">{library.length}</span>
            )}
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-primary" />
                </div>
              )}
              <div className={`max-w-[88%] space-y-1.5 ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col`}>
                <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-slate-800/60 border border-slate-700/60 text-foreground rounded-tl-sm"
                }`}>
                  {msg.role === "assistant"
                    ? <div
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(cleanContent(msg.content)) }}
                        className="[&_strong]:text-white [&_strong]:font-semibold [&_em]:text-slate-300"
                      />
                    : <p className="whitespace-pre-wrap">{msg.content}</p>}
                  {isStreaming && i === messages.length - 1 && msg.role === "assistant" && msg.content.length > 0 && (
                    <span className="inline-block w-1.5 h-4 bg-primary/60 animate-pulse ml-0.5 rounded-sm align-middle" />
                  )}
                </div>
                {msg.savedItem && (
                  <div className="flex items-center gap-1.5 text-xs text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded-lg px-2.5 py-1.5">
                    <Sparkles className="w-3 h-3" />
                    Saved to library: &ldquo;{msg.savedItem.title}&rdquo;
                  </div>
                )}
              </div>
              {msg.role === "user" && (
                <div className="w-7 h-7 rounded-full bg-slate-700/60 border border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {isStreaming && messages[messages.length - 1]?.content === "" && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                <Bot className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1.5 items-center h-4">
                  {[0, 0.15, 0.3].map((d, i) => (
                    <div key={i} className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: `${d}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Example prompts - only when fresh */}
        {messages.length <= 1 && (
          <div className="px-5 pb-3 shrink-0">
            <p className="text-[11px] text-muted-foreground mb-2 font-medium uppercase tracking-wide">Try asking</p>
            <div className="flex flex-col gap-1.5">
              {EXAMPLE_PROMPTS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(p)}
                  className="text-xs bg-slate-800/40 border border-slate-700/60 hover:border-primary/40 hover:bg-slate-800 rounded-lg px-3 py-2 text-muted-foreground hover:text-white transition-all text-left"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="px-5 py-4 border-t border-border shrink-0">
          <div className="flex gap-2 items-end">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Ask about mechanics, paste a URL to analyze, or ask for design patterns…"
              className="bg-slate-800/60 border-slate-700 resize-none min-h-[56px] max-h-[120px] text-sm flex-1 rounded-xl focus:border-primary/50 placeholder:text-slate-600"
              disabled={isStreaming}
            />
            <Button
              onClick={() => handleSend()}
              disabled={isStreaming || !input.trim()}
              className="bg-primary text-primary-foreground self-end h-10 w-10 p-0 rounded-xl shrink-0"
            >
              {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground/50 mt-1.5 pl-0.5">Enter to send · Shift+Enter for newline · URLs are automatically fetched</p>
        </div>
      </div>

      {/* ── RIGHT: Research Library ──────────────────────────────────────── */}
      <div className="w-[340px] shrink-0 flex flex-col bg-slate-950/40">

        {/* Library header */}
        <div className="px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
              Library
              {library.length > 0 && (
                <span className="text-xs text-muted-foreground font-normal">({library.length})</span>
              )}
            </h3>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground hover:text-white px-2" onClick={() => setShowAddNote(!showAddNote)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Note
            </Button>
          </div>

          {/* Search */}
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search library…"
              className="pl-8 bg-slate-800/60 border-slate-700 h-8 text-xs rounded-lg"
            />
          </div>

          {/* URL fetch */}
          <div className="flex gap-1.5">
            <div className="relative flex-1">
              <Globe className="absolute left-2.5 top-2 w-3 h-3 text-muted-foreground" />
              <Input
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleFetchUrl()}
                placeholder="https://… fetch to library"
                className="pl-7 bg-slate-800/60 border-slate-700 h-8 text-xs rounded-lg"
              />
            </div>
            <Button size="sm" variant="outline" className="h-8 px-2.5 shrink-0 border-slate-700 text-muted-foreground hover:text-white" onClick={handleFetchUrl} disabled={isFetchingUrl || !urlInput.trim()}>
              {isFetchingUrl ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>

        {/* Add note form */}
        {showAddNote && (
          <div className="px-4 py-3 border-b border-border bg-slate-900/60 space-y-2 shrink-0">
            <Input
              value={noteTitle} onChange={e => setNoteTitle(e.target.value)}
              placeholder="Note title…" className="bg-slate-800 border-slate-700 h-8 text-sm"
              autoFocus
            />
            <Textarea
              value={noteContent} onChange={e => setNoteContent(e.target.value)}
              placeholder="Note content…" className="bg-slate-800 border-slate-700 text-sm h-20 resize-none"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddNote} disabled={isAddingNote || !noteTitle.trim()} className="bg-primary text-primary-foreground h-7 text-xs flex-1">
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAddNote(false)} className="h-7 text-xs text-muted-foreground px-2">
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Library list */}
        <div className="flex-1 overflow-y-auto">
          {filteredLibrary.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 text-muted-foreground">
              {searchQuery ? (
                <>
                  <Search className="w-7 h-7 mb-2 opacity-30" />
                  <p className="text-sm">No items match &ldquo;{searchQuery}&rdquo;</p>
                </>
              ) : (
                <>
                  <BookOpen className="w-8 h-8 mb-3 opacity-20" />
                  <p className="text-sm font-medium text-slate-500">Library is empty</p>
                  <p className="text-xs mt-1 opacity-60 max-w-[220px] leading-relaxed">
                    Chat with the AI, paste a URL above, or add a manual note to get started.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filteredLibrary.map(item => (
                <div key={item.id} className="group">
                  <div
                    className="flex items-start gap-2.5 px-4 py-3 hover:bg-slate-800/30 cursor-pointer transition-colors"
                    onClick={() => toggleExpand(item.id)}
                  >
                    {/* Type icon */}
                    <div className={`mt-0.5 flex items-center justify-center w-5 h-5 rounded border text-[10px] shrink-0 ${TYPE_BADGE[item.type] ?? TYPE_BADGE.text}`}>
                      {TYPE_ICON[item.type] ?? TYPE_ICON.text}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-200 leading-snug line-clamp-2">{item.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                        {item.sourceUrl
                          ? <span className="truncate max-w-[160px]">{new URL(item.sourceUrl).hostname.replace("www.", "")}</span>
                          : <span className="capitalize">{item.type.replace("_", " ")}</span>}
                        {item.content && <span className="opacity-50">· {Math.round(item.content.length / 100) / 10}k</span>}
                      </p>
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {item.content && <CopyButton text={item.content} />}
                      <button
                        className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded"
                        onClick={(e) => handleDelete(item.id, e)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="shrink-0 ml-0.5 mt-0.5">
                      {expandedItems.has(item.id)
                        ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                        : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                    </div>
                  </div>

                  {expandedItems.has(item.id) && (
                    <div className="px-4 pb-3 bg-slate-900/40 border-t border-border/30">
                      {item.sourceUrl && (
                        <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] text-blue-400 hover:underline flex items-center gap-1 mt-2 mb-1.5 truncate">
                          <Globe className="w-2.5 h-2.5 shrink-0" />
                          {item.sourceUrl}
                        </a>
                      )}
                      {item.content && (
                        <p className="text-[11px] text-slate-400 leading-relaxed max-h-44 overflow-y-auto whitespace-pre-wrap">
                          {item.content.slice(0, 1800)}{item.content.length > 1800 ? "…" : ""}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Library footer */}
        {library.length > 0 && (
          <div className="px-4 py-2 border-t border-border bg-slate-950/40 text-[10px] text-muted-foreground flex justify-between items-center shrink-0">
            <span>{library.length} item{library.length !== 1 ? "s" : ""}</span>
            <span>{(library.reduce((acc, r) => acc + (r.content?.length ?? 0), 0) / 1000).toFixed(0)}k chars</span>
          </div>
        )}
      </div>

      {/* Generate Modal */}
      <GenerateModal
        open={showGenerate}
        onClose={() => setShowGenerate(false)}
        projectId={projectId}
        onApplied={() => setShowGenerate(false)}
      />
    </div>
  );
}
