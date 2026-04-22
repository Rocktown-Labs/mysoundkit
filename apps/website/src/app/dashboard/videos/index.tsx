import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Film, Plus, ShieldCheck, Play, MoreVertical, Search, Filter } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { mockVideos } from "@/lib/mock-videos";
import { AddVideoDialog } from "@/components/dashboard/videos/add-video-dialog";
import { StatsGrid } from "@/components/dashboard/stats-grid";

export const Route = createFileRoute("/dashboard/videos/")({
  component: DashboardVideosPage,
});

function DashboardVideosPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const videoStats = [
    {
      title: "Verified Uploads",
      value: "12",
      description: "Hosted directly on SoundKit via Mux",
      icon: ShieldCheck,
    },
    {
      title: "External Sources",
      value: "3",
      description: "Linked official videos via YouTube",
      icon: Play,
    },
    {
      title: "Processing",
      value: "2",
      description: "Waiting on transcode and IDs",
      icon: Film,
    },
    {
      title: "Total Views",
      value: "3.2M",
      description: "Across music videos and live sets",
      icon: Play,
    },
  ];

  const filteredVideos = mockVideos.filter(video => 
    video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    video.creator.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-bold tracking-tight">
            Videos
          </h1>
          <p className="text-muted-foreground mt-1">
            Upload verified music videos or link external sources.
          </p>
        </div>
        <Link to="/dashboard/videos/new">
          <Button 
            className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all hover:scale-[1.02]"
          >
            <Plus className="mr-2 size-4" />
            New Video
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <StatsGrid stats={videoStats} />

      {/* Library Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input 
              placeholder="Search videos, artists..." 
              className="pl-9 bg-card/50 border-border/40"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button variant="outline" size="sm" className="bg-card/50 border-border/40">
              <Filter className="mr-2 size-3.5" />
              Filter
            </Button>
            <p className="text-xs text-muted-foreground ml-auto sm:ml-0">
              Showing {filteredVideos.length} videos
            </p>
          </div>
        </div>

        <Card className="bg-card/40 backdrop-blur-sm border-border/40">
          <CardContent className="p-0">
            <div className="divide-y divide-border/20">
              {filteredVideos.map((video) => (
                <div
                  className="group flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between hover:bg-white/[0.02] transition-colors"
                  key={video.id}
                >
                  <div className="flex items-center gap-4">
                    <div className="relative h-20 w-36 flex-shrink-0 overflow-hidden rounded-xl border border-border/50 group-hover:border-primary/40 transition-colors">
                      <img
                        alt={`${video.title} thumbnail`}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        src={video.thumbnail}
                      />
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors" />
                      <div className="absolute bottom-1.5 right-1.5 bg-black/80 px-1.5 py-0.5 rounded text-[10px] font-medium text-white">
                        {video.duration}
                      </div>
                    </div>
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold truncate">{video.title}</p>
                        <Badge variant={video.status === "live" ? "destructive" : "secondary"} className="text-[10px] uppercase tracking-wider h-5">
                          {video.status}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground/80">{video.creator.name}</span>
                        <span>•</span>
                        <span className="capitalize">{video.videoKind.replaceAll("_", " ")}</span>
                        <span>•</span>
                        <div className="flex items-center">
                          {video.verifiedOnPlatform ? (
                            <>
                              <ShieldCheck className="mr-1 size-3 text-emerald-400" />
                              <span className="text-emerald-400/90 font-medium">SoundKit Verified</span>
                            </>
                          ) : (
                            <span className="text-amber-400/90 font-medium italic">External Source</span>
                          )}
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground/60">
                        {video.viewCount} views • Uploaded 2 months ago
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link params={{ id: video.id }} to="/videos/$id" className="flex-1 sm:flex-none">
                      <Button variant="outline" className="w-full sm:w-auto bg-card hover:bg-accent border-border/50">
                        <Play className="mr-2 size-3.5 fill-current" />
                        Preview
                      </Button>
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8 text-muted-foreground">
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem>Edit Details</DropdownMenuItem>
                        <DropdownMenuItem>Change Visibility</DropdownMenuItem>
                        <DropdownMenuItem>View Analytics</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">Delete Video</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
            {filteredVideos.length === 0 && (
              <div className="p-12 text-center space-y-3">
                <Film className="size-12 text-muted-foreground/20 mx-auto" />
                <h3 className="text-lg font-medium">No videos found</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  We couldn't find any videos matching your search. Try adjusting your filters.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
