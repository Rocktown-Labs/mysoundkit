import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Radio } from "lucide-react";

import { streamDiscoveryItems } from "@/components/explore/live-discovery-data";
import { SectionHeader } from "@/components/explore/section-header";
import { StreamCard } from "@/components/explore/stream-card";
import { Button } from "@/components/ui/button";
import { musicGenres } from "@/lib/music-genres";

export const Route = createFileRoute("/_explore/live/streams/")({
  component: LiveStreamsPage,
  validateSearch: (search: Record<string, unknown>) => ({
    genre: typeof search.genre === "string" ? search.genre : undefined,
  }),
});

function StreamRail({
  genreValue,
  items,
  title,
}: {
  genreValue?: string;
  items: typeof streamDiscoveryItems;
  title: string;
}) {
  return (
    <section className="space-y-3">
      <SectionHeader
        title={title}
        description="Creator broadcasts, studio sessions, and replays."
        viewAllHref={
          genreValue ? `/live/streams?genre=${genreValue}` : "/live/streams"
        }
      />
      {items.length > 0 ? (
        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-max gap-4 md:gap-6">
            {items.map((stream) => (
              <StreamCard key={stream.id} {...stream} />
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-6 text-muted-foreground text-sm">
          No {title} creator streams are live yet.
        </div>
      )}
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

      {musicGenres.map((genre) => (
        <StreamRail
          genreValue={genre.value}
          items={streamDiscoveryItems.filter(
            (stream) => stream.genre === genre.label
          )}
          key={genre.value}
          title={genre.label}
        />
      ))}
    </div>
  );
}
