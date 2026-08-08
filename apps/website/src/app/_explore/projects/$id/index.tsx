"use client";

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Calendar,
  Disc,
  Heart,
  Music,
  Play,
  Share2,
  ShoppingBag,
  Users,
} from "lucide-react";

import { AppImage } from "@/components/ui/app-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useProjectQuery } from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/_explore/projects/$id/")({
  component: PublicProjectDetailPage,
});

function PublicProjectDetailPage() {
  const { id } = Route.useParams();
  const { data: project, isLoading } = useProjectQuery(id);

  if (isLoading) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        Loading album details...
      </div>
    );
  }

  if (!project) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        Album or project not found.
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 py-8">
      {/* Album Header Banner */}
      <div className="flex flex-col md:flex-row gap-8 items-start">
        <div className="relative size-64 rounded-2xl bg-muted overflow-hidden border border-border/40 shadow-2xl shrink-0">
          {project.coverArtUrl ? (
            <AppImage
              src={project.coverArtUrl}
              alt={project.title}
              className="size-full object-cover"
            />
          ) : (
            <div className="size-full flex items-center justify-center text-muted-foreground">
              <Disc className="size-20 opacity-30" />
            </div>
          )}
        </div>

        <div className="space-y-4 flex-1">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="uppercase font-bold tracking-wider text-xs">
              {project.projectType}
            </Badge>
            {project.releaseDate && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="size-3.5" />
                {new Date(project.releaseDate).toLocaleDateString("en-US", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            )}
          </div>

          <h1 className="font-[family-name:var(--font-playfair)] text-4xl md:text-5xl font-bold tracking-tight">
            {project.title}
          </h1>

          <p className="text-muted-foreground text-sm max-w-xl">
            {project.description || "Official project release on SoundKit."}
          </p>

          <div className="flex items-center gap-3 pt-2">
            <Button size="lg" className="gap-2 font-bold px-8 shadow-xl shadow-primary/20">
              <Play className="size-5 fill-current" /> Play Album
            </Button>
            <Button variant="outline" size="icon" className="rounded-full">
              <Heart className="size-5 text-rose-500" />
            </Button>
            <Button variant="outline" size="icon" className="rounded-full">
              <Share2 className="size-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Tracklist Section */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Music className="size-5 text-primary" /> Tracklist ({project.tracks?.length ?? 0} Songs)
          </h2>

          <div className="divide-y border border-border/40 rounded-xl overflow-hidden">
            {project.tracks && project.tracks.length > 0 ? (
              project.tracks.map((track, idx) => (
                <div
                  key={track.id}
                  className="flex items-center justify-between p-4 bg-card/40 hover:bg-accent/40 transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="w-6 text-center font-mono text-sm text-muted-foreground">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-sm truncate">{track.title}</p>
                      <p className="text-xs text-muted-foreground">{track.genre}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="gap-1">
                    <Play className="size-3.5 fill-current" /> Stream
                  </Button>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No tracks listed in this project.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
