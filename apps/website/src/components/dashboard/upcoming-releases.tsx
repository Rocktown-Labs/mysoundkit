"use client";

import { Link } from "@tanstack/react-router";
import { Calendar, Clock, Play } from "lucide-react";

import { AppImage } from "@/components/ui/app-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ProjectSummary } from "@/lib/soundkit-api-hooks";

const daysUntil = (releaseDate: string) =>
  Math.max(
    0,
    Math.ceil((new Date(releaseDate).getTime() - Date.now()) / 86_400_000)
  );

export function UpcomingReleases({ projects }: { projects: ProjectSummary[] }) {
  const upcomingReleases = [...projects]
    .filter((project) => {
      if (!project.releaseDate) {
        return false;
      }

      return new Date(project.releaseDate).getTime() >= Date.now();
    })
    .sort(
      (left, right) =>
        new Date(left.releaseDate ?? 0).getTime() -
        new Date(right.releaseDate ?? 0).getTime()
    )
    .slice(0, 4);

  return (
    <Card className="overflow-hidden border-border/40 bg-card/40 backdrop-blur-md">
      <CardHeader className="border-b border-border/20 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 font-[family-name:var(--font-playfair)] text-xl">
              <Calendar className="size-5 text-primary" />
              Upcoming Releases
            </CardTitle>
            <CardDescription className="text-xs">
              Scheduled drops and distribution dates
            </CardDescription>
          </div>
          <Button
            asChild={true}
            className="h-8 bg-card/50 text-xs"
            size="sm"
            variant="outline"
          >
            <Link to="/dashboard/career/calendar">Calendar View</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border/10">
          {upcomingReleases.map((release) => (
            <div
              className="group flex flex-col items-center gap-4 p-4 transition-all hover:bg-white/[0.02] sm:flex-row"
              key={release.id}
            >
              <div className="relative size-20 flex-shrink-0 sm:size-16">
                <AppImage
                  alt={release.title}
                  className="size-full rounded-xl border border-border/20 object-cover shadow-lg transition-transform group-hover:scale-105"
                  height={80}
                  layout="fixed"
                  src={release.coverArtUrl || "/placeholder.svg"}
                  width={80}
                />
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <Play className="size-6 fill-current text-white" />
                </div>
              </div>

              <div className="min-w-0 flex-1 text-center sm:text-left">
                <p className="truncate font-bold text-base transition-colors group-hover:text-primary sm:text-sm">
                  {release.title}
                </p>
                <div className="mt-1 flex items-center justify-center gap-2 sm:justify-start">
                  <Badge
                    className="h-4 bg-muted/50 px-1.5 font-bold text-[9px] uppercase tracking-widest"
                    variant="secondary"
                  >
                    {release.projectType}
                  </Badge>
                  <span className="flex items-center gap-1 font-medium text-[10px] text-muted-foreground">
                    <Clock className="size-3" />
                    {new Date(release.releaseDate ?? "").toLocaleDateString(
                      undefined,
                      { day: "numeric", month: "short", year: "numeric" }
                    )}
                  </span>
                </div>
              </div>

              <div className="flex flex-row items-center gap-2 rounded-full bg-primary/5 px-4 py-2 sm:flex-col sm:items-end sm:gap-0 sm:bg-transparent sm:p-0">
                <p className="font-[family-name:var(--font-playfair)] font-black text-lg text-primary leading-none sm:text-xl">
                  {daysUntil(release.releaseDate ?? "")}d
                </p>
                <p className="font-bold text-[10px] text-muted-foreground uppercase tracking-tighter">
                  countdown
                </p>
              </div>
            </div>
          ))}
        </div>

        {upcomingReleases.length === 0 && (
          <div className="p-12 text-center">
            <Calendar className="mx-auto mb-3 size-10 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">
              No upcoming releases scheduled.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
