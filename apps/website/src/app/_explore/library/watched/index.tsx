import { createFileRoute, Link } from "@tanstack/react-router";
import { Video, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

import { columns } from "./-columns";
import type { WatchedItem } from "./-columns";
import { DataTable } from "./-data-table";

const watchedItems: WatchedItem[] = [
  {
    creator: "Luna Eclipse vs Neon Pulse",
    creatorSlug: "luna-eclipse",
    duration: "15:20",
    id: "b1",
    thumbnail: "/placeholder.svg?height=128&width=128",
    title: "Midnight Beats Battle",
    type: "battle",
    watchedAt: "2 hours ago",
  },
  {
    creator: "Street Poet",
    creatorSlug: "street-poet",
    duration: "4:45",
    id: "v1",
    thumbnail: "/placeholder.svg?height=128&width=128",
    title: "How to Layer Drums like a Pro",
    type: "video",
    watchedAt: "5 hours ago",
  },
  {
    creator: "Voltage Dreams vs Metro Flow",
    creatorSlug: "voltage-dreams",
    duration: "22:10",
    id: "b2",
    thumbnail: "/placeholder.svg?height=128&width=128",
    title: "Final Qualifier: East Coast",
    type: "battle",
    watchedAt: "Yesterday",
  },
  {
    creator: "Synthwave City",
    creatorSlug: "synthwave-city",
    duration: "12:30",
    id: "v2",
    thumbnail: "/placeholder.svg?height=128&width=128",
    title: "Studio Tour 2025",
    type: "video",
    watchedAt: "2 days ago",
  },
];

export const Route = createFileRoute("/_explore/library/watched/")({
  component: RecentlyWatchedPage,
});

function RecentlyWatchedPage() {
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
          <Video className="size-8 text-primary" />
          Recently Watched
        </h1>
        <p className="text-muted-foreground text-sm md:text-base">
          Battles, videos, and streams you've watched
        </p>
      </div>

      <DataTable columns={columns} data={watchedItems} />
    </div>
  );
}
