import { createFileRoute, Link } from "@tanstack/react-router";
import { LoaderCircle, PlayCircle } from "lucide-react";
import { useEffect } from "react";
import { useInView } from "react-intersection-observer";

import { useAudioPlayer } from "@/components/audio-player-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useOpenVersesInfiniteQuery } from "@/lib/soundkit-api-hooks";
import type { OpenVerseListing } from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/open-verses/$genre")({
  component: OpenVerseGenrePage,
});

const titleFromSlug = (slug: string) =>
  slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

function OpenVerseListItem({ listing }: { listing: OpenVerseListing }) {
  const { setCurrentTrack, setQueue } = useAudioPlayer(),

   playListing = () => {
    if (!listing.playbackUrl) {
      return;
    }

    const playerTrack = {
      artist: listing.artistName,
      artistHref: listing.artistUsername
        ? `/artist/${listing.artistUsername}`
        : "/dashboard/profile",
      cover: listing.coverArtUrl ?? "/placeholder.svg",
      id: listing.trackId,
      src: listing.playbackUrl,
      title: listing.trackTitle,
      trackHref: `/tracks/${listing.trackId}`,
    };

    setQueue([playerTrack]);
    setCurrentTrack(playerTrack);
  };

  return (
    <Card className="border-border/40 bg-card/50">
      <CardContent className="flex gap-4 p-4">
        <button
          aria-label={`Play ${listing.trackTitle}`}
          className="flex size-20 shrink-0 items-center justify-center rounded-md border bg-muted bg-cover bg-center"
          disabled={!listing.playbackUrl}
          onClick={playListing}
          style={{
            backgroundImage: listing.coverArtUrl
              ? `url(${listing.coverArtUrl})`
              : undefined,
          }}
          type="button"
        >
          <PlayCircle className="size-7 text-primary" />
        </button>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-1">
            <Link
              className="block truncate font-semibold hover:text-primary"
              params={{ genre: listing.genreSlug, id: listing.id }}
              to="/dashboard/open-verses/$genre/$id"
            >
              {listing.title}
            </Link>
            <p className="truncate text-sm text-muted-foreground">
              {listing.artistName} • {listing.trackTitle}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{listing.genre}</Badge>
            {listing.bpm && <Badge variant="outline">{listing.bpm} BPM</Badge>}
            {listing.musicalKey && (
              <Badge variant="outline">{listing.musicalKey}</Badge>
            )}
            <Badge variant="outline">{listing.submissionCount} submitted</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OpenVerseGenrePage() {
  const { genre } = Route.useParams(),
   query = useOpenVersesInfiniteQuery({ genre, limit: "20" }),
   listings = query.data?.pages.flatMap((page) => page.items) ?? [],
   { inView, ref } = useInView({ rootMargin: "320px" });

  useEffect(() => {
    if (inView && query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  }, [inView, query]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-bold">
          {titleFromSlug(genre)} Open Verses
        </h1>
        <p className="mt-1 text-muted-foreground">
          Browse real open slots and load more as the catalog grows.
        </p>
      </div>

      <div className="space-y-3">
        {listings.map((listing) => (
          <OpenVerseListItem key={listing.id} listing={listing} />
        ))}
      </div>

      {query.isLoading && (
        <Card>
          <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            Loading open verses...
          </CardContent>
        </Card>
      )}

      {!query.isLoading && listings.length === 0 && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            No open verses are available in this genre yet.
          </CardContent>
        </Card>
      )}

      <div ref={ref} />
    </div>
  );
}
