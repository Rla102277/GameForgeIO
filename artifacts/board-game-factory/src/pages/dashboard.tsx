import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useListProjects, useCreateProject } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: projects, isLoading } = useListProjects();
  const createProject = useCreateProject();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [newProject, setNewProject] = useState({
    name: "",
    description: "",
    genre: "",
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.name) return;
    
    createProject.mutate({ data: newProject }, {
      onSuccess: (data) => {
        setIsDialogOpen(false);
        setLocation(`/projects/${data.id}`);
      }
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">AI Board Game Factory</h1>
            <p className="text-muted-foreground mt-1">Command center for game designers.</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                Create Project
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-card text-card-foreground border-border">
              <DialogHeader>
                <DialogTitle>New Game Project</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input 
                    id="name" 
                    value={newProject.name} 
                    onChange={e => setNewProject({...newProject, name: e.target.value})} 
                    placeholder="e.g. Cosmic Encounter 2" 
                    className="bg-input border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="genre">Genre</Label>
                  <Input 
                    id="genre" 
                    value={newProject.genre} 
                    onChange={e => setNewProject({...newProject, genre: e.target.value})} 
                    placeholder="e.g. 4X Space Strategy" 
                    className="bg-input border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea 
                    id="description" 
                    value={newProject.description} 
                    onChange={e => setNewProject({...newProject, description: e.target.value})} 
                    placeholder="Brief description..." 
                    className="bg-input border-border"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={createProject.isPending}>
                  {createProject.isPending ? "Creating..." : "Create Project"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 rounded-xl bg-card/50 border border-border animate-pulse" />
            ))}
          </div>
        ) : projects?.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-xl border border-border">
            <h3 className="text-xl font-medium text-white mb-2">No projects yet</h3>
            <p className="text-muted-foreground mb-6">Create your first board game project to get started.</p>
            <Button onClick={() => setIsDialogOpen(true)}>Create Project</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects?.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer bg-card border-border h-full flex flex-col">
                  <CardHeader>
                    <CardTitle className="text-white text-xl">{project.name}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {project.description || "No description"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto pt-4 flex justify-between text-sm text-muted-foreground border-t border-border">
                    <span className="flex items-center gap-1">
                      {project.genre && <span className="bg-primary/20 text-primary px-2 py-0.5 rounded text-xs">{project.genre}</span>}
                    </span>
                    <span>{format(new Date(project.updatedAt), 'MMM d, yyyy')}</span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
