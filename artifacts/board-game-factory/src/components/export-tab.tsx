import { useState } from "react";
import { useExportRulebook, useExportTabletopSimulator, useGetProject } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Download, FileText, Box, BookOpen, Copy, Check, ExternalLink,
  Sparkles, Loader2, Printer, DollarSign, Gift, Star, HelpCircle,
  ChevronDown, ChevronUp, Newspaper, Briefcase,
} from "lucide-react";

type PressKit = {
  boxCopy?: string; bggDescription?: string; pressRelease?: string;
  socialPosts?: { twitter?: string; instagram?: string; reddit?: string };
  reviewerPitch?: string; keyFeatures?: string[];
  specs?: Record<string, string>;
};

type PublisherPitch = {
  headline?: string; hook?: string; gameInOneSentence?: string;
  mechanicPillars?: string[]; targetAudience?: string; marketComparisons?: string;
  whyItWorks?: string[]; designerStatement?: string;
  productionNotes?: string; timeline?: string; contactBlock?: string;
};

type KSCampaign = {
  tagline?: string;
  elevatorPitch?: string;
  story?: string;
  whatsInTheBox?: { item: string; quantity: string; description: string }[];
  howToPlay?: string;
  pledgeTiers?: { name: string; price: number; items: string[]; description: string }[];
  stretchGoals?: { amount: number; title: string; description: string }[];
  faq?: { question: string; answer: string }[];
  risks?: string;
  closingStatement?: string;
};

export default function ExportTab({ projectId }: { projectId: number }) {
  const { data: rulebook, isLoading: isLoadingRulebook } = useExportRulebook(projectId, { query: { enabled: !!projectId } });
  const { data: ttsExport, isLoading: isLoadingTTS } = useExportTabletopSimulator(projectId, { query: { enabled: !!projectId } });
  const { data: project } = useGetProject(projectId, { query: { enabled: !!projectId } });

  const [copied, setCopied] = useState(false);
  const [isGeneratingKS, setIsGeneratingKS] = useState(false);
  const [ksStream, setKsStream] = useState("");
  const [ksCampaign, setKsCampaign] = useState<KSCampaign | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["tagline", "tiers", "stretch"]));
  const [isGeneratingPressKit, setIsGeneratingPressKit] = useState(false);
  const [pressKit, setPressKit] = useState<PressKit | null>(null);
  const [pressKitStream, setPressKitStream] = useState("");
  const [pressKitTab, setPressKitTab] = useState("bgg");
  const [isGeneratingPitch, setIsGeneratingPitch] = useState(false);
  const [pitch, setPitch] = useState<PublisherPitch | null>(null);

  const BASE = `${window.location.origin}/api`;
  const notebookLMUrl = `${BASE}/projects/${projectId}/notebooklm`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(notebookLMUrl);
    } catch {
      const el = document.createElement("textarea");
      el.value = notebookLMUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadRulebook = () => {
    if (!rulebook) return;
    const title = (project as { name?: string } | undefined)?.name ?? "game";
    const blob = new Blob([rulebook.markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, "-")}-rulebook.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadTTS = () => {
    if (!ttsExport) return;
    const blob = new Blob([JSON.stringify(ttsExport, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tts-export-${projectId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGenerateKickstarter = async () => {
    setIsGeneratingKS(true);
    setKsStream("");
    setKsCampaign(null);

    let fullText = "";
    try {
      const res = await fetch(`${BASE}/projects/${projectId}/kickstarter/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.body) throw new Error("No response body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.content) { fullText += data.content; setKsStream(fullText); }
            if (data.done && data.campaign) setKsCampaign(data.campaign);
            if (data.done && data.raw && !data.campaign) {
              try {
                const clean = data.raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
                setKsCampaign(JSON.parse(clean));
              } catch { /* ignore */ }
            }
          } catch { /* ignore */ }
        }
      }
    } finally {
      setIsGeneratingKS(false);
    }
  };

  const handlePrintKickstarter = () => {
    if (!ksCampaign) return;
    const campaignParam = encodeURIComponent(JSON.stringify(ksCampaign));
    window.open(`${BASE}/projects/${projectId}/kickstarter-print?campaign=${campaignParam}`, "_blank");
  };

  const handleGeneratePressKit = async () => {
    setIsGeneratingPressKit(true);
    setPressKit(null);
    setPressKitStream("");
    let fullText = "";
    try {
      const res = await fetch(`${BASE}/projects/${projectId}/press-kit/generate`, { method: "POST" });
      if (!res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.content) { fullText += data.content; setPressKitStream(fullText); }
            if (data.done && data.pressKit) setPressKit(data.pressKit);
          } catch { /* ignore */ }
        }
      }
    } finally { setIsGeneratingPressKit(false); }
  };

  const handleGeneratePitch = async () => {
    setIsGeneratingPitch(true);
    setPitch(null);
    let fullText = "";
    try {
      const res = await fetch(`${BASE}/projects/${projectId}/publisher-pitch/generate`, { method: "POST" });
      if (!res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.done && data.pitch) setPitch(data.pitch);
          } catch { /* ignore */ }
        }
      }
    } finally { setIsGeneratingPitch(false); }
  };

  const handlePrintPitch = () => {
    if (!pitch) return;
    const pitchParam = encodeURIComponent(JSON.stringify(pitch));
    window.open(`${BASE}/projects/${projectId}/publisher-pitch-print?pitch=${pitchParam}`, "_blank");
  };

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const s = new Set(prev);
      if (s.has(key)) s.delete(key); else s.add(key);
      return s;
    });
  };

  const SectionHeader = ({ id, icon: Icon, title, count }: { id: string; icon: React.ElementType; title: string; count?: number }) => (
    <button
      className="w-full flex items-center justify-between py-2 text-left"
      onClick={() => toggleSection(id)}
    >
      <div className="flex items-center gap-2 font-semibold text-white text-sm">
        <Icon className="w-4 h-4 text-primary" />
        {title}
        {count !== undefined && <Badge variant="outline" className="text-xs h-4 px-1.5 text-muted-foreground border-border">{count}</Badge>}
      </div>
      {expandedSections.has(id) ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
    </button>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Export & Distribution</h2>
        <p className="text-muted-foreground text-sm">Take your game design out of the factory and onto the table.</p>
      </div>

      {/* ── Kickstarter Generator ── */}
      <Card className="bg-card border-border border-primary/20">
        <CardHeader className="border-b border-border py-4 px-5">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-white text-base">
                <Sparkles className="w-4 h-4 text-primary" />
                Kickstarter Campaign Generator
              </CardTitle>
              <CardDescription className="mt-1">
                AI writes your full campaign — pitch, components list, pledge tiers, stretch goals, FAQ, and more.
              </CardDescription>
            </div>
            {ksCampaign && (
              <Button
                onClick={handlePrintKickstarter}
                size="sm"
                variant="outline"
                className="shrink-0 border-primary/30 text-primary hover:bg-primary/10 gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Campaign
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-5">
          <Button
            onClick={handleGenerateKickstarter}
            disabled={isGeneratingKS}
            className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            {isGeneratingKS
              ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Generating Campaign Copy...</>
              : <><Sparkles className="w-4 h-4 mr-2" />{ksCampaign ? "Regenerate Campaign" : "Generate Kickstarter Campaign"}</>}
          </Button>

          {isGeneratingKS && ksStream && !ksCampaign && (
            <div className="bg-muted/20 rounded-lg p-4 border border-border max-h-40 overflow-y-auto">
              <p className="text-xs text-muted-foreground font-mono whitespace-pre-wrap">{ksStream.slice(-1500)}</p>
            </div>
          )}

          {ksCampaign && (
            <div className="space-y-0 divide-y divide-border border border-border rounded-xl overflow-hidden">

              {/* Tagline + Pitch */}
              <div className="px-4 py-3 bg-primary/5">
                <SectionHeader id="tagline" icon={Star} title="Pitch" />
                {expandedSections.has("tagline") && (
                  <div className="space-y-3 mt-2">
                    {ksCampaign.tagline && (
                      <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-3 text-center">
                        <p className="text-primary font-bold text-lg italic">"{ksCampaign.tagline}"</p>
                      </div>
                    )}
                    {ksCampaign.elevatorPitch && (
                      <p className="text-sm text-white leading-relaxed">{ksCampaign.elevatorPitch}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Story */}
              {ksCampaign.story && (
                <div className="px-4 py-3">
                  <SectionHeader id="story" icon={BookOpen} title="Our Story" />
                  {expandedSections.has("story") && (
                    <div className="mt-2 space-y-2">
                      {ksCampaign.story.split("\n\n").map((p, i) => (
                        <p key={i} className="text-sm text-muted-foreground leading-relaxed">{p}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* What's in the Box */}
              {ksCampaign.whatsInTheBox && ksCampaign.whatsInTheBox.length > 0 && (
                <div className="px-4 py-3">
                  <SectionHeader id="box" icon={Box} title="What's in the Box" count={ksCampaign.whatsInTheBox.length} />
                  {expandedSections.has("box") && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {ksCampaign.whatsInTheBox.map((c, i) => (
                        <div key={i} className="bg-muted/20 border border-border rounded-lg p-2.5">
                          <div className="text-[10px] text-green-400 font-bold uppercase tracking-wider">{c.quantity}</div>
                          <div className="text-sm font-medium text-white">{c.item}</div>
                          {c.description && <div className="text-xs text-muted-foreground mt-0.5">{c.description}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* How to Play */}
              {ksCampaign.howToPlay && (
                <div className="px-4 py-3">
                  <SectionHeader id="play" icon={FileText} title="How to Play" />
                  {expandedSections.has("play") && (
                    <div className="mt-2 space-y-2">
                      {ksCampaign.howToPlay.split("\n\n").map((p, i) => (
                        <p key={i} className="text-sm text-muted-foreground leading-relaxed">{p}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Pledge Tiers */}
              {ksCampaign.pledgeTiers && ksCampaign.pledgeTiers.length > 0 && (
                <div className="px-4 py-3">
                  <SectionHeader id="tiers" icon={DollarSign} title="Pledge Tiers" count={ksCampaign.pledgeTiers.length} />
                  {expandedSections.has("tiers") && (
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      {ksCampaign.pledgeTiers.map((tier, i) => (
                        <div key={i} className={`border rounded-xl p-3.5 ${i === 1 ? "border-primary/40 bg-primary/5" : "border-border bg-muted/10"}`}>
                          <div className="text-2xl font-bold text-white">${tier.price}</div>
                          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">{tier.name}</div>
                          <ul className="space-y-0.5 mb-2">
                            {tier.items.map((item, j) => (
                              <li key={j} className="text-xs text-muted-foreground flex items-start gap-1.5">
                                <span className="text-primary mt-0.5">•</span>
                                {item}
                              </li>
                            ))}
                          </ul>
                          <p className="text-[11px] text-muted-foreground/70 italic">{tier.description}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Stretch Goals */}
              {ksCampaign.stretchGoals && ksCampaign.stretchGoals.length > 0 && (
                <div className="px-4 py-3">
                  <SectionHeader id="stretch" icon={Gift} title="Stretch Goals" count={ksCampaign.stretchGoals.length} />
                  {expandedSections.has("stretch") && (
                    <div className="space-y-1.5 mt-2">
                      {ksCampaign.stretchGoals.map((g, i) => (
                        <div key={i} className="flex items-center gap-3 bg-muted/10 border border-border rounded-lg px-3 py-2.5">
                          <div className="text-sm font-bold text-green-400 font-mono w-20 shrink-0">${(g.amount / 1000).toFixed(0)}k</div>
                          <div>
                            <div className="text-sm font-medium text-white">{g.title}</div>
                            <div className="text-xs text-muted-foreground">{g.description}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* FAQ */}
              {ksCampaign.faq && ksCampaign.faq.length > 0 && (
                <div className="px-4 py-3">
                  <SectionHeader id="faq" icon={HelpCircle} title="FAQ" count={ksCampaign.faq.length} />
                  {expandedSections.has("faq") && (
                    <div className="space-y-3 mt-2">
                      {ksCampaign.faq.map((f, i) => (
                        <div key={i}>
                          <p className="text-sm font-medium text-white">{f.question}</p>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{f.answer}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Closing */}
              {ksCampaign.closingStatement && (
                <div className="px-4 py-3 bg-primary/5">
                  <p className="text-sm text-white font-medium text-center py-2 italic">"{ksCampaign.closingStatement}"</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Publisher Pitch Generator ── */}
      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border py-4 px-5">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-white text-base">
                <Briefcase className="w-4 h-4 text-amber-400" />
                Publisher Sell Sheet
              </CardTitle>
              <CardDescription className="mt-1">
                Generate a professional one-page sell sheet for publisher acquisition editors.
              </CardDescription>
            </div>
            {pitch && (
              <Button onClick={handlePrintPitch} size="sm" variant="outline" className="shrink-0 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 gap-1.5">
                <Printer className="w-3.5 h-3.5" /> Print / PDF
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <Button onClick={handleGeneratePitch} disabled={isGeneratingPitch} className="w-full h-10 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 font-semibold">
            {isGeneratingPitch ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Generating...</> : <><Briefcase className="w-4 h-4 mr-2" />{pitch ? "Regenerate" : "Generate Publisher Sell Sheet"}</>}
          </Button>
          {pitch && (
            <div className="space-y-4 border border-border rounded-xl p-5 bg-muted/5">
              {pitch.headline && <p className="text-white font-bold text-lg">{pitch.headline}</p>}
              {pitch.gameInOneSentence && <p className="text-primary/80 italic text-sm border-l-2 border-primary/40 pl-3">{pitch.gameInOneSentence}</p>}
              {pitch.hook && <p className="text-sm text-muted-foreground leading-relaxed">{pitch.hook}</p>}
              {pitch.mechanicPillars && pitch.mechanicPillars.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 font-medium">Core Mechanics</p>
                  <div className="flex flex-wrap gap-2">{pitch.mechanicPillars.map((m, i) => <span key={i} className="px-2.5 py-1 bg-muted/20 border border-border rounded-full text-xs text-white">{m}</span>)}</div>
                </div>
              )}
              {pitch.marketComparisons && <p className="text-sm text-muted-foreground"><span className="text-white font-medium">Position: </span>{pitch.marketComparisons}</p>}
              {pitch.whyItWorks && pitch.whyItWorks.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 font-medium">Why It Works</p>
                  <ul className="space-y-1">{pitch.whyItWorks.map((b, i) => <li key={i} className="text-xs text-muted-foreground flex gap-1.5"><span className="text-primary mt-0.5">•</span>{b}</li>)}</ul>
                </div>
              )}
              {pitch.designerStatement && <p className="text-xs italic text-muted-foreground/70 border-l-2 border-border pl-3">"{pitch.designerStatement}"</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Press Kit Generator ── */}
      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border py-4 px-5">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-white text-base">
                <Newspaper className="w-4 h-4 text-violet-400" />
                Press Kit Generator
              </CardTitle>
              <CardDescription className="mt-1">
                Generate BGG description, box copy, press release, social posts, and reviewer pitch.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <Button onClick={handleGeneratePressKit} disabled={isGeneratingPressKit} className="w-full h-10 bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 border border-violet-500/30 font-semibold">
            {isGeneratingPressKit ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Generating Press Kit...</> : <><Newspaper className="w-4 h-4 mr-2" />{pressKit ? "Regenerate Press Kit" : "Generate Press Kit"}</>}
          </Button>

          {isGeneratingPressKit && pressKitStream && !pressKit && (
            <div className="bg-muted/20 rounded-lg p-4 border border-border max-h-32 overflow-y-auto">
              <p className="text-xs text-muted-foreground font-mono whitespace-pre-wrap">{pressKitStream.slice(-800)}</p>
            </div>
          )}

          {pressKit && (
            <div className="space-y-3">
              {/* Tab switcher */}
              <div className="flex gap-1 border border-border rounded-lg p-1 bg-muted/10 flex-wrap">
                {[
                  { id: "bgg", label: "BGG" },
                  { id: "box", label: "Box Copy" },
                  { id: "press", label: "Press Release" },
                  { id: "social", label: "Social" },
                  { id: "reviewer", label: "Reviewer Pitch" },
                ].map(t => (
                  <button key={t.id} onClick={() => setPressKitTab(t.id)}
                    className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-colors min-w-fit ${pressKitTab === t.id ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-white"}`}>
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="border border-border rounded-xl p-4 bg-muted/5 min-h-32">
                {pressKitTab === "bgg" && pressKit.bggDescription && <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{pressKit.bggDescription}</p>}
                {pressKitTab === "box" && pressKit.boxCopy && <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{pressKit.boxCopy}</p>}
                {pressKitTab === "press" && pressKit.pressRelease && <p className="text-xs font-mono text-muted-foreground leading-relaxed whitespace-pre-wrap">{pressKit.pressRelease}</p>}
                {pressKitTab === "social" && pressKit.socialPosts && (
                  <div className="space-y-4">
                    {pressKit.socialPosts.twitter && <div><p className="text-xs font-medium text-sky-400 mb-1">Twitter/X</p><p className="text-sm text-muted-foreground">{pressKit.socialPosts.twitter}</p></div>}
                    {pressKit.socialPosts.instagram && <div><p className="text-xs font-medium text-pink-400 mb-1">Instagram</p><p className="text-sm text-muted-foreground whitespace-pre-wrap">{pressKit.socialPosts.instagram}</p></div>}
                    {pressKit.socialPosts.reddit && <div><p className="text-xs font-medium text-orange-400 mb-1">Reddit</p><p className="text-sm text-muted-foreground whitespace-pre-wrap">{pressKit.socialPosts.reddit}</p></div>}
                  </div>
                )}
                {pressKitTab === "reviewer" && pressKit.reviewerPitch && <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{pressKit.reviewerPitch}</p>}
              </div>
              {pressKit.keyFeatures && pressKit.keyFeatures.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {pressKit.keyFeatures.map((f, i) => (
                    <span key={i} className="text-xs px-2.5 py-1 bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-full">{f}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── NotebookLM Source Link ── */}
      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border bg-muted/10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-white">
                <BookOpen className="w-5 h-5 text-violet-400" />
                NotebookLM Source
              </CardTitle>
              <CardDescription className="mt-1">
                A public URL that packages your full game design as a readable document. Paste it into NotebookLM as a source.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 bg-muted/20 border border-border rounded-md px-3 py-2 font-mono text-xs text-muted-foreground truncate">
              {notebookLMUrl}
            </div>
            <Button
              onClick={handleCopyLink}
              variant="outline"
              size="sm"
              className={`shrink-0 transition-colors ${copied ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10" : "border-violet-500/30 text-violet-400 hover:bg-violet-500/10"}`}
            >
              {copied ? <><Check className="w-4 h-4 mr-1.5" />Copied!</> : <><Copy className="w-4 h-4 mr-1.5" />Copy Link</>}
            </Button>
            <Button
              onClick={() => window.open("https://notebooklm.google.com/", "_blank", "noopener")}
              variant="outline"
              size="sm"
              className="shrink-0 border-border text-muted-foreground hover:text-white"
            >
              <ExternalLink className="w-4 h-4 mr-1.5" />
              Open NotebookLM
            </Button>
          </div>
          <a href={notebookLMUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 hover:underline">
            Preview document <ExternalLink className="w-3 h-3" />
          </a>
        </CardContent>
      </Card>

      {/* ── Rulebook + TTS ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card className="bg-card border-border flex flex-col h-[480px]">
          <CardHeader className="border-b border-border bg-muted/10">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-white">
                  <FileText className="w-5 h-5 text-blue-400" />
                  Rulebook Export
                </CardTitle>
                <CardDescription className="mt-1">Compiled markdown of all rules and entities.</CardDescription>
              </div>
              <Button onClick={handleDownloadRulebook} disabled={isLoadingRulebook || !rulebook} variant="secondary" className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 shrink-0">
                <Download className="w-4 h-4 mr-2" /> Download .md
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden relative">
            {isLoadingRulebook ? (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">Generating rulebook...</div>
            ) : rulebook ? (
              <div className="h-full overflow-y-auto p-5 bg-muted/5 font-mono text-xs text-muted-foreground whitespace-pre-wrap">
                {rulebook.markdown}
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">Failed to load rulebook</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border flex flex-col h-[480px]">
          <CardHeader className="border-b border-border bg-muted/10">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Box className="w-5 h-5 text-emerald-400" />
                  Tabletop Simulator
                </CardTitle>
                <CardDescription className="mt-1">JSON object state for TTS modding.</CardDescription>
              </div>
              <Button onClick={handleDownloadTTS} disabled={isLoadingTTS || !ttsExport} variant="secondary" className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 shrink-0">
                <Download className="w-4 h-4 mr-2" /> Download .json
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden relative">
            {isLoadingTTS ? (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">Compiling TTS objects...</div>
            ) : ttsExport ? (
              <div className="h-full overflow-y-auto p-5 bg-muted/5 font-mono text-xs text-muted-foreground whitespace-pre-wrap">
                {JSON.stringify(ttsExport, null, 2)}
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">No assets available for TTS export</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
