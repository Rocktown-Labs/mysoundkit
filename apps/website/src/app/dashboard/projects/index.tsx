import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Download, MoreVertical, Music } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const mockProjects = [
  {
    collaborators: ["user@soundkit.app", "collab@soundkit.app"],
    coverArt: "/summer-music-album-cover.png",
    id: "1",
    name: "Summer Sessions",
    releaseDate: "2024-06-15",
    status: "complete",
    trackCount: 5,
    type: "ep",
    updatedAt: "1 week ago",
  },
  {
    collaborators: ["user@soundkit.app"],
    coverArt: "/night-music-album-cover.png",
    id: "2",
    name: "Midnight Chronicles",
    releaseDate: null,
    status: "in-progress",
    trackCount: 12,
    type: "album",
    updatedAt: "2 days ago",
  },
  {
    collaborators: [
      "user@soundkit.app",
      "collab@soundkit.app",
      "artist@soundkit.app",
    ],
    coverArt: "/hip-hop-album-cover.png",
    id: "3",
    name: "City Vibes EP",
    releaseDate: null,
    status: "draft",
    trackCount: 4,
    type: "ep",
    updatedAt: "5 days ago",
  },
];

export const Route = createFileRoute("/dashboard/projects/")({
  component: ProjectsPage,
});

function ProjectsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-[family-name:var(--font-playfair)]">
            Projects
          </h1>
          <p className="text-muted-foreground">Manage your albums and EPs</p>
        </div>
        <Link to="/dashboard/projects/new">
          <Button className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </Link>
      </div>

      {/* Project Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mockProjects.map((project) => (
          <Card
            key={project.id}
            className="bg-card/50 backdrop-blur-sm border-border/40 hover:border-primary/50 transition-colors"
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div
                    className="w-16 h-16 rounded-lg bg-cover bg-center"
                    style={{ backgroundImage: `url(${project.coverArt})` }}
                  />
                  <div>
                    <h3 className="font-semibold">{project.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {project.type.toUpperCase()}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {project.trackCount} tracks
                      </span>
                    </div>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Download className="h-4 w-4 mr-2" />
                      Download All
                    </DropdownMenuItem>
                    <DropdownMenuItem>Edit Project</DropdownMenuItem>
                    <DropdownMenuItem>Add Tracks</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive">
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="space-y-2 mb-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <Badge
                    variant={
                      project.status === "complete" ? "default" : "secondary"
                    }
                    className={
                      project.status === "complete"
                        ? "bg-primary/20 text-primary"
                        : (project.status === "in-progress"
                          ? "bg-accent/20 text-accent"
                          : "bg-muted")
                    }
                  >
                    {project.status}
                  </Badge>
                </div>
                {project.releaseDate && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Release</span>
                    <span>
                      {new Date(project.releaseDate).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-border/40">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{project.collaborators.length} collaborator(s)</span>
                  <span>{project.updatedAt}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {mockProjects.length === 0 && (
        <Card className="bg-card/50 backdrop-blur-sm border-border/40">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Music className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
            <p className="text-muted-foreground text-center mb-6 max-w-md">
              Create your first album or EP project to organize your tracks and
              collaborate with your team.
            </p>
            <Link to="/dashboard/projects/new">
              <Button className="bg-primary hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-2" />
                Create Project
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
