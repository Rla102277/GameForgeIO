import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, CheckCircle, Gamepad2 } from "lucide-react";

function StarRating({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="space-y-1">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(i => (
          <Star
            key={i}
            className={`w-7 h-7 cursor-pointer transition-colors ${i <= (hovered || value) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
            onClick={() => onChange(i)}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(0)}
          />
        ))}
      </div>
    </div>
  );
}

export default function FeedbackPage() {
  const params = useParams();
  const projectId = parseInt(params.id || "0", 10);
  const BASE = `${window.location.origin}/api`;

  const [project, setProject] = useState<{ name?: string; genre?: string } | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    testerName: "",
    overallRating: 0,
    funRating: 0,
    balanceRating: 0,
    clarityRating: 0,
    whatWorked: "",
    whatDidnt: "",
    suggestions: "",
    wouldPlay: null as boolean | null,
  });

  useEffect(() => {
    fetch(`${BASE}/projects/${projectId}`)
      .then(r => r.ok ? r.json() : null)
      .then(setProject)
      .catch(() => {});
  }, [projectId, BASE]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.overallRating === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${BASE}/projects/${projectId}/playtest-feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white">Thanks for the feedback!</h2>
          <p className="text-muted-foreground">Your response has been recorded. The designer appreciates you taking the time to play their game.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mx-auto">
            <Gamepad2 className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-white">{project?.name ?? "Game"}</h1>
          <p className="text-muted-foreground">Playtest Feedback Form</p>
          {project?.genre && <p className="text-xs text-primary/70 uppercase tracking-wider font-medium">{project.genre}</p>}
        </div>

        <Card className="bg-card border-border">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-white text-base">Share your playtest experience</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-1">
                <Label className="text-sm">Your name (optional)</Label>
                <Input value={form.testerName} onChange={e => setForm({ ...form, testerName: e.target.value })}
                  placeholder="Anonymous" className="bg-input" />
              </div>

              <div className="grid grid-cols-2 gap-5">
                <StarRating label="Overall experience" value={form.overallRating} onChange={v => setForm({ ...form, overallRating: v })} />
                <StarRating label="How fun was it?" value={form.funRating} onChange={v => setForm({ ...form, funRating: v })} />
                <StarRating label="How balanced did it feel?" value={form.balanceRating} onChange={v => setForm({ ...form, balanceRating: v })} />
                <StarRating label="How clear were the rules?" value={form.clarityRating} onChange={v => setForm({ ...form, clarityRating: v })} />
              </div>

              <div className="space-y-1">
                <Label className="text-sm text-emerald-400">What worked well?</Label>
                <Textarea value={form.whatWorked} onChange={e => setForm({ ...form, whatWorked: e.target.value })}
                  placeholder="What moments were fun? What mechanics clicked?" className="bg-input h-24 resize-none" />
              </div>

              <div className="space-y-1">
                <Label className="text-sm text-red-400">What didn't work?</Label>
                <Textarea value={form.whatDidnt} onChange={e => setForm({ ...form, whatDidnt: e.target.value })}
                  placeholder="Confusing rules, imbalances, frustrating moments..." className="bg-input h-24 resize-none" />
              </div>

              <div className="space-y-1">
                <Label className="text-sm text-amber-400">Suggestions</Label>
                <Textarea value={form.suggestions} onChange={e => setForm({ ...form, suggestions: e.target.value })}
                  placeholder="What would you change or add?" className="bg-input h-24 resize-none" />
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Would you play this game again?</Label>
                <div className="flex gap-3">
                  {[{ v: true, label: "Yes, definitely!" }, { v: false, label: "Not sure / No" }].map(({ v, label }) => (
                    <button key={label} type="button"
                      className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${form.wouldPlay === v ? (v ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400" : "border-red-500/50 bg-red-500/10 text-red-400") : "border-border text-muted-foreground hover:border-border/80"}`}
                      onClick={() => setForm({ ...form, wouldPlay: v })}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={submitting || form.overallRating === 0}>
                {submitting ? "Submitting..." : "Submit Feedback"}
              </Button>
              {form.overallRating === 0 && (
                <p className="text-xs text-center text-muted-foreground">Please rate your overall experience to submit</p>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
