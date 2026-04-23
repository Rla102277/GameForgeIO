import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useUser, useAuth } from "@clerk/react";
import { useListProjects } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Bot, Eye, EyeOff, Check, Loader2, Cpu, Zap, Sparkles, Crown
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

interface AIProviderModel { id: string; label: string; note: string }
interface AIProviderInfo { label: string; description: string; models: AIProviderModel[] }
interface AccountSettings {
  provider: string;
  model: string;
  hasEnvAnthropicKey: boolean;
  anthropicKeyHint: string | null;
  openaiKeyHint: string | null;
  geminiKeyHint: string | null;
  xaiKeyHint: string | null;
  providers: Record<string, AIProviderInfo>;
}

const PROVIDER_ICONS: Record<string, React.ReactNode> = {
  anthropic: <Cpu className="h-5 w-5 text-orange-400" />,
  gemini: <Sparkles className="h-5 w-5 text-blue-400" />,
  openai: <Bot className="h-5 w-5 text-green-400" />,
  xai: <Zap className="h-5 w-5 text-purple-400" />,
};

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "border-orange-500/40 bg-orange-500/5",
  gemini: "border-blue-500/40 bg-blue-500/5",
  openai: "border-green-500/40 bg-green-500/5",
  xai: "border-purple-500/40 bg-purple-500/5",
};

const KEY_FIELD: Record<string, string> = {
  anthropic: "anthropicApiKey",
  gemini: "geminiApiKey",
  openai: "openaiApiKey",
  xai: "xaiApiKey",
};

const KEY_HINT_FIELD: Record<string, keyof AccountSettings> = {
  anthropic: "anthropicKeyHint",
  gemini: "geminiKeyHint",
  openai: "openaiKeyHint",
  xai: "xaiKeyHint",
};

export default function AccountPage() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const { toast } = useToast();
  const { data: projects } = useListProjects();

  const [settings, setSettings] = useState<AccountSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedProvider, setSelectedProvider] = useState("anthropic");
  const [selectedModel, setSelectedModel] = useState("claude-haiku-4-5");
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  async function authFetch(url: string, options: RequestInit = {}) {
    const token = await getToken();
    return fetch(url, {
      ...options,
      credentials: "include",
      headers: {
        ...(options.headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  }

  useEffect(() => {
    authFetch(`${API}/account/settings`)
      .then(r => r.json())
      .then((data: AccountSettings) => {
        setSettings(data);
        setSelectedProvider(data.provider);
        setSelectedModel(data.model);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveSettings() {
    setSaving(true);
    try {
      const body: Record<string, string> = {
        provider: selectedProvider,
        model: selectedModel,
      };
      for (const [provider, field] of Object.entries(KEY_FIELD)) {
        if (keyInputs[provider] !== undefined) {
          body[field] = keyInputs[provider];
        }
      }
      const res = await authFetch(`${API}/account/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Save failed");
      toast({ title: "Settings saved", description: "Your AI provider preferences are updated." });
      const refreshed = await authFetch(`${API}/account/settings`).then(r => r.json());
      setSettings(refreshed);
      setKeyInputs({});
    } catch {
      toast({ title: "Save failed", description: "Could not update settings.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const providers = settings?.providers ?? {};

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/80 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-sm font-medium">Account Settings</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-10">
        {/* Profile */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">Profile</h2>
          <Card className="bg-card border-border">
            <CardContent className="pt-6 flex items-center gap-5">
              <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-xl font-bold text-primary-foreground shrink-0">
                {(user?.fullName || user?.primaryEmailAddress?.emailAddress || "U")
                  .split(/\s|@/).filter(Boolean).slice(0, 2).map((s: string) => s[0].toUpperCase()).join("")}
              </div>
              <div>
                <p className="font-semibold text-foreground">{user?.fullName || "User"}</p>
                <p className="text-sm text-muted-foreground">{user?.primaryEmailAddress?.emailAddress}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Member since {user?.createdAt ? format(new Date(user.createdAt), "MMMM yyyy") : "—"}
                </p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-sm font-semibold text-foreground">{projects?.length ?? 0}</p>
                <p className="text-xs text-muted-foreground">Projects</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* AI Configuration */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">AI Configuration</h2>
            {!loading && settings && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Active:</span>
                <span className="font-medium text-foreground">
                  {providers[settings.provider]?.label ?? settings.provider} · {settings.model}
                </span>
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading settings…</span>
            </div>
          ) : (
            <div className="grid gap-4">
              {Object.entries(providers).map(([providerId, info]) => {
                const isActive = selectedProvider === providerId;
                const hint = settings ? (settings[KEY_HINT_FIELD[providerId]] as string | null) : null;
                const hasKey = !!hint || (providerId === "anthropic" && settings?.hasEnvAnthropicKey);
                const isSharedKey = hint?.includes("shared key");

                return (
                  <Card
                    key={providerId}
                    className={`border transition-all cursor-pointer ${
                      isActive
                        ? PROVIDER_COLORS[providerId]
                        : "border-border bg-card hover:border-border/80"
                    }`}
                    onClick={() => {
                      setSelectedProvider(providerId);
                      const firstModel = info.models[0]?.id;
                      if (firstModel) setSelectedModel(firstModel);
                    }}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${isActive ? "bg-background/80" : "bg-muted/50"}`}>
                            {PROVIDER_ICONS[providerId]}
                          </div>
                          <div>
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                              {info.label}
                              {isActive && <Check className="h-3.5 w-3.5 text-cyan-400" />}
                            </CardTitle>
                            <CardDescription className="text-xs mt-0.5">{info.description}</CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {hasKey && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              isSharedKey ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "bg-green-500/10 text-green-400 border border-green-500/20"
                            }`}>
                              {isSharedKey ? "Shared key" : "Key set"}
                            </span>
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    {isActive && (
                      <CardContent className="pt-0 space-y-4" onClick={e => e.stopPropagation()}>
                        {/* Model selector */}
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Model</Label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {info.models.map(model => (
                              <button
                                key={model.id}
                                onClick={() => setSelectedModel(model.id)}
                                className={`flex items-start gap-2.5 p-3 rounded-lg border text-left transition-all ${
                                  selectedModel === model.id
                                    ? "border-cyan-500/50 bg-cyan-500/10"
                                    : "border-border bg-muted/30 hover:bg-muted/50"
                                }`}
                              >
                                <div className={`mt-0.5 w-3.5 h-3.5 rounded-full border-2 shrink-0 flex items-center justify-center ${
                                  selectedModel === model.id ? "border-cyan-400" : "border-muted-foreground/40"
                                }`}>
                                  {selectedModel === model.id && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
                                </div>
                                <div>
                                  <div className="text-xs font-medium text-foreground">{model.label}</div>
                                  <div className="text-xs text-muted-foreground mt-0.5">{model.note}</div>
                                </div>
                                {model.note.toLowerCase().includes("default") && (
                                  <Crown className="h-3 w-3 text-amber-400 ml-auto mt-0.5 shrink-0" />
                                )}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* API Key */}
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">
                            API Key
                            {hint && (
                              <span className="ml-2 text-muted-foreground/60">
                                Current: {hint}
                              </span>
                            )}
                          </Label>
                          <div className="relative">
                            <Input
                              type={showKeys[providerId] ? "text" : "password"}
                              value={keyInputs[providerId] ?? ""}
                              onChange={e => setKeyInputs(prev => ({ ...prev, [providerId]: e.target.value }))}
                              placeholder={
                                providerId === "anthropic" && settings?.hasEnvAnthropicKey
                                  ? "Using shared server key — paste yours to override"
                                  : `Paste your ${info.label} API key`
                              }
                              className="bg-background border-border text-foreground pr-10 font-mono text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => setShowKeys(prev => ({ ...prev, [providerId]: !prev[providerId] }))}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                              {showKeys[providerId] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                          <p className="text-xs text-muted-foreground/60">
                            {providerId === "anthropic" && "console.anthropic.com → API Keys"}
                            {providerId === "gemini" && "aistudio.google.com → Get API key"}
                            {providerId === "openai" && "platform.openai.com → API keys"}
                            {providerId === "xai" && "console.x.ai → API keys"}
                          </p>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          {!loading && (
            <div className="mt-6 flex justify-end">
              <Button onClick={saveSettings} disabled={saving} className="gap-2 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save Settings
              </Button>
            </div>
          )}
        </section>

        {/* Recent Projects */}
        {projects && projects.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">Your Projects</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {projects.map(p => (
                <Link key={p.id} href={`/projects/${p.id}`}>
                  <Card className="bg-card border-border hover:border-cyan-500/30 transition-all cursor-pointer group">
                    <CardContent className="pt-4 pb-4">
                      <p className="font-medium text-sm text-foreground group-hover:text-cyan-400 transition-colors truncate">
                        {p.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{p.genre || "Board Game"}</p>
                      <p className="text-xs text-muted-foreground/60 mt-2">
                        {p.updatedAt ? format(new Date(p.updatedAt), "MMM d, yyyy") : "—"}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
