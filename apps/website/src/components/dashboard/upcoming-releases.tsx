"use client";

import { Calendar, Play, Clock } from "lucide-react";

import { AppImage } from "@/components/ui/app-image";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const upcomingReleases = [
  {
    coverArt: "/summer-music-album-cover.png",
    daysUntil: 3,
    id: 1,
    releaseDate: "2025-01-15",
    title: "Midnight Dreams",
    type: "Album",
  },
  {
    coverArt: "/night-music-album-cover.png",
    daysUntil: 10,
    id: 2,
    releaseDate: "2025-01-22",
    title: "Summer Vibes EP",
    type: "EP",
  },
];

export function UpcomingReleases() {
  return (
    <Card className="bg-card/40 backdrop-blur-md border-border/40 overflow-hidden">
      <CardHeader className="pb-4 border-b border-border/20">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="font-[family-name:var(--font-playfair)] text-xl flex items-center gap-2">
              <Calendar className="size-5 text-primary" />
              Upcoming Releases
            </CardTitle>
            <CardDescription className="text-xs">Scheduled drops and distribution dates</CardDescription>
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs bg-card/50">
            Calendar View
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border/10">
          {upcomingReleases.map((release) => (
            <div
              key={release.id}
              className="group flex flex-col sm:flex-row items-center gap-4 p-4 hover:bg-white/[0.02] transition-all"
            >
              <div className="relative size-20 sm:size-16 flex-shrink-0">
                <AppImage
                  src={release.coverArt || "/placeholder.svg"}
                  alt={release.title}
                  width={80}
                  height={80}
                  layout="fixed"
                  className="size-full rounded-xl object-cover border border-border/20 shadow-lg group-hover:scale-105 transition-transform"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                  <Play className="size-6 text-white fill-current" />
                </div>
              </div>
              
              <div className="flex-1 min-w-0 text-center sm:text-left">
                <p className="font-bold text-base sm:text-sm truncate group-hover:text-primary transition-colors">{release.title}</p>
                <div className="flex items-center justify-center sm:justify-start gap-2 mt-1">
                  <Badge variant="secondary" className="text-[9px] uppercase tracking-widest px-1.5 h-4 font-bold bg-muted/50">
                    {release.type}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                    <Clock className="size-3" />
                    {new Date(release.releaseDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              </div>

              <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 sm:gap-0 bg-primary/5 sm:bg-transparent px-4 py-2 sm:p-0 rounded-full sm:rounded-none">
                <p className="text-lg sm:text-xl font-black font-[family-name:var(--font-playfair)] text-primary leading-none">
                  {release.daysUntil}d
                </p>
                <p className="text-[10px] uppercase tracking-tighter font-bold text-muted-foreground">
                  countdown
                </p>
              </div>
            </div>
          ))}
        </div>
        
        {upcomingReleases.length === 0 && (
          <div className="p-12 text-center">
            <Calendar className="size-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No upcoming releases scheduled.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
