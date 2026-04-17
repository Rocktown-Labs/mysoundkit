import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

import { columns } from "./-columns";
import type { RecentTrack } from "./-columns";
import { DataTable } from "./-data-table";

const recentTracks: RecentTrack[] = [
  {
    artist: "Luna Eclipse",
    artistSlug: "luna-eclipse",
    cover: "/placeholder.svg?height=80&width=80",
    duration: "3:45",
    id: "1",
    lastPlayed: "2 hours ago",
    timesPlayed: 24,
    title: "Midnight Vibes",
  },
  {
    artist: "Neon Pulse",
    artistSlug: "neon-pulse",
    cover: "/placeholder.svg?height=80&width=80",
    duration: "4:20",
    id: "2",
    lastPlayed: "5 hours ago",
    timesPlayed: 18,
    title: "Electric Dreams",
  },
  {
    artist: "Street Poet",
    artistSlug: "street-poet",
    cover: "/placeholder.svg?height=80&width=80",
    duration: "3:15",
    id: "3",
    lastPlayed: "Yesterday",
    timesPlayed: 32,
    title: "Street Poetry",
  },
  {
    artist: "Voltage Dreams",
    artistSlug: "voltage-dreams",
    cover: "/placeholder.svg?height=80&width=80",
    duration: "3:58",
    id: "4",
    lastPlayed: "Yesterday",
    timesPlayed: 15,
    title: "Voltage",
  },
  {
    artist: "Metro Flow",
    artistSlug: "metro-flow",
    cover: "/placeholder.svg?height=80&width=80",
    duration: "4:12",
    id: "5",
    lastPlayed: "2 days ago",
    timesPlayed: 41,
    title: "Metro Life",
  },
];

export const Route = createFileRoute("/_explore/library/recent/")({
  component: RecentlyPlayedPage,
});

function RecentlyPlayedPage() {
  return (
    <div className="px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8">
      <Link to="/library" className="md:hidden">
        <Button variant="ghost" size="sm" className="mb-4 -ml-2">
          <ArrowLeft className="mr-2 size-4" />
          Back to My SoundKit
        </Button>
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2 flex items-center gap-3">
          <Clock className="size-8 text-primary" />
          Recently Played
        </h1>
        <p className="text-muted-foreground text-sm md:text-base">
          Your listening history
        </p>
      </div>

      <DataTable columns={columns} data={recentTracks} />
    </div>
  );
}
