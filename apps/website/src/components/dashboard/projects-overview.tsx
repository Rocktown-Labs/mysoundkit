"use client";

import { Link } from "@tanstack/react-router";
import {
  CheckCircle,
  ChevronRight,
  Download,
  MoreHorizontal,
  Music,
} from "lucide-react";

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ProjectSummary } from "@/lib/soundkit-api-hooks";
import { cn } from "@/lib/utils";

const relativeDate = (value: string) => {
  const diffMs = Date.now() - new Date(value).getTime(),
    diffDays = Math.max(0, Math.floor(diffMs / 86_400_000));

  if (diffDays === 0) {
    return "Today";
  }

  if (diffDays === 1) {
    return "1 day ago";
  }

  return `${diffDays} days ago`;
};

export function ProjectsOverview({
  isLoading = false,
  projects,
}: {
  isLoading?: boolean;
  projects: ProjectSummary[];
}) {
  const recentProjects = projects.slice(0, 3);

  return (
    <Card className="overflow-hidden border-border/40 bg-card/40 backdrop-blur-md">
      <CardHeader className="border-b border-border/20 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="font-[family-name:var(--font-playfair)] text-xl">
              Recent Projects
            </CardTitle>
            <CardDescription className="text-xs">
              Your latest music collaborations and uploads
            </CardDescription>
          </div>
          <Button
            asChild={true}
            className="text-xs hover:bg-white/5"
            size="sm"
            variant="ghost"
          >
            <Link to="/dashboard/projects">
              View All
              <ChevronRight className="ml-1 size-3.5" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border/10">
          {isLoading && (
            <div className="p-6 text-sm text-muted-foreground">
              Loading recent projects...
            </div>
          )}

          {!isLoading && recentProjects.length === 0 && (
            <div className="p-8 text-center">
              <Music className="mx-auto mb-3 size-10 text-muted-foreground/30" />
              <p className="font-medium">No projects yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create a project to collect tracks, credits, and release dates.
              </p>
            </div>
          )}

          {recentProjects.map((project) => {
            const trackLabel = `${project.trackCount} ${
                project.trackCount === 1 ? "track" : "tracks"
              }`,
              durationLabel =
                "duration" in project && typeof project.duration === "string"
                  ? project.duration
                  : null;

            return (
              <div
                className="group flex flex-col items-start justify-between gap-4 p-4 transition-colors hover:bg-white/[0.02] sm:flex-row sm:items-center"
                key={project.id}
              >
                <div className="flex min-w-0 items-center space-x-4">
                  <div className="relative">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 transition-transform group-hover:scale-105">
                      <Music className="h-6 w-6 text-primary" />
                    </div>
                    {project.status === "released" && (
                      <div className="-right-1 -top-1 absolute rounded-full border-2 border-card bg-emerald-500 p-0.5">
                        <CheckCircle className="size-2.5 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-sm transition-colors group-hover:text-primary">
                      {project.title}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2">
                      <Badge
                        className={cn(
                          "h-4 px-1.5 font-bold text-[9px] uppercase tracking-wider",
                          project.status === "released"
                            ? "border-primary/30 bg-primary/20 text-primary"
                            : "border-amber-500/30 bg-amber-500/10 text-amber-500"
                        )}
                        variant={
                          project.status === "released"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {project.status}
                      </Badge>
                      <span className="font-medium text-[10px] text-muted-foreground">
                        {relativeDate(
                          project.updatedAt ?? new Date().toISOString()
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex w-full items-center justify-between gap-4 sm:w-auto">
                  <div className="flex items-center gap-2 rounded-full border border-border/40 bg-muted/20 px-3 py-1.5 text-[10px] text-muted-foreground">
                    <Music className="size-3 text-primary" />
                    <span className="font-semibold uppercase tracking-wider">
                      {trackLabel}
                    </span>
                    {durationLabel && durationLabel !== "0:00" && (
                      <span className="font-mono">{durationLabel}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      className="size-8 rounded-full transition-colors hover:bg-primary/10 hover:text-primary"
                      size="icon"
                      variant="ghost"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild={true}>
                        <Button
                          className="size-8 rounded-full"
                          size="icon"
                          variant="ghost"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem asChild={true}>
                          <Link
                            params={{ id: project.id }}
                            to="/dashboard/projects/$id"
                          >
                            View Project
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem>Share Stems</DropdownMenuItem>
                        <DropdownMenuItem>View Analytics</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
