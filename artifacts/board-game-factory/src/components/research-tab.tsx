import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Send, Trash2, Globe, FileText, Bot, User, Loader2,
  BookOpen, Plus, ChevronDown, ChevronRight, Link2, Sparkles, X,
} from "lucide-react";

type ResearchItem = {
  id: number; title: string; content?: string; sourceUrl?: string;
  type: string; tags?: string[]; createdAt: string;
};
type Message = { role: "user" | "assistant"; content: string; savedItem?: ResearchItem | null };

const TYPE_ICON: Record<string, React.ReactNode> = {
  url: <Globe className="w-3.5 h-3.5 text-blue-400" />,
  file: <FileText className="w-3.5 h-3.5 text-green-400" />,
  ai_note: <Sparkles className="w-3.5 h-3.5 text-violet-400" />,
  text: <FileText className="w-3.5 h-3.5 text-muted-foreground" />,
};

const EXAMPLE_PROMPTS = [
  "Fetch https://boardgamegeek.com/boardgame/174430/gloomhaven and summarize its core mechanics",
  "What are the key economic mechanics in worker placement games?",
  "Fetch https://en.wikipedia.org/wiki/Catan and extract reusable design patterns",
  "What makes a good resource-trading mechanic for 3-5 players?",
  "Summarize the most important deck-building mechanics from modern games",
];

export default function ResearchTab({ projectId }: { projectId: number }) {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: `Welcome to the Research Lab! I'm your AI research assistant. I can:\n\n• Fetch and analyze any URL (rulebooks, game pages, Wikipedia articles)\n• Summarize game mechanics and design patterns\n• Extract reusable ideas for your game\n• Automatically save useful findings to your library\n\nTry pasting a URL or asking me to research a specific topic.` },
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

    const newHistory = [...messages.filter(m => m.role !== "assistant" || messages.indexOf(m) > 0)];
    const historyForAPI = newHistory.map(m => ({ role: m.role, content: m.content }));

    setMessages(prev => [...prev, { role: "user", content: msg }]);
    setIsStreaming(true);

    let assistantMsg = "";
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);

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
              setMessages(prev => {
                const next = [...prev];
                next[next.length - 1] = { role: "assistant", content: assistantMsg };
                return next;
              });
            }
            if (data.savedItem) savedItem = data.savedItem;
          } catch { /* ignore */ }
        }
      }

      if (savedItem) {
        setMessages(prev => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: assistantMsg, savedItem };
          return next;
        });
        loadLibrary();
      }
    } catch (e) {
      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", content: `Error: ${e instanceof Error ? e.message : String(e)}` };
        return next;
      });
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
      if (res.ok) { setUrlInput(""); loadLibrary(); }
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

  const handleDelete = async (id: number) => {
    await fetch(`${BASE}/projects/${projectId}/research-items/${id}`, { method: "DELETE" });
    loadLibrary();
  };

  const toggleExpand = (id: number) => {
    setExpandedItems(prev => { const s = new Set(prev); if (s.has(id)) s.delete(id); else s.add(id); return s; });
  };

  // Clean up <save_research> tags from display
  const cleanContent = (text: string) =>
    text.replace(/<save_research>[\s\S]*?<\/save_research>/g, "").trim();

  return (
    <div className="flex gap-5 h-[calc(100vh-180px)] min-h-[600px] max-w-7xl mx-auto">

      {/* ── LEFT: AI Chat ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xl font-bold text-white">Research Lab</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Ask the AI to research topics, fetch URLs, and extract game design insights</p>
          </div>
          <Badge variant="outline" className="text-muted-foreground border-border text-xs">
            {library.length} items in library
          </Badge>
        </div>

        {/* Message area */}
        <Card className="flex-1 flex flex-col bg-card border-border overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0 mt-1">
                    <Bot className="w-3.5 h-3.5 text-primary" />
                  </div>
                )}
                <div className={`max-w-[85%] space-y-1 ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col`}>
                  <div className={`rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-muted/30 border border-border text-foreground rounded-tl-sm"
                  }`}>
                    {cleanContent(msg.content)}
                    {isStreaming && i === messages.length - 1 && msg.role === "assistant" && (
                      <span className="inline-block w-1.5 h-4 bg-primary/60 animate-pulse ml-0.5 rounded-sm" />
                    )}
                  </div>
                  {msg.savedItem && (
                    <div className="flex items-center gap-1.5 text-xs text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded-md px-2.5 py-1.5">
                      <Sparkles className="w-3 h-3" />
                      Saved to library: "{msg.savedItem.title}"
                    </div>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="w-7 h-7 rounded-full bg-muted/40 border border-border flex items-center justify-center shrink-0 mt-1">
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Example prompts */}
          {messages.length <= 1 && (
            <div className="px-4 pb-3">
              <p className="text-xs text-muted-foreground mb-2">Try asking:</p>
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLE_PROMPTS.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(p)}
                    className="text-xs bg-muted/20 border border-border rounded-md px-2.5 py-1.5 text-muted-foreground hover:text-white hover:border-primary/40 transition-colors text-left"
                  >
                    {p.length > 60 ? p.slice(0, 60) + "…" : p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Ask me to research something, or paste a URL to fetch and analyze..."
                className="bg-input resize-none min-h-[60px] max-h-[120px] text-sm flex-1"
                disabled={isStreaming}
              />
              <Button
                onClick={() => handleSend()}
                disabled={isStreaming || !input.trim()}
                className="bg-primary text-primary-foreground self-end"
                size="icon"
              >
                {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground/60 mt-1.5">Shift+Enter for newline · URLs in messages are automatically fetched</p>
          </div>
        </Card>
      </div>

      {/* ── RIGHT: Research Library ──────────────────────────────────────── */}
      <div className="w-[360px] shrink-0 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Research Library</h3>
          <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground hover:text-white" onClick={() => setShowAddNote(!showAddNote)}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Note
          </Button>
        </div>

        {/* Add note form */}
        {showAddNote && (
          <Card className="bg-card border-border mb-3 p-3 space-y-2">
            <Input
              value={noteTitle} onChange={e => setNoteTitle(e.target.value)}
              placeholder="Note title..."
              className="bg-input h-8 text-sm"
            />
            <Textarea
              value={noteContent} onChange={e => setNoteContent(e.target.value)}
              placeholder="Note content..."
              className="bg-input text-sm h-20 resize-none"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddNote} disabled={isAddingNote || !noteTitle.trim()} className="bg-primary text-primary-foreground h-7 text-xs flex-1">
                Save Note
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAddNote(false)} className="h-7 text-xs text-muted-foreground">
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </Card>
        )}

        {/* URL Quick Fetch */}
        <div className="flex gap-1.5 mb-3">
          <div className="relative flex-1">
            <Globe className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleFetchUrl()}
              placeholder="https://... quick fetch to library"
              className="pl-8 bg-input h-8 text-xs"
            />
          </div>
          <Button size="sm" variant="outline" className="h-8 px-2.5 shrink-0 border-border text-muted-foreground hover:text-white" onClick={handleFetchUrl} disabled={isFetchingUrl || !urlInput.trim()}>
            {isFetchingUrl ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
          </Button>
        </div>

        {/* Library list */}
        <Card className="flex-1 bg-card border-border overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto">
            {library.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 text-muted-foreground">
                <BookOpen className="w-8 h-8 mb-3 opacity-30" />
                <p className="text-sm">Your research library is empty.</p>
                <p className="text-xs mt-1 opacity-70">Ask the AI to research topics, or fetch URLs — items will be saved here automatically.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {library.map(item => (
                  <div key={item.id} className="group">
                    <div
                      className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-muted/10 cursor-pointer"
                      onClick={() => toggleExpand(item.id)}
                    >
                      <div className="mt-0.5 shrink-0">{TYPE_ICON[item.type] ?? TYPE_ICON.text}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white leading-tight truncate">{item.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {item.sourceUrl ? new URL(item.sourceUrl).hostname : item.type}
                          {item.content ? ` · ${(item.content.length / 1000).toFixed(1)}k chars` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {expandedItems.has(item.id)
                          ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                          : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                        <button
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                          onClick={e => { e.stopPropagation(); handleDelete(item.id); }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    {expandedItems.has(item.id) && item.content && (
                      <div className="px-3 pb-3 bg-muted/5 border-t border-border/50">
                        {item.sourceUrl && (
                          <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:underline block mt-2 mb-1.5 truncate">
                            {item.sourceUrl}
                          </a>
                        )}
                        <p className="text-[11px] text-muted-foreground leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap font-mono">
                          {item.content.slice(0, 2000)}{item.content.length > 2000 ? "…" : ""}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          {library.length > 0 && (
            <div className="px-3 py-2 border-t border-border bg-muted/5 text-[10px] text-muted-foreground">
              {library.length} item{library.length !== 1 ? "s" : ""} · {(library.reduce((acc, r) => acc + (r.content?.length ?? 0), 0) / 1000).toFixed(0)}k chars total
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
