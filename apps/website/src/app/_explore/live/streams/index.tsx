import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Radio } from "lucide-react";

import {
  liveDiscoveryGenres,
  streamDiscoveryItems,
} from "@/components/explore/live-discovery-data";
import { SectionHeader } from "@/components/explore/section-header";
import { StreamCard } from "@/components/explore/stream-card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_explore/live/streams/")({
  component: LiveStreamsPage,
});

function StreamRail({
  items,
  title,
}: {
  items: typeof streamDiscoveryItems;
  title: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <SectionHeader
        title={title}
        description="Creator broadcasts, studio sessions, and replays."
        viewAllHref="/live/streams"
      />
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-4 md:gap-6">
          {items.map((stream) => (
            <StreamCard key={stream.id} {...stream} />
          ))}
        </div>
      </div>
    </section>
  );
}

function LiveStreamsPage() {
  const featured = streamDiscoveryItems.filter((stream) => stream.isFeatured);

  return (
    <div className="space-y-8 pb-8">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-bold text-2xl">
            <Radio className="size-6 text-primary" />
            Creator Streams
          </h2>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Browse live creator sessions by genre. Signed-out fans can discover
            what is happening now before logging in or upgrading to watch.
          </p>
        </div>
        <Button asChild>
          <Link to="/login">
            <Plus className="mr-2 size-4" />
            Start A Stream
          </Link>
        </Button>
      </section>

      <StreamRail items={featured} title="Featured Streams" />

      {liveDiscoveryGenres.map((genre) => (
        <StreamRail
          key={genre}
          items={streamDiscoveryItems.filter(
            (stream) => stream.genre === genre
          )}
          title={genre}
        />
      ))}
    </div>
  );
}
