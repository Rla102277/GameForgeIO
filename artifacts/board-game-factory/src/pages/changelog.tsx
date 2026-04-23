import { Link } from "wouter";
import { ArrowLeft, Zap, Users, MessageSquare, FileText, Database, Sparkles, Bug, LayoutTemplate, BookOpen } from "lucide-react";

interface Change {
  title: string;
  description: string;
  tag: "feature" | "fix" | "improvement" | "ai";
}

interface Release {
  version: string;
  date: string;
  icon: React.ReactNode;
  summary: string;
  changes: Change[];
}

const TAG_STYLES: Record<Change["tag"], string> = {
  feature: "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20",
  fix: "bg-red-500/10 text-red-400 border border-red-500/20",
  improvement: "bg-zinc-700/40 text-zinc-400 border border-zinc-700/60",
  ai: "bg-violet-500/10 text-violet-400 border border-violet-500/20",
};

const TAG_LABELS: Record<Change["tag"], string> = {
  feature: "Feature",
  fix: "Fix",
  improvement: "Improvement",
  ai: "AI",
};

const RELEASES: Release[] = [
  {
    version: "0.7",
    date: "Apr 23, 2025",
    icon: <Sparkles className="w-4 h-4" />,
    summary: "Obsidian theme applied across the entire app.",
    changes: [
      {
        title: "Obsidian visual theme",
        description: "Switched from slate/blue dark mode to true-black Obsidian with electric cyan accents throughout the interface.",
        tag: "improvement",
      },
      {
        title: "Change Log page",
        description: "This page — a running history of every feature, fix, and improvement made to the app.",
        tag: "feature",
      },
    ],
  },
  {
    version: "0.6",
    date: "Apr 22, 2025",
    icon: <MessageSquare className="w-4 h-4" />,
    summary: "Design Chat tab and streaming AI conversations about your game.",
    changes: [
      {
        title: "Design Chat tab",
        description: "A streaming chat interface powered by Anthropic Claude. The AI has full context of your game's rules, players, research, and notes — ask it anything about your design.",
        tag: "ai",
      },
      {
        title: "SSE streaming endpoint",
        description: "Backend `/projects/:id/notes/chat` route streams responses token-by-token for a responsive feel even on long answers.",
        tag: "feature",
      },
    ],
  },
  {
    version: "0.5",
    date: "Apr 21, 2025",
    icon: <FileText className="w-4 h-4" />,
    summary: "Major Notes tab overhaul with topics, AI brainstorm, Design Guide, and Storyboard integration.",
    changes: [
      {
        title: "AI Brainstorm",
        description: "One-click AI brainstorm that generates new design note ideas based on your existing game context and rules.",
        tag: "ai",
      },
      {
        title: "Global rule suggestions",
        description: "Button that analyzes all your notes together and suggests rule changes that address the patterns it finds.",
        tag: "ai",
      },
      {
        title: "Per-note rule suggestions",
        description: "Each note now has a 'Suggest rule changes' action that uses that specific note's content to propose targeted rule edits.",
        tag: "ai",
      },
      {
        title: "Topic picker per note",
        description: "Assign a topic/category (Mechanics, Player Experience, Balance, Theme, etc.) to each note for better organization.",
        tag: "feature",
      },
      {
        title: "Design Guide view",
        description: "New view inside the Notes tab that groups notes by topic into collapsible sections — a quick reference for the whole design.",
        tag: "feature",
      },
      {
        title: "Send to Storyboard",
        description: "One-click button on each note to convert it into a storyboard node, bridging ideation and narrative structure.",
        tag: "feature",
      },
      {
        title: "Look at Later toggle and filter",
        description: "Flag any note to revisit later. A filter shows only flagged notes when you want to review deferred ideas.",
        tag: "feature",
      },
      {
        title: "AI Organize Topics endpoint",
        description: "Backend endpoint that uses AI to automatically assign topic categories to all untagged notes in bulk.",
        tag: "ai",
      },
    ],
  },
  {
    version: "0.4",
    date: "Apr 20, 2025",
    icon: <Database className="w-4 h-4" />,
    summary: "Database schema extended for richer notes.",
    changes: [
      {
        title: "Notes schema: topic column",
        description: "Added a nullable `topic` text column to the notes table so each note can be tagged with a design category.",
        tag: "improvement",
      },
      {
        title: "Notes schema: lookAtLater column",
        description: "Added a boolean `lookAtLater` column with a default of false, persisted to the database.",
        tag: "improvement",
      },
    ],
  },
  {
    version: "0.3",
    date: "Apr 19, 2025",
    icon: <Users className="w-4 h-4" />,
    summary: "Players tab upgraded with archetype system and crash fix.",
    changes: [
      {
        title: "Player archetype dropdown",
        description: "14 preset archetypes (Explorer, Achiever, Killer, Socializer, and more) with full descriptions plus a Custom option with free-form input.",
        tag: "feature",
      },
      {
        title: "Playstyle crash fix",
        description: "Fixed a crash caused by case-sensitive lookup of playstyle strings; now handles mixed casing gracefully.",
        tag: "fix",
      },
    ],
  },
  {
    version: "0.2",
    date: "Apr 18, 2025",
    icon: <LayoutTemplate className="w-4 h-4" />,
    summary: "Project workspace with full tab system launched.",
    changes: [
      {
        title: "Project workspace",
        description: "Full per-project workspace with tabs: Overview, Research, Ontology, Players, Rules, Notes, Design Chat, and Storyboard.",
        tag: "feature",
      },
      {
        title: "Storyboard canvas",
        description: "Drag-and-drop node canvas for mapping out narrative arcs, game flow, and design ideas visually.",
        tag: "feature",
      },
      {
        title: "Rules editor",
        description: "Structured rule entry with categories, priorities, and AI-powered suggestions for rebalancing.",
        tag: "feature",
      },
    ],
  },
  {
    version: "0.1",
    date: "Apr 17, 2025",
    icon: <BookOpen className="w-4 h-4" />,
    summary: "Initial launch — AI Board Game Factory.",
    changes: [
      {
        title: "Project dashboard",
        description: "Create and manage multiple board game design projects. Each project stores its own rules, players, notes, and research.",
        tag: "feature",
      },
      {
        title: "Anthropic AI integration",
        description: "Claude Sonnet for streaming chat and complex analysis; Claude Haiku for fast JSON-structured suggestions.",
        tag: "ai",
      },
      {
        title: "PostgreSQL + Drizzle ORM",
        description: "Full relational database with Drizzle schema and type-safe queries for projects, rules, players, notes, and storyboard nodes.",
        tag: "feature",
      },
      {
        title: "Clerk authentication",
        description: "Secure sign-in / sign-up with Google OAuth and email. Projects are scoped to the authenticated user.",
        tag: "feature",
      },
    ],
  },
];

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border px-6 py-4 flex items-center gap-4">
        <Link href="/">
          <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </button>
        </Link>
        <div className="w-px h-4 bg-border" />
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          <span className="font-semibold text-foreground text-sm">Change Log</span>
        </div>
        <span className="text-xs text-muted-foreground font-mono ml-auto">AI Board Game Factory</span>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-foreground mb-2">What's changed</h1>
          <p className="text-muted-foreground text-sm">A running history of every feature, fix, and improvement built into the app.</p>
        </div>

        <div className="relative">
          <div className="absolute left-[11px] top-0 bottom-0 w-px bg-border" />

          <div className="space-y-10">
            {RELEASES.map((release) => (
              <div key={release.version} className="relative pl-8">
                <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center text-primary">
                  {release.icon}
                </div>

                <div className="flex items-baseline gap-3 mb-1">
                  <span className="text-xs font-mono text-primary bg-primary/10 border border-primary/20 rounded px-2 py-0.5">v{release.version}</span>
                  <span className="text-xs text-muted-foreground font-mono">{release.date}</span>
                </div>

                <p className="text-sm text-muted-foreground mb-4 italic">{release.summary}</p>

                <div className="space-y-3">
                  {release.changes.map((change, i) => (
                    <div key={i} className="bg-card border border-border rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="text-sm font-medium text-foreground">{change.title}</span>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded font-mono ${TAG_STYLES[change.tag]}`}>
                              {TAG_LABELS[change.tag]}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{change.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
