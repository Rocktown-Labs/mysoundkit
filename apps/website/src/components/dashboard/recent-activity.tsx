"use client";

import { Link } from "@tanstack/react-router";
import { ChevronRight, Edit, FolderOpen, Music } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProjectSummary, TrackSummary } from "@/lib/soundkit-api-hooks";
import { cn } from "@/lib/utils";

interface ActivityItem {
  color: string;
  href: "/dashboard/projects/$id" | "/dashboard/tracks/$id";
  icon: LucideIcon;
  id: string;
  itemId: string;
  label: string;
  title: string;
  updatedAt: string;
}

const relativeDate = (value: string) => {
  const diffMs = Date.now() - new Date(value).getTime();
  const diffDays = Math.max(0, Math.floor(diffMs / 86_400_000));

  if (diffDays === 0) {
    return "Today";
  }

  if (diffDays === 1) {
    return "1 day ago";
  }

  return `${diffDays} days ago`;
};

export function RecentActivity({
  projects,
  tracks,
}: {
  projects: ProjectSummary[];
  tracks: TrackSummary[];
}) {
  const activities: ActivityItem[] = [
    ...tracks.map((track) => ({
      color: "bg-primary/10 text-primary",
      href: "/dashboard/tracks/$id" as const,
      icon: Music,
      id: `track-${track.id}`,
      itemId: track.id,
      label:
        track.assetStatus === "processing"
          ? "processing assets for"
          : "updated track",
      title: track.title,
      updatedAt: track.updatedAt ?? new Date().toISOString(),
    })),
    ...projects.map((project) => ({
      color: "bg-emerald-500/10 text-emerald-500",
      href: "/dashboard/projects/$id" as const,
      icon: FolderOpen,
      id: `project-${project.id}`,
      itemId: project.id,
      label: "updated project",
      title: project.title,
      updatedAt: project.updatedAt ?? new Date().toISOString(),
    })),
  ]
    .toSorted(
      (left, right) =>
        new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    )
    .slice(0, 5);

  return (
    <Card className="overflow-hidden border-border/40 bg-card/40 backdrop-blur-md">
      <CardHeader className="border-b border-border/20 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="font-[family-name:var(--font-playfair)] text-lg">
            Activity
          </CardTitle>
          <Button
            asChild={true}
            className="h-7 font-bold text-[10px] uppercase tracking-widest"
            size="sm"
            variant="ghost"
          >
            <Link to="/dashboard/projects">
              Full Log
              <ChevronRight className="ml-1 size-3" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative">
          <div className="absolute bottom-4 left-[27px] top-4 w-px bg-gradient-to-b from-border/40 via-border/20 to-transparent" />

          <div className="space-y-6 p-4">
            {activities.length === 0 && (
              <div className="py-8 text-center">
                <Edit className="mx-auto mb-3 size-8 text-muted-foreground/30" />
                <p className="font-medium text-sm">No activity yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Upload tracks or create projects to build your log.
                </p>
              </div>
            )}

            {activities.map((activity) => {
              const IconComponent = activity.icon;

              return (
                <div
                  className="group relative flex items-start gap-4"
                  key={activity.id}
                >
                  <div
                    className={cn(
                      "z-10 flex size-7 shrink-0 items-center justify-center rounded-full border border-border/20 shadow-sm transition-transform group-hover:scale-110",
                      activity.color
                    )}
                  >
                    <IconComponent className="size-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs leading-relaxed">
                      <span className="font-bold text-foreground/90">You</span>{" "}
                      <span className="text-muted-foreground/80">
                        {activity.label}
                      </span>{" "}
                      <Link
                        className="font-semibold text-primary hover:underline"
                        params={{ id: activity.itemId }}
                        to={activity.href}
                      >
                        {activity.title}
                      </Link>
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="font-medium text-[10px] text-muted-foreground/50">
                        {relativeDate(activity.updatedAt)}
                      </span>
                      <span className="size-0.5 rounded-full bg-border" />
                      <Link
                        className="font-medium text-[10px] text-primary/60 hover:text-primary"
                        params={{ id: activity.itemId }}
                        to={activity.href}
                      >
                        View Details
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
