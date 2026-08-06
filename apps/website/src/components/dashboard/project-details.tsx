import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Edit,
  Share,
  Download,
  CheckCircle,
  Clock,
  LoaderCircle,
  FolderOpen,
  Music,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useProjectQuery } from "@/lib/soundkit-api-hooks";

interface ProjectDetailsProps {
  projectId: string;
}

const STATUS_META: Record<
  string,
  { className: string; icon: typeof Clock; label: string }
> = {
  archived: {
    className: "bg-muted/50 text-muted-foreground border-border/40",
    icon: FolderOpen,
    label: "Archived",
  },
  draft: {
    className: "bg-muted/50 text-muted-foreground border-border/40",
    icon: Clock,
    label: "Draft",
  },
  released: {
    className: "bg-primary/20 text-primary border-primary/30",
    icon: CheckCircle,
    label: "Released",
  },
  scheduled: {
    className: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    icon: Clock,
    label: "Scheduled",
  },
};

const formatDate = (value: string | null | undefined) => {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleDateString(undefined, { dateStyle: "medium" });
};

export function ProjectDetails({ projectId }: ProjectDetailsProps) {
  const projectQuery = useProjectQuery(projectId);
  const project = projectQuery.data;

  if (projectQuery.isLoading) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-border/40">
        <CardContent className="flex min-h-64 items-center justify-center gap-2 text-muted-foreground">
          <LoaderCircle className="size-5 animate-spin" />
          Loading project…
        </CardContent>
      </Card>
    );
  }

  if (projectQuery.error || !project) {
    return (
      <Card className="bg-destructive/5 border-destructive/30">
        <CardContent className="space-y-4 py-12 text-center">
          <p className="text-sm text-destructive">
            We could not load this project. Refresh and try again.
          </p>
          <Button asChild variant="outline">
            <Link to="/dashboard/projects">Back to Projects</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const statusMeta = STATUS_META[project.status] ??
    STATUS_META.draft ?? {
      className: "bg-muted/50 text-muted-foreground border-border/40",
      icon: Clock,
      label: project.status,
    };
  const StatusIcon = statusMeta.icon;
  const primaryGenre =
    project.tracks.find((track) => track.genre)?.genre ?? "—";
  const coverArt =
    project.coverArtUrl && project.coverArtUrl.length > 0
      ? project.coverArtUrl
      : null;
  const collaborators = Array.isArray(project.collaborators)
    ? project.collaborators
    : [];

  const handleShare = () => {
    const shareUrl =
      typeof window === "undefined"
        ? `/projects/${project.id}`
        : `${window.location.origin}/projects/${project.id}`;
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(shareUrl);
    }
  };

  return (
    <div className="space-y-6">
      {/* Back Navigation */}
      <Link
        to="/dashboard/projects"
        className="inline-flex items-center space-x-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to Projects</span>
      </Link>

      {/* Project Header */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/40">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex flex-1 gap-4">
              {coverArt ? (
                <div
                  className="hidden h-24 w-24 flex-shrink-0 rounded-xl bg-cover bg-center border border-border/20 sm:block"
                  style={{ backgroundImage: `url(${coverArt})` }}
                />
              ) : (
                <div className="hidden h-24 w-24 flex-shrink-0 items-center justify-center rounded-xl border border-border/20 bg-muted text-muted-foreground sm:flex">
                  <Music className="h-8 w-8" />
                </div>
              )}
              <div>
                <div className="flex items-center space-x-3 mb-2">
                  <CardTitle className="text-2xl font-[family-name:var(--font-playfair)]">
                    {project.title}
                  </CardTitle>
                  <Badge
                    variant={
                      project.status === "released" ? "default" : "secondary"
                    }
                    className={statusMeta.className}
                  >
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {statusMeta.label}
                  </Badge>
                </div>
                <CardDescription className="text-base">
                  {project.description ?? "No description yet."}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Link
                to="/dashboard/projects/$id/edit"
                params={{ id: projectId }}
              >
                <Button variant="outline">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </Link>
              <Button onClick={handleShare} variant="outline">
                <Share className="h-4 w-4 mr-2" />
                Share
              </Button>
              <Button className="bg-primary hover:bg-primary/90">
                <Download className="h-4 w-4 mr-2" />
                Download All
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Project Progress</span>
              <span className="text-sm text-muted-foreground">
                {project.progress}%
              </span>
            </div>
            <Progress value={project.progress} className="h-3" />
          </div>

          {/* Project Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-muted-foreground capitalize">
                Type
              </div>
              <div className="font-medium capitalize">
                {project.projectType}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Release Date</div>
              <div className="font-medium">
                {formatDate(project.releaseDate)}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Genre</div>
              <div className="font-medium">{primaryGenre}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Last Updated</div>
              <div className="font-medium">{formatDate(project.updatedAt)}</div>
            </div>
          </div>

          {/* Track Count */}
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Music className="h-4 w-4" />
            <span>
              {project.trackCount} track{project.trackCount === 1 ? "" : "s"} in
              this project
            </span>
          </div>

          {/* Collaborators */}
          <div>
            <div className="text-sm text-muted-foreground mb-2">
              Collaborators
            </div>
            {collaborators.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No collaborators added yet.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {collaborators.map((collaborator) => (
                  <Badge
                    key={collaborator.id}
                    variant="outline"
                    className="gap-2 bg-background/50 py-1.5"
                  >
                    <Avatar className="size-5">
                      <AvatarImage
                        src={collaborator.avatarUrl ?? "/placeholder.svg"}
                      />
                      <AvatarFallback className="text-[10px]">
                        {(collaborator.name ?? collaborator.email ?? "?")[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span>
                      {collaborator.name ??
                        collaborator.email ??
                        "Collaborator"}
                    </span>
                    <span className="text-muted-foreground capitalize">
                      · {collaborator.role}
                    </span>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
