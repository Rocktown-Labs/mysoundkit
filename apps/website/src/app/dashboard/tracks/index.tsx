import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Download, MoreVertical, Music, Mic2, Disc, Activity, PlayCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatsGrid } from "@/components/dashboard/stats-grid";

const mockTracks = [
  {
    bpm: 140,
    collaborators: ["user@soundkit.app"],
    coverArt: "/summer-music-album-cover.png",
    files: {
      adlibs: true,
      instrumental: true,
      reference: true,
      session: true,
      vocals: 2,
    },
    genre: "Hip-Hop",
    id: "1",
    key: "C Major",
    name: "Summer Vibes",
    status: "complete",
    updatedAt: "2 hours ago",
  },
  {
    bpm: 85,
    collaborators: ["user@soundkit.app", "collab@soundkit.app"],
    coverArt: "/night-music-album-cover.png",
    files: {
      adlibs: true,
      instrumental: true,
      reference: true,
      session: false,
      vocals: 3,
    },
    genre: "R&B",
    id: "2",
    key: "A Minor",
    name: "Night Drive",
    status: "mixed",
    updatedAt: "1 day ago",
  },
  {
    bpm: 128,
    collaborators: ["user@soundkit.app"],
    coverArt: "/hip-hop-album-cover.png",
    files: {
      adlibs: false,
      instrumental: true,
      reference: false,
      session: true,
      vocals: 1,
    },
    genre: "Pop",
    id: "3",
    key: "G Major",
    name: "City Lights",
    status: "demo",
    updatedAt: "3 days ago",
  },
];

export const Route = createFileRoute("/dashboard/tracks/")({
  component: TracksPage,
});

function TracksPage() {
  const trackStats = [
    {
      title: "Total Tracks",
      value: "24",
      description: "Across all genres and projects",
      icon: Music,
    },
    {
      title: "In Production",
      value: "8",
      description: "Active recording and mixing",
      icon: Mic2,
    },
    {
      title: "Completed",
      value: "16",
      description: "Mixed, mastered and ready",
      icon: Disc,
    },
    {
      title: "Total Plays",
      value: "142K",
      description: "Platform-wide engagement",
      icon: PlayCircle,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-[family-name:var(--font-playfair)] tracking-tight">
            Tracks
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your individual music tracks
          </p>
        </div>
        <Link to="/dashboard/tracks/new">
          <Button className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all hover:scale-[1.02]">
            <Plus className="h-4 w-4 mr-2" />
            New Track
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <StatsGrid stats={trackStats} />

      {/* Track Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mockTracks.map((track) => (
          <Card
            key={track.id}
            className="bg-card/50 backdrop-blur-sm border-border/40 hover:border-primary/50 transition-all group overflow-hidden"
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div
                    className="w-12 h-12 rounded-lg bg-cover bg-center border border-border/20 group-hover:scale-110 transition-transform"
                    style={{ backgroundImage: `url(${track.coverArt})` }}
                  />
                  <div>
                    <h3 className="font-semibold group-hover:text-primary transition-colors">{track.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {track.genre}
                    </p>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-muted-foreground">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Download className="h-4 w-4 mr-2" />
                      Download All
                    </DropdownMenuItem>
                    <DropdownMenuItem>Edit Track</DropdownMenuItem>
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
                      track.status === "complete" ? "default" : "secondary"
                    }
                    className={
                      track.status === "complete"
                        ? "bg-primary/20 text-primary border-primary/20"
                        : (track.status === "mixed"
                          ? "bg-indigo-500/10 text-indigo-500 border-indigo-500/20"
                          : "bg-muted/50")
                    }
                  >
                    {track.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground font-medium text-[11px] uppercase tracking-wider">BPM</span>
                  <span className="font-mono">{track.bpm}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground font-medium text-[11px] uppercase tracking-wider">Key</span>
                  <span className="font-medium">{track.key}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-border/20">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Activity className="size-3 text-primary" />
                    {track.collaborators.length} collaborator(s)
                  </span>
                  <span>{track.updatedAt}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
