import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useListProjects, useCreateProject } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Show, useUser, useClerk } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronDown, LogOut, User, Dices, Zap } from "lucide-react";

function UserMenu() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();

  const displayName = user?.fullName || user?.primaryEmailAddress?.emailAddress || "Account";
  const initials = (user?.fullName || user?.primaryEmailAddress?.emailAddress || "U")
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s: string) => s[0].toUpperCase())
    .join("");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2 h-9 px-3 text-sm text-muted-foreground hover:text-foreground hover:bg-accent">
          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
            {initials}
          </div>
          <span className="max-w-[140px] truncate hidden sm:block">{displayName}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <div className="px-3 py-2">
          <p className="text-xs font-medium text-foreground truncate">{displayName}</p>
          {user?.primaryEmailAddress && user.fullName && (
            <p className="text-xs text-muted-foreground truncate">{user.primaryEmailAddress.emailAddress}</p>
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="gap-2 cursor-pointer"
          onClick={() => setLocation("/sign-in")}
        >
          <User className="h-3.5 w-3.5" />
          Account settings
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2 cursor-pointer"
          onClick={() => setLocation("/changelog")}
        >
          <Zap className="h-3.5 w-3.5" />
          Change Log
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="gap-2 text-destructive focus:text-destructive cursor-pointer"
          onClick={() => signOut(() => setLocation("/"))}
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProjectsContent() {
  const [, setLocation] = useLocation();
  const { data: projects, isLoading } = useListProjects();
  const createProject = useCreateProject();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newProject, setNewProject] = useState({ name: "", description: "", genre: "" });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.name) return;
    createProject.mutate({ data: newProject }, {
      onSuccess: (data) => {
        setIsDialogOpen(false);
        setLocation(`/projects/${data.id}`);
      },
    });
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-48 rounded-xl bg-card/50 border border-border animate-pulse" />
        ))}
      </div>
    );
  }

  if (!projects?.length) {
    return (
      <div className="text-center py-20 bg-card rounded-xl border border-border">
        <Dices className="h-12 w-12 text-primary mx-auto mb-4 opacity-70" />
        <h3 className="text-xl font-medium text-foreground mb-2">No projects yet</h3>
        <p className="text-muted-foreground mb-6">Create your first board game project to get started.</p>
        <Button onClick={() => setIsDialogOpen(true)}>Create Project</Button>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[425px] bg-card text-card-foreground border-border">
            <DialogHeader>
              <DialogTitle>New Game Project</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name2">Name</Label>
                <Input id="name2" value={newProject.name} onChange={e => setNewProject({ ...newProject, name: e.target.value })} placeholder="e.g. Cosmic Encounter 2" className="bg-input border-border" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="genre2">Genre</Label>
                <Input id="genre2" value={newProject.genre} onChange={e => setNewProject({ ...newProject, genre: e.target.value })} placeholder="e.g. 4X Space Strategy" className="bg-input border-border" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc2">Description</Label>
                <Textarea id="desc2" value={newProject.description} onChange={e => setNewProject({ ...newProject, description: e.target.value })} placeholder="Brief description..." className="bg-input border-border" />
              </div>
              <Button type="submit" className="w-full" disabled={createProject.isPending}>
                {createProject.isPending ? "Creating..." : "Create Project"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-end">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] bg-card text-card-foreground border-border">
            <DialogHeader>
              <DialogTitle>New Game Project</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={newProject.name} onChange={e => setNewProject({ ...newProject, name: e.target.value })} placeholder="e.g. Cosmic Encounter 2" className="bg-input border-border" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="genre">Genre</Label>
                <Input id="genre" value={newProject.genre} onChange={e => setNewProject({ ...newProject, genre: e.target.value })} placeholder="e.g. 4X Space Strategy" className="bg-input border-border" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={newProject.description} onChange={e => setNewProject({ ...newProject, description: e.target.value })} placeholder="Brief description..." className="bg-input border-border" />
              </div>
              <Button type="submit" className="w-full" disabled={createProject.isPending}>
                {createProject.isPending ? "Creating..." : "Create Project"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <Link key={project.id} href={`/projects/${project.id}`}>
            <Card className="hover:border-primary/50 transition-colors cursor-pointer bg-card border-border h-full flex flex-col">
              <CardHeader>
                <CardTitle className="text-white text-xl">{project.name}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {project.description || "No description"}
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto pt-4 flex justify-between text-sm text-muted-foreground border-t border-border">
                <span>
                  {project.genre && (
                    <span className="bg-primary/20 text-primary px-2 py-0.5 rounded text-xs">{project.genre}</span>
                  )}
                </span>
                <span>{format(new Date(project.updatedAt), "MMM d, yyyy")}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}

function LandingContent() {
  const [, setLocation] = useLocation();

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
      <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 mb-6">
        <Dices className="h-10 w-10 text-primary" />
      </div>
      <h2 className="text-4xl font-bold text-foreground mb-4 tracking-tight">
        Design Better Games, Faster
      </h2>
      <p className="text-muted-foreground max-w-md mb-8 text-lg leading-relaxed">
        AI-powered tools for board game designers. Balance mechanics, simulate playthroughs, and export professional sell sheets — all in one place.
      </p>
      <div className="flex gap-3">
        <Button
          size="lg"
          className="px-8"
          onClick={() => setLocation("/sign-up")}
        >
          Get started free
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={() => setLocation("/sign-in")}
        >
          Sign in
        </Button>
      </div>
      <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-2xl w-full text-left">
        {[
          { icon: "⚖️", title: "Balance Analyzer", desc: "Detect overpowered mechanics and rebalance with AI guidance." },
          { icon: "🎲", title: "AI Playthrough", desc: "Simulate full playthroughs and spot design flaws before print." },
          { icon: "📄", title: "Publisher Exports", desc: "Generate sell sheets, press kits, and print-ready assets." },
        ].map(f => (
          <div key={f.title} className="bg-card border border-border rounded-xl p-5">
            <div className="text-2xl mb-2">{f.icon}</div>
            <h3 className="font-semibold text-foreground mb-1">{f.title}</h3>
            <p className="text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Dices className="h-5 w-5 text-primary" />
            <span className="font-bold text-foreground tracking-tight">AI Board Game Factory</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/changelog">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1.5 text-xs">
                <Zap className="h-3.5 w-3.5" />
                Change Log
              </Button>
            </Link>
            <Show when="signed-in">
              <UserMenu />
            </Show>
            <Show when="signed-out">
              <Link href="/sign-in">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">Sign in</Button>
              </Link>
              <Link href="/sign-up">
                <Button size="sm">Get started</Button>
              </Link>
            </Show>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-8 py-10 space-y-8">
        <Show when="signed-in">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">My Projects</h1>
            <p className="text-muted-foreground mt-0.5 text-sm">Your board game designs.</p>
          </div>
          <ProjectsContent />
        </Show>
        <Show when="signed-out">
          <LandingContent />
        </Show>
      </main>
    </div>
  );
}
