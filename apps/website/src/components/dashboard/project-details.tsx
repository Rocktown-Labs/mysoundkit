/* eslint-disable one-var, sort-vars */
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Download,
  Edit,
  ExternalLink,
  FolderOpen,
  LoaderCircle,
  MoreVertical,
  Music,
  Rocket,
  Settings2,
  Share,
} from "lucide-react";
import { useState } from "react";

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import {
  useProjectQuery,
  useUpdateProjectMutation,
} from "@/lib/soundkit-api-hooks";

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
  },
  formatDate = (value: string | null | undefined) => {
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
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false),
    [selectedStatus, setSelectedStatus] = useState<"draft" | "released">(
      "draft"
    ),
    projectQuery = useProjectQuery(projectId),
    updateProjectMutation = useUpdateProjectMutation(projectId),
    project = projectQuery.data;

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
      },
    StatusIcon = statusMeta.icon,
    primaryGenre = project.tracks.find((track) => track.genre)?.genre ?? "—",
    coverArt =
      project.coverArtUrl && project.coverArtUrl.length > 0
        ? project.coverArtUrl
        : null,
    collaborators = Array.isArray(project.collaborators)
      ? project.collaborators
      : [],
    handleReleaseNow = async () => {
      try {
        await updateProjectMutation.mutateAsync({
          isPublic: true,
          releaseDate: new Date().toISOString(),
          status: "released",
        });
        toast({
          description: `${project.title} is now public.`,
          title: "Project released",
        });
      } catch (error) {
        toast({
          description:
            error instanceof Error
              ? error.message
              : "Could not release project.",
          title: "Release failed",
          variant: "destructive",
        });
      }
    },
    handleStatusSave = async () => {
      try {
        await updateProjectMutation.mutateAsync(
          selectedStatus === "released"
            ? {
                isPublic: true,
                releaseDate: new Date().toISOString(),
                status: "released",
              }
            : { isPublic: false, status: "draft" }
        );
        setIsStatusDialogOpen(false);
        toast({
          description:
            selectedStatus === "released"
              ? "The project is now public."
              : "The project is back in draft mode.",
          title: "Project status updated",
        });
      } catch (error) {
        toast({
          description:
            error instanceof Error
              ? error.message
              : "Could not update project status.",
          title: "Status update failed",
          variant: "destructive",
        });
      }
    },
    handleShare = async () => {
      const shareUrl =
        typeof window === "undefined"
          ? `/projects/${project.id}`
          : `${window.location.origin}/projects/${project.id}`;
      if (navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(shareUrl);
          toast({
            description: "Project link copied to clipboard.",
            title: "Link copied",
          });
        } catch {
          toast({
            description: "Could not copy link to clipboard.",
            title: "Copy failed",
            variant: "destructive",
          });
        }
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
            <div className="flex flex-wrap items-center justify-end gap-2">
              {project.status === "draft" ? (
                <Button
                  disabled={updateProjectMutation.isPending}
                  onClick={handleReleaseNow}
                >
                  <Rocket className="mr-2 size-4" />
                  Release now
                </Button>
              ) : null}
              <Button asChild variant="outline">
                <Link
                  params={{ id: projectId }}
                  to="/dashboard/projects/$id/edit"
                >
                  <Edit className="mr-2 size-4" />
                  Edit metadata
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild={true}>
                  <Button aria-label="More project actions" variant="outline">
                    <MoreVertical className="mr-2 size-4" />
                    More actions
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() => {
                      setSelectedStatus(
                        project.status === "released" ? "released" : "draft"
                      );
                      setIsStatusDialogOpen(true);
                    }}
                  >
                    <Settings2 className="mr-2 size-4" />
                    Change release status
                  </DropdownMenuItem>
                  {project.isPublic ? (
                    <DropdownMenuItem asChild={true}>
                      <a href={`/projects/${project.id}`}>
                        <ExternalLink className="mr-2 size-4" />
                        View public page
                      </a>
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem onSelect={handleShare}>
                    <Share className="mr-2 size-4" />
                    Copy share link
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => {
                      const downloadableTracks = project.tracks.filter(
                        (track) => track.downloadUrl || track.playbackUrl
                      );
                      if (downloadableTracks.length === 0) {
                        toast({
                          description:
                            "No audio files uploaded to this project yet.",
                          title: "No files available",
                        });
                        return;
                      }
                      for (const track of downloadableTracks) {
                        const url = track.downloadUrl || track.playbackUrl;
                        if (url) {
                          window.open(url, "_blank", "noopener,noreferrer");
                        }
                      }
                      toast({
                        description: `Started download for ${downloadableTracks.length} track${downloadableTracks.length === 1 ? "" : "s"}.`,
                        title: "Downloading files",
                      });
                    }}
                  >
                    <Download className="mr-2 size-4" />
                    Download all files
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
      <Dialog onOpenChange={setIsStatusDialogOpen} open={isStatusDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change project status</DialogTitle>
            <DialogDescription>
              Move this project between draft and released without opening the
              full editor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="project-status">Status</Label>
            <Select
              onValueChange={(value) =>
                setSelectedStatus(value as "draft" | "released")
              }
              value={selectedStatus}
            >
              <SelectTrigger id="project-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="released">Released / public</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setIsStatusDialogOpen(false)}
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              disabled={updateProjectMutation.isPending}
              onClick={handleStatusSave}
              type="button"
            >
              {updateProjectMutation.isPending ? "Saving…" : "Save status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
