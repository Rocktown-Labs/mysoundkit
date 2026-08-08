import { createFileRoute, Link } from "@tanstack/react-router";
import { Play, ShoppingBag } from "lucide-react";

import { TrackCard } from "@/components/explore/track-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { musicGenres } from "@/lib/music-genres";
import { useTracksQuery } from "@/lib/soundkit-api-hooks";

interface ShopSearch {
  genre?: string;
}

export const Route = createFileRoute("/_explore/shop")({
  component: ShopPage,
  validateSearch: (search: Record<string, unknown>): ShopSearch => ({
    genre: typeof search.genre === "string" ? search.genre : undefined,
  }),
});

function ShopPage() {
  const search = Route.useSearch();
  const activeGenre = search.genre ?? "all";
  const { data: featuredTracks = [] } = useTracksQuery(undefined, {
    genre: activeGenre,
    limit: 25,
    region: "us-arkansas",
    regionType: "north-america",
    scope: "public",
    sort: "plays-desc",
  });

  return (
    <div className="px-4 py-4 md:px-6 md:py-6 lg:px-8 lg:py-8">
      <section className="mb-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="flex items-center gap-2 font-bold text-3xl md:text-4xl">
              <ShoppingBag className="size-8 text-primary" />
              Shop
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Buy tracks, preview songs, and discover catalog releases from
              SoundKit artists.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/tracks">Explore Songs</Link>
          </Button>
        </div>
      </section>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={activeGenre === "all" ? "default" : "outline"}
          asChild
        >
          <Link to="/shop" search={{ genre: "all" }}>
            All Genres
          </Link>
        </Button>
        {musicGenres.map((g) => (
          <Button
            key={g.value}
            size="sm"
            variant={activeGenre === g.value ? "default" : "outline"}
            asChild
          >
            <Link to="/shop" search={{ genre: g.value }}>
              {g.label}
            </Link>
          </Button>
        ))}
      </div>

      <section className="mb-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-xl">Featured & Recommended</h2>
          <Button asChild size="sm" variant="ghost">
            <Link to="/shop" search={{ genre: activeGenre }}>
              View All
            </Link>
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Track</TableHead>
              <TableHead>Artist</TableHead>
              <TableHead>Genre</TableHead>
              <TableHead>Plays</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {featuredTracks.length > 0 ? (
              featuredTracks.slice(0, 25).map((track) => (
                <TableRow key={track.id}>
                  <TableCell className="font-medium">{track.title}</TableCell>
                  <TableCell>{track.artistName}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{track.genre}</Badge>
                  </TableCell>
                  <TableCell>{track.plays.toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button asChild size="sm" variant="ghost">
                        <Link
                          params={
                            track.regionSlug && track.slug
                              ? {
                                  regionSlug: track.regionSlug,
                                  slug: track.slug,
                                }
                              : { id: track.id }
                          }
                          to={
                            track.regionSlug && track.slug
                              ? "/tracks/$regionSlug/$slug"
                              : "/tracks/$id"
                          }
                        >
                          <Play className="size-4" />
                          Play
                        </Link>
                      </Button>
                      <Button asChild size="sm">
                        <Link
                          params={
                            track.regionSlug && track.slug
                              ? {
                                  regionSlug: track.regionSlug,
                                  slug: track.slug,
                                }
                              : { id: track.id }
                          }
                          to={
                            track.regionSlug && track.slug
                              ? "/tracks/$regionSlug/$slug"
                              : "/tracks/$id"
                          }
                        >
                          Buy
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  className="py-8 text-center text-muted-foreground"
                  colSpan={5}
                >
                  No tracks are listed for sale yet. Explore songs while artists
                  add purchasable catalog.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>

      <div className="flex flex-col gap-10">
        {musicGenres.map((genre) => (
          <GenreShopRail key={genre.value} genre={genre} />
        ))}
      </div>
    </div>
  );
}

function GenreShopRail({ genre }: { genre: (typeof musicGenres)[number] }) {
  const { data: tracks = [] } = useTracksQuery(undefined, {
    genre: genre.value,
    limit: 12,
    region: "us-arkansas",
    regionType: "north-america",
    scope: "public",
    sort: "plays-desc",
  });

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-xl">{genre.label}</h2>
          <p className="text-muted-foreground text-sm">
            Top purchasable songs in this lane.
          </p>
        </div>
        <Button asChild size="sm" variant="ghost">
          <Link to="/shop" search={{ genre: genre.value }}>
            View All
          </Link>
        </Button>
      </div>
      {tracks.length > 0 ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {tracks.map((track) => (
            <TrackCard
              key={track.id}
              id={track.id}
              title={track.title}
              artist={track.artistName}
              artistSlug={track.artistUsername ?? "artist"}
              cover={track.coverArtUrl ?? "/placeholder.svg"}
              plays={track.plays.toLocaleString()}
              duration={track.duration}
              regionSlug={track.regionSlug}
              slug={track.slug}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-6 text-muted-foreground text-sm">
          No {genre.label} tracks are listed for sale yet.
        </div>
      )}
    </section>
  );
}
