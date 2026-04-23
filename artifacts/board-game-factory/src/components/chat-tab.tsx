import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sparkles, Send, Loader2, Trash2, BookmarkPlus, Check,
  MessageSquare, RotateCcw, ChevronDown,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Role = "user" | "assistant";
type Message = { id: string; role: Role; content: string; savedAsNote?: boolean };

const uid = () => Math.random().toString(36).slice(2);

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[72%] rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap shadow-sm">
        {content}
      </div>
    </div>
  );
}

function AssistantBubble({ msg, onSaveNote }: { msg: Message; onSaveNote: (id: string, content: string) => void }) {
  // Render markdown-ish: bold, bullet lists, code
  const rendered = msg.content
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, '<code class="bg-white/10 px-1 py-0.5 rounded text-[11px] font-mono">$1</code>');

  return (
    <div className="flex justify-start gap-3">
      <div className="w-7 h-7 rounded-full bg-violet-600/30 border border-violet-500/40 flex items-center justify-center shrink-0 mt-1">
        <Sparkles className="w-3.5 h-3.5 text-violet-400" />
      </div>
      <div className="max-w-[78%] space-y-2">
        <div className="rounded-2xl rounded-tl-sm bg-slate-800/80 border border-slate-700/60 px-4 py-3 text-sm text-slate-200 leading-relaxed shadow-sm">
          {msg.content
            ? <div dangerouslySetInnerHTML={{ __html: rendered }} className="space-y-1 [&_ul]:pl-4 [&_li]:list-disc [&_li]:my-0.5 [&_strong]:text-white [&_strong]:font-semibold" />
            : <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <Loader2 className="w-3 h-3 animate-spin" /> Thinking…
              </span>
          }
        </div>
        {msg.content && (
          <button
            onClick={() => onSaveNote(msg.id, msg.content)}
            disabled={msg.savedAsNote}
            className={`flex items-center gap-1 text-[11px] transition-colors pl-1 ${
              msg.savedAsNote
                ? "text-emerald-400 cursor-default"
                : "text-muted-foreground hover:text-emerald-400"
            }`}
          >
            {msg.savedAsNote
              ? <><Check className="w-3 h-3" /> Saved as note</>
              : <><BookmarkPlus className="w-3 h-3" /> Save as note</>}
          </button>
        )}
      </div>
    </div>
  );
}

const STARTERS = [
  "What are the weakest parts of my current ruleset?",
  "How can I make the early game more tense?",
  "Suggest a catch-up mechanic based on my notes.",
  "What synergies exist between my entities?",
  "What's missing from my game that my notes hint at?",
  "How can I reduce player downtime?",
];

export default function ChatTab({ projectId }: { projectId: number }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [showScroll, setShowScroll] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { toast } = useToast();
  const BASE = `${window.location.origin}/api`;

  const scrollToBottom = useCallback((smooth = true) => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: smooth ? "smooth" : "instant" });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = () => {
      const near = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      setShowScroll(!near);
    };
    el.addEventListener("scroll", handler);
    return () => el.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    if (!showScroll) scrollToBottom(false);
  }, [messages, showScroll, scrollToBottom]);

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || streaming) return;
    setInput("");

    const userMsg: Message = { id: uid(), role: "user", content };
    const assistantMsg: Message = { id: uid(), role: "assistant", content: "" };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setStreaming(true);
    setTimeout(() => scrollToBottom(), 50);

    const history = [
      ...messages.map(m => ({ role: m.role, content: m.content })),
      { role: "user" as const, content },
    ];

    abortRef.current = new AbortController();
    try {
      const res = await fetch(`${BASE}/projects/${projectId}/notes/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) throw new Error("Chat request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              accumulated += parsed.text;
              const snap = accumulated;
              setMessages(prev =>
                prev.map(m => m.id === assistantMsg.id ? { ...m, content: snap } : m)
              );
            }
          } catch { /* ignore malformed */ }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        toast({ title: "Chat failed", description: "Could not reach AI.", variant: "destructive" });
        setMessages(prev => prev.filter(m => m.id !== assistantMsg.id));
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  };

  const saveAsNote = async (msgId: string, content: string) => {
    const snippet = content.slice(0, 80).replace(/\n/g, " ");
    await fetch(`${BASE}/projects/${projectId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: snippet + (content.length > 80 ? "…" : ""), content, color: "purple" }),
    });
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, savedAsNote: true } : m));
    toast({ title: "Saved as note" });
  };

  const clearChat = () => {
    if (streaming) { abortRef.current?.abort(); }
    setMessages([]);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border/50 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-violet-600/30 border border-violet-500/40 flex items-center justify-center">
            <MessageSquare className="w-3.5 h-3.5 text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Design Chat</p>
            <p className="text-[11px] text-muted-foreground">AI knows your notes, rules & entities — iterate freely</p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button size="sm" variant="ghost" onClick={clearChat}
            className="h-8 text-xs text-muted-foreground hover:text-white gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" /> New chat
          </Button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-5 space-y-5 relative">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6 pb-12">
            <div className="w-14 h-14 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-violet-400" />
            </div>
            <div className="text-center">
              <p className="text-white font-semibold text-base mb-1">Start iterating</p>
              <p className="text-sm text-muted-foreground max-w-xs">
                Chat with your AI design partner. It knows your notes, rules, and entities and is ready to help.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {STARTERS.map(s => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="text-left px-4 py-3 rounded-xl border border-border/60 bg-muted/10 hover:bg-muted/30 hover:border-violet-500/40 transition-all text-sm text-slate-300 hover:text-white"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg =>
          msg.role === "user"
            ? <UserBubble key={msg.id} content={msg.content} />
            : <AssistantBubble key={msg.id} msg={msg} onSaveNote={saveAsNote} />
        )}

        {/* Scroll-to-bottom pill */}
        {showScroll && (
          <button
            onClick={() => scrollToBottom()}
            className="fixed bottom-32 right-10 z-10 flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-700 border border-slate-600 text-xs text-white shadow-lg hover:bg-slate-600 transition-all"
          >
            <ChevronDown className="w-3.5 h-3.5" /> Latest
          </button>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 px-6 py-4 border-t border-border/50 bg-background/50">
        <div className="relative flex items-end gap-3 max-w-4xl mx-auto">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your game design… (Enter to send, Shift+Enter for new line)"
            className="flex-1 bg-slate-800/60 border-slate-700 resize-none min-h-[52px] max-h-[200px] text-sm pr-14 py-3.5 rounded-xl"
            disabled={streaming}
            rows={1}
          />
          <Button
            onClick={() => sendMessage()}
            disabled={!input.trim() || streaming}
            className="absolute right-2 bottom-2 h-9 w-9 p-0 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40"
          >
            {streaming
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground/50 text-center mt-2">
          Responses are aware of your current notes, rules, and entities.
        </p>
      </div>
    </div>
  );
}
