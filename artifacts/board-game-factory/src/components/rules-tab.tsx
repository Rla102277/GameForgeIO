import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListRules, useCreateRule, useDeleteRule, useGetRulesSandboxHistory, useClearRulesSandboxHistory, getListRulesQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Trash2, Bot, User, Trash, Sparkles, Loader2, Check, ShieldAlert, AlertTriangle, Info, CheckCircle } from "lucide-react";

type AIRule = { title: string; content: string; category: string; priority?: number };

export default function RulesTab({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient();
  const { data: rules } = useListRules(projectId, { query: { enabled: !!projectId } });
  const createRule = useCreateRule();
  const deleteRule = useDeleteRule();

  const [newRule, setNewRule] = useState({ title: "", content: "", category: "movement", priority: 1 });
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiPrompt, setAIPrompt] = useState("");
  const [aiCount, setAICount] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedRules, setGeneratedRules] = useState<AIRule[]>([]);
  const [selectedRules, setSelectedRules] = useState<Set<number>>(new Set());
  const [conflictResult, setConflictResult] = useState<{ conflicts: { severity: string; title: string; description: string; resolution: string }[]; summary: string } | null>(null);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [showVariants, setShowVariants] = useState(false);

  const BASE = `${window.location.origin}/api`;

  const handleCheckConflicts = async () => {
    setCheckingConflicts(true);
    setConflictResult(null);
    try {
      const res = await fetch(`${BASE}/projects/${projectId}/rules/check-conflicts`, { method: "POST" });
      if (res.ok) setConflictResult(await res.json());
    } finally { setCheckingConflicts(false); }
  };

  const handleAIGenerate = async () => {
    setIsGenerating(true);
    setGeneratedRules([]);
    try {
      const res = await fetch(`${BASE}/projects/${projectId}/ai-generate-rules`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: aiCount, prompt: aiPrompt }),
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedRules(data);
        setSelectedRules(new Set(data.map((_: unknown, i: number) => i)));
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddSelectedRules = async () => {
    const toAdd = generatedRules.filter((_, i) => selectedRules.has(i));
    for (const rule of toAdd) {
      await new Promise<void>((resolve) => {
        createRule.mutate({ projectId, data: { title: rule.title, content: rule.content, category: rule.category, priority: rule.priority ?? 1 } }, {
          onSuccess: () => resolve(), onError: () => resolve(),
        });
      });
    }
    queryClient.invalidateQueries({ queryKey: getListRulesQueryKey(projectId) });
    setGeneratedRules([]);
    setShowAIPanel(false);
  };

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRule.title || !newRule.content) return;
    createRule.mutate({ projectId, data: newRule }, {
      onSuccess: () => {
        setNewRule({ title: "", content: "", category: "movement", priority: 1 });
        queryClient.invalidateQueries({ queryKey: getListRulesQueryKey(projectId) });
      }
    });
  };

  const getCategoryColor = (cat: string) => {
    switch(cat) {
      case 'movement': return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case 'combat': return "bg-red-500/20 text-red-400 border-red-500/30";
      case 'economy': return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case 'turn_structure': return "bg-gray-500/20 text-gray-400 border-gray-500/30";
      default: return "bg-primary/20 text-primary border-primary/30";
    }
  };

  return (
    <div className="flex h-full gap-6">
      <div className="w-1/2 flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Rules Library</h2>
          <div className="flex gap-2">
            <Button onClick={handleCheckConflicts} disabled={checkingConflicts} variant="outline" size="sm" className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
              {checkingConflicts ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldAlert className="w-3.5 h-3.5 mr-1" />}
              Check Conflicts
            </Button>
            <Button onClick={() => setShowAIPanel(!showAIPanel)} variant="outline" size="sm" className="border-primary/30 text-primary hover:bg-primary/10">
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              AI Generate
            </Button>
          </div>
        </div>

        {conflictResult && (
          <Card className="p-4 bg-card border-amber-500/20 border mb-4 shrink-0 space-y-2">
            <p className="text-xs font-medium text-amber-400 flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5" /> Conflict Analysis</p>
            <p className="text-xs text-muted-foreground italic">{conflictResult.summary}</p>
            {conflictResult.conflicts.length === 0 ? (
              <div className="flex items-center gap-1.5 text-emerald-400 text-xs"><CheckCircle className="w-3.5 h-3.5" /> No conflicts detected</div>
            ) : conflictResult.conflicts.map((c, i) => (
              <div key={i} className={`border rounded-lg p-2.5 text-xs space-y-1 ${c.severity === "critical" ? "border-red-500/30 bg-red-500/5" : c.severity === "warning" ? "border-amber-500/30 bg-amber-500/5" : "border-blue-500/30 bg-blue-500/5"}`}>
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${c.severity === "critical" ? "text-red-400" : c.severity === "warning" ? "text-amber-400" : "text-blue-400"}`} />
                  <span className="font-semibold text-white">{c.title}</span>
                  <Badge variant="outline" className="ml-auto text-[9px] capitalize">{c.severity}</Badge>
                </div>
                <p className="text-muted-foreground pl-5">{c.description}</p>
                <div className="flex items-start gap-1 text-muted-foreground/70 pl-5"><Info className="w-3 h-3 mt-0.5 shrink-0" /><span>Fix: {c.resolution}</span></div>
              </div>
            ))}
          </Card>
        )}

        {showAIPanel && (
          <Card className="p-4 bg-card border-primary/30 border mb-4 shrink-0 space-y-3">
            <p className="text-xs font-medium text-primary flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> AI Rule Generator</p>
            <div className="flex gap-2">
              <Textarea
                value={aiPrompt}
                onChange={e => setAIPrompt(e.target.value)}
                placeholder="Focus on specific aspects (e.g. combat mechanics, resource management)..."
                className="bg-input h-14 resize-none text-xs flex-1"
              />
              <div className="w-16 shrink-0 space-y-1">
                <Label className="text-xs">Count</Label>
                <Select value={aiCount.toString()} onValueChange={v => setAICount(parseInt(v))}>
                  <SelectTrigger className="h-8 bg-input text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{[3,5,8].map(n => <SelectItem key={n} value={n.toString()}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleAIGenerate} disabled={isGenerating} size="sm" className="w-full bg-primary text-primary-foreground">
              {isGenerating ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Generating...</> : <><Sparkles className="w-3.5 h-3.5 mr-1.5" />Generate</>}
            </Button>
            {generatedRules.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Select rules to add:</span>
                  <div className="flex gap-2">
                    <button className="text-primary hover:underline" onClick={() => setSelectedRules(new Set(generatedRules.map((_, i) => i)))}>All</button>
                    <button className="text-muted-foreground hover:underline" onClick={() => setSelectedRules(new Set())}>None</button>
                  </div>
                </div>
                <div className="space-y-1.5 max-h-52 overflow-y-auto">
                  {generatedRules.map((rule, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2 p-2.5 rounded border cursor-pointer text-xs transition-colors ${selectedRules.has(i) ? "border-primary/40 bg-primary/5" : "border-border bg-muted/10"}`}
                      onClick={() => setSelectedRules(prev => { const next = new Set(prev); if (next.has(i)) next.delete(i); else next.add(i); return next; })}
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 ${selectedRules.has(i) ? "border-primary bg-primary" : "border-border"}`}>
                        {selectedRules.has(i) && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                      </div>
                      <div>
                        <span className="font-medium text-white">{rule.title}</span>
                        <Badge variant="outline" className={`ml-2 text-[10px] ${getCategoryColor(rule.category)}`}>{rule.category}</Badge>
                        <p className="text-muted-foreground mt-0.5 line-clamp-2">{rule.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <Button onClick={handleAddSelectedRules} disabled={selectedRules.size === 0} size="sm" className="w-full bg-primary text-primary-foreground">
                  Add {selectedRules.size} Rules
                </Button>
              </div>
            )}
          </Card>
        )}

        <Card className="p-4 bg-card border-border mb-6 shrink-0">
          <form onSubmit={handleAddRule} className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Title</Label>
                <Input value={newRule.title} onChange={e => setNewRule({...newRule, title: e.target.value})} className="h-8 bg-input" placeholder="Rule title" />
              </div>
              <div className="w-32 space-y-1">
                <Label className="text-xs">Category</Label>
                <Select value={newRule.category} onValueChange={v => setNewRule({...newRule, category: v})}>
                  <SelectTrigger className="h-8 bg-input text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="movement">Movement</SelectItem>
                    <SelectItem value="combat">Combat</SelectItem>
                    <SelectItem value="economy">Economy</SelectItem>
                    <SelectItem value="turn_structure">Turn Structure</SelectItem>
                    <SelectItem value="variant">Variant / Optional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Content</Label>
              <Textarea 
                value={newRule.content} 
                onChange={e => setNewRule({...newRule, content: e.target.value})} 
                className="h-20 resize-none bg-input" 
                placeholder="Rule description..." 
              />
            </div>
            <Button type="submit" size="sm" className="w-full" disabled={createRule.isPending}>Add Rule</Button>
          </form>
        </Card>

        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {rules?.map(rule => (
            <Card key={rule.id} className="p-4 bg-card border-border relative group">
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={() => deleteRule.mutate({ projectId, id: rule.id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListRulesQueryKey(projectId) }) })}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className={getCategoryColor(rule.category || '')}>{rule.category}</Badge>
                <h4 className="font-semibold text-white text-sm">{rule.title}</h4>
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{rule.content}</p>
            </Card>
          ))}
          {rules?.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground border border-dashed border-border rounded-lg">
              No rules defined yet.
            </div>
          )}
        </div>
      </div>

      <div className="w-px bg-border my-2 shrink-0"></div>

      <div className="w-1/2 flex flex-col h-full overflow-hidden">
        <SandboxChat projectId={projectId} />
      </div>
    </div>
  );
}

function SandboxChat({ projectId }: { projectId: number }) {
  const { data: history, refetch } = useGetRulesSandboxHistory(projectId, { query: { enabled: !!projectId } });
  const clearHistory = useClearRulesSandboxHistory();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Array<{role: string, content: string, id: number}>>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (history) {
      setMessages(history);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [history]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    
    const userMsg = input;
    setInput("");
    
    // Add user msg optimistically
    const newMessages = [...messages, { role: "user", content: userMsg, id: Date.now() }];
    setMessages(newMessages);
    setIsStreaming(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/rules-sandbox`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg }),
      });

      if (!response.body) throw new Error("No body");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      let assistantMsg = "";
      setMessages([...newMessages, { role: "assistant", content: "", id: Date.now() + 1 }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(Boolean);
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '');
            if (dataStr === '[DONE]') continue;
            try {
              const data = JSON.parse(dataStr);
              if (data.content) {
                assistantMsg += data.content;
                setMessages(prev => {
                  const last = prev[prev.length - 1];
                  return [...prev.slice(0, -1), { ...last, content: assistantMsg }];
                });
                messagesEndRef.current?.scrollIntoView();
              }
            } catch (e) {
              console.error("Parse error chunk", e);
            }
          }
        }
      }
      refetch(); // Refresh to get proper DB IDs
    } catch (e) {
      console.error(e);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleClear = () => {
    if (confirm("Clear sandbox history?")) {
      clearHistory.mutate({ projectId }, {
        onSuccess: () => {
          setMessages([]);
          refetch();
        }
      });
    }
  };

  return (
    <div className="flex flex-col h-full border border-border bg-card rounded-xl overflow-hidden relative">
      <div className="p-3 border-b border-border bg-muted/20 flex justify-between items-center">
        <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
          <Bot className="w-4 h-4 text-primary" />
          AI Rules Sandbox
        </h3>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={handleClear} title="Clear Chat">
          <Trash className="w-3 h-3" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-2 opacity-50">
            <Bot className="w-12 h-12 text-primary" />
            <p className="text-sm">Ask the AI to test interactions, identify loopholes,<br/>or brainstorm new mechanics.</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={msg.id || i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div className={`max-w-[80%] rounded-lg p-3 text-sm ${msg.role === 'user' ? 'bg-primary/10 text-white' : 'bg-muted/30 text-muted-foreground'} whitespace-pre-wrap`}>
                {msg.content || <span className="animate-pulse">...</span>}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 border-t border-border bg-muted/10">
        <form onSubmit={handleSend} className="flex gap-2">
          <Input 
            value={input} 
            onChange={e => setInput(e.target.value)} 
            placeholder="Test a scenario..." 
            className="flex-1 bg-input"
            disabled={isStreaming}
          />
          <Button type="submit" disabled={isStreaming || !input.trim()} className="shrink-0 px-3">
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
