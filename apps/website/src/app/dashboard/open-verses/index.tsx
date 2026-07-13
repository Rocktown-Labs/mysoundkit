import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Mic2, PlayCircle, Plus } from "lucide-react";

import { useAudioPlayer } from "@/components/audio-player-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOpenVersesInfiniteQuery } from "@/lib/soundkit-api-hooks";
import type { OpenVerseListing } from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/open-verses/")({
  component: OpenVersesPage,
});

const genreRows = [
  { label: "Hip-Hop", slug: "hip-hop" },
  { label: "R&B", slug: "r-b" },
  { label: "Pop", slug: "pop" },
  { label: "Electronic", slug: "electronic" },
] as const;

function OpenVerseCard({ listing }: { listing: OpenVerseListing }) {
  const { setCurrentTrack, setQueue } = useAudioPlayer();

  const playListing = () => {
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
    <Card className="w-72 shrink-0 border-border/40 bg-card/50">
      <CardContent className="space-y-4 p-4">
        <button
          aria-label={`Play ${listing.trackTitle}`}
          className="flex aspect-square w-full items-center justify-center rounded-md border bg-muted bg-cover bg-center"
          disabled={!listing.playbackUrl}
          onClick={playListing}
          style={{
            backgroundImage: listing.coverArtUrl
              ? `url(${listing.coverArtUrl})`
              : undefined,
          }}
          type="button"
        >
          <PlayCircle className="size-10 text-primary" />
        </button>
        <div className="space-y-1">
          <h3 className="line-clamp-1 font-semibold">{listing.title}</h3>
          <p className="line-clamp-1 text-sm text-muted-foreground">
            {listing.artistName} • {listing.trackTitle}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{listing.genre}</Badge>
          <Badge variant="outline">{listing.submissionCount} submitted</Badge>
        </div>
        <Button asChild={true} className="w-full" size="sm" variant="outline">
          <Link
            params={{ genre: listing.genreSlug, id: listing.id }}
            to="/dashboard/open-verses/$genre/$id"
          >
            View Details
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function GenreRow({ label, slug }: { label: string; slug?: string }) {
  const query = useOpenVersesInfiniteQuery(
    slug ? { genre: slug, limit: "10" } : { limit: "10" }
  );
  const listings = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold text-lg">{label}</h2>
          <p className="text-sm text-muted-foreground">
            Songs with open slots from artists in this lane.
          </p>
        </div>
        {slug ? (
          <Button asChild={true} size="sm" variant="ghost">
            <Link params={{ genre: slug }} to="/dashboard/open-verses/$genre">
              View All
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        ) : (
          <Button asChild={true} size="sm" variant="ghost">
            <Link to="/dashboard/open-verses">
              View All
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        )}
      </div>
      <div className="-mx-4 overflow-x-auto px-4 pb-2">
        <div className="flex gap-4">
          {query.isLoading && (
            <Card className="w-72 shrink-0">
              <CardContent className="p-4 text-sm text-muted-foreground">
                Loading {label.toLowerCase()} open verses...
              </CardContent>
            </Card>
          )}
          {!query.isLoading && listings.length === 0 && (
            <Card className="w-72 shrink-0">
              <CardContent className="p-4 text-sm text-muted-foreground">
                No open verses in {label} yet.
              </CardContent>
            </Card>
          )}
          {listings.map((listing) => (
            <OpenVerseCard key={listing.id} listing={listing} />
          ))}
        </div>
      </div>
    </section>
  );
}

function OpenVersesPage() {
  return (
    <div className="space-y-6">
      <Card className="border-border/40 bg-card/50">
        <CardHeader className="space-y-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Mic2 className="size-5" />
              </div>
              <div>
                <CardTitle>Open Verses</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Discover tracks with open slots and submit your verse.
                </p>
              </div>
            </div>
            <Button asChild={true} className="sm:ml-auto">
              <Link to="/dashboard/open-verses/new">
                <Plus className="mr-2 size-4" />
                Publish
              </Link>
            </Button>
          </div>
        </CardHeader>
      </Card>

      <GenreRow label="All Open Verses" />

      {genreRows.map((genre) => (
        <GenreRow key={genre.slug} label={genre.label} slug={genre.slug} />
      ))}
    </div>
  );
}
