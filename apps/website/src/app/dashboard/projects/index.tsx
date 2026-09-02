import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CheckCircle2,
  Clock,
  Download,
  FolderOpen,
  MoreVertical,
  Music,
  Plus,
  Users,
} from "lucide-react";
import { useState } from "react";

import { StatsGrid } from "@/components/dashboard/stats-grid";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import {
  useDeleteProjectMutation,
  useMeQuery,
  useProjectsQuery,
} from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/projects/")({
  component: ProjectsPage,
});

const getStatusClassName = (status: string) => {
  if (status === "released") {
    return "bg-primary/20 text-primary border-primary/20";
  }

  if (status === "scheduled") {
    return "bg-amber-500/10 text-amber-500 border-amber-500/20";
  }

  return "bg-muted/50";
};

function ProjectsPage() {
  const { data: projects = [], error, isLoading } = useProjectsQuery(),
    deleteProjectMutation = useDeleteProjectMutation(),
    meQuery = useMeQuery(),
    [deleteCandidate, setDeleteCandidate] = useState<{
      id: string;
      title: string;
    } | null>(null),
    [deleteConfirmation, setDeleteConfirmation] = useState(""),
    releasedCount = projects.filter(
      (project) => project.status === "released"
    ).length,
    activeCount = projects.filter((project) =>
      ["draft", "scheduled"].includes(project.status)
    ).length,
    collaboratorCount = projects.reduce(
      (total, project) => total + project.collaboratorCount,
      0
    ),
    projectStats = [
      {
        description: "Albums, EPs and Singles",
        icon: FolderOpen,
        title: "Total Projects",
        value: String(projects.length),
      },
      {
        description: "Live in the catalog",
        icon: CheckCircle2,
        title: "Released",
        value: String(releasedCount),
      },
      {
        description: "Drafts and scheduled releases",
        icon: Clock,
        title: "In Progress",
        value: String(activeCount),
      },
      {
        description: "Across all active projects",
        icon: Users,
        title: "Collaborators",
        value: String(collaboratorCount),
      },
    ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-[family-name:var(--font-playfair)] tracking-tight">
            Projects
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your albums and EPs
          </p>
        </div>
        <Link to="/dashboard/projects/new">
          <Button className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all hover:scale-[1.02]">
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <StatsGrid stats={projectStats} />

      {/* Project Grid */}
      <div
        className={
          meQuery.data?.user.mediaLayout === "list"
            ? "grid grid-cols-1 gap-2"
            : "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
        }
      >
        {projects.map((project) => (
          <Card
            key={project.id}
            className="bg-card/50 backdrop-blur-sm border-border/40 hover:border-primary/50 transition-all group overflow-hidden"
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <Link
                    to="/dashboard/projects/$id"
                    params={{ id: project.id }}
                    className="w-16 h-16 rounded-lg bg-muted bg-cover bg-center border border-border/20 group-hover:scale-105 transition-transform flex items-center justify-center text-muted-foreground"
                    style={{
                      backgroundImage: project.coverArtUrl
                        ? `url(${project.coverArtUrl})`
                        : undefined,
                    }}
                  >
                    {!project.coverArtUrl && <Music className="h-6 w-6" />}
                  </Link>
                  <div>
                    <Link
                      to="/dashboard/projects/$id"
                      params={{ id: project.id }}
                      className="font-semibold group-hover:text-primary transition-colors"
                    >
                      {project.title}
                    </Link>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant="outline"
                        className="text-[10px] uppercase tracking-wider h-5"
                      >
                        {project.projectType.toUpperCase()}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {project.trackCount} tracks
                      </span>
                      {project.genre ? (
                        <span className="max-w-32 truncate text-xs text-muted-foreground">
                          {project.genre}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Download className="h-4 w-4 mr-2" />
                      Download All
                    </DropdownMenuItem>
                    <Link
                      to="/dashboard/projects/$id/edit"
                      params={{ id: project.id }}
                    >
                      <DropdownMenuItem>Edit Project</DropdownMenuItem>
                    </Link>
                    <Link
                      to="/dashboard/projects/$id"
                      params={{ id: project.id }}
                    >
                      <DropdownMenuItem>Add Tracks</DropdownMenuItem>
                    </Link>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      disabled={deleteProjectMutation.isPending}
                      onClick={() => {
                        setDeleteCandidate({
                          id: project.id,
                          title: project.title,
                        });
                        setDeleteConfirmation("");
                      }}
                    >
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
                      project.status === "released" ? "default" : "secondary"
                    }
                    className={getStatusClassName(project.status)}
                  >
                    {project.status}
                  </Badge>
                </div>
                {project.releaseDate && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Release</span>
                    <span className="font-medium">
                      {new Date(project.releaseDate).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-border/20">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Users className="size-3" />
                    {project.collaboratorCount} collaborator(s)
                  </span>
                  <span>
                    {project.updatedAt
                      ? new Date(project.updatedAt).toLocaleDateString()
                      : "Recently updated"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {isLoading && (
        <Card className="bg-card/50 backdrop-blur-sm border-border/40">
          <CardContent className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            Loading projects...
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="bg-destructive/5 border-destructive/30">
          <CardContent className="flex items-center justify-center py-12 text-sm text-destructive">
            We could not load your projects. Refresh and try again.
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && !error && projects.length === 0 && (
        <Card className="bg-card/50 backdrop-blur-sm border-border/40">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Music className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
            <p className="text-muted-foreground text-center mb-6 max-w-md mx-auto">
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

      <AlertDialog
        onOpenChange={(open) => {
          if (!open && !deleteProjectMutation.isPending) {
            setDeleteCandidate(null);
            setDeleteConfirmation("");
          }
        }}
        open={Boolean(deleteCandidate)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the project dashboard record. Type the
              project title to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <p className="font-medium text-sm">{deleteCandidate?.title}</p>
            <Input
              disabled={deleteProjectMutation.isPending}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              placeholder="Type the project title"
              value={deleteConfirmation}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteProjectMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={
                !deleteCandidate ||
                deleteConfirmation !== deleteCandidate.title ||
                deleteProjectMutation.isPending
              }
              onClick={async (event) => {
                event.preventDefault();
                if (!deleteCandidate) {
                  return;
                }
                try {
                  await deleteProjectMutation.mutateAsync(deleteCandidate.id);
                  toast({
                    description: `"${deleteCandidate.title}" has been deleted.`,
                    title: "Project Deleted",
                  });
                  setDeleteCandidate(null);
                  setDeleteConfirmation("");
                } catch {
                  toast({
                    description: "Failed to delete project. Please try again.",
                    title: "Error",
                    variant: "destructive",
                  });
                }
              }}
            >
              {deleteProjectMutation.isPending
                ? "Deleting..."
                : "Delete Project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
