import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Play,
  ShoppingBag,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
} from "lucide-react";
import { useState } from "react";

import { TrackCard } from "@/components/explore/track-card";
import { AppImage } from "@/components/ui/app-image";
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
import { useTracksQuery, type TrackSummary } from "@/lib/soundkit-api-hooks";

interface ShopSearch {
  genre?: string;
  view?: "grid" | "list";
}

export const Route = createFileRoute("/_explore/shop")({
  component: ShopPage,
  validateSearch: (search: Record<string, unknown>): ShopSearch => ({
    genre: typeof search.genre === "string" ? search.genre : undefined,
    view:
      search.view === "list" || search.view === "grid"
        ? search.view
        : undefined,
  }),
});

const PAGE_SIZE = 20;

function ShopPage() {
  const search = Route.useSearch();
  const activeGenre = search.genre ?? "all";
  const [viewMode, setViewMode] = useState<"grid" | "list">(
    search.view ?? "grid"
  );
  const [currentPage, setCurrentPage] = useState(1);

  const { data: rawTracks = [], isLoading } = useTracksQuery(undefined, {
    forSale: true,
    genre: activeGenre,
    limit: 100,
    region: "us-arkansas",
    regionType: "north-america",
    scope: "public",
    sort: "plays-desc",
  });

  // Ensure we filter for purchasability if backend flags it
  const shopTracks = rawTracks.filter(
    (t) => t.isPurchasable ?? t.isForSale ?? true
  );

  const totalPages = Math.ceil(shopTracks.length / PAGE_SIZE) || 1;
  const paginatedTracks = shopTracks.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const activeGenreLabel =
    musicGenres.find((g) => g.value === activeGenre)?.label ?? "All Genres";

  return (
    <div className="px-4 py-4 md:px-6 md:py-6 lg:px-8 lg:py-8">
      {/* Header Section */}
      <section className="mb-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="flex items-center gap-2 font-bold text-3xl md:text-4xl">
              <ShoppingBag className="size-8 text-primary" />
              SoundKit Store
            </h1>
            <p className="mt-1 max-w-2xl text-muted-foreground text-sm md:text-base">
              Buy beats, stems, and commercial licenses directly from verified SoundKit creators.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/tracks">Explore Songs</Link>
          </Button>
        </div>
      </section>

      {/* Filter and View Controls Bar */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/40 pb-4">
        {/* Genre Pill Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full no-scrollbar">
          <Button
            size="sm"
            variant={activeGenre === "all" ? "default" : "secondary"}
            className="rounded-full shrink-0 text-xs"
            onClick={() => setCurrentPage(1)}
            asChild
          >
            <Link to="/shop" search={{ genre: "all", view: viewMode }}>
              All Genres
            </Link>
          </Button>
          {musicGenres.map((g) => (
            <Button
              key={g.value}
              size="sm"
              variant={activeGenre === g.value ? "default" : "outline"}
              className="rounded-full shrink-0 text-xs border-border/40"
              onClick={() => setCurrentPage(1)}
              asChild
            >
              <Link to="/shop" search={{ genre: g.value, view: viewMode }}>
                {g.label}
              </Link>
            </Button>
          ))}
        </div>

        {/* Grid vs List View Toggle */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <div className="flex items-center rounded-lg border border-border/40 p-1 bg-muted/40">
            <Button
              size="icon"
              variant={viewMode === "grid" ? "default" : "ghost"}
              className="size-7 rounded"
              onClick={() => setViewMode("grid")}
              title="Grid View"
            >
              <LayoutGrid className="size-3.5" />
            </Button>
            <Button
              size="icon"
              variant={viewMode === "list" ? "default" : "ghost"}
              className="size-7 rounded"
              onClick={() => setViewMode("list")}
              title="List View"
            >
              <List className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Section */}
      <section className="mb-10">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-xl md:text-2xl">
              {activeGenre === "all" ? "Featured Purchasable Songs" : `${activeGenreLabel} Catalog`}
            </h2>
            <p className="text-xs md:text-sm text-muted-foreground">
              Showing {shopTracks.length} purchasable release{shopTracks.length === 1 ? "" : "s"}
            </p>
          </div>

          {/* Pagination Controls top */}
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-xs text-muted-foreground font-medium">
                {currentPage} / {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Render Grid View */}
        {viewMode === "grid" && (
          <div>
            {isLoading || paginatedTracks.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {paginatedTracks.map((track) => (
                  <ShopTrackCard key={track.id} track={track} />
                ))}
              </div>
            ) : (
              <ShopEmptyState genreLabel={activeGenreLabel} />
            )}
          </div>
        )}

        {/* Render List View */}
        {viewMode === "list" && (
          <div className="rounded-lg border border-border/40 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Track</TableHead>
                  <TableHead>Artist</TableHead>
                  <TableHead>Genre</TableHead>
                  <TableHead>Plays</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading || paginatedTracks.length > 0 ? (
                  paginatedTracks.map((track) => (
                    <TableRow key={track.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <AppImage
                            src={track.coverArtUrl ?? "/placeholder.svg"}
                            alt={track.title}
                            width={40}
                            height={40}
                            className="size-10 rounded object-cover"
                          />
                          <span>{track.title}</span>
                        </div>
                      </TableCell>
                      <TableCell>{track.artistName}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{track.genre ?? "Single"}</Badge>
                      </TableCell>
                      <TableCell>{track.plays.toLocaleString()}</TableCell>
                      <TableCell className="font-semibold text-primary">
                        {track.priceLabel ?? "$1.99"}
                      </TableCell>
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
                              <Play className="size-3.5 mr-1" />
                              Listen
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
                              <ShoppingCart className="size-3.5 mr-1" />
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
                      className="py-12 text-center text-muted-foreground"
                      colSpan={6}
                    >
                      No purchasable tracks found for {activeGenreLabel}.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Bottom Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        )}
      </section>

      {/* Genre Rails if 'all' is selected */}
      {activeGenre === "all" && (
        <div className="flex flex-col gap-10">
          {musicGenres.map((genre) => (
            <GenreShopRail key={genre.value} genre={genre} viewMode={viewMode} />
          ))}
        </div>
      )}
    </div>
  );
}

function ShopTrackCard({ track }: { track: TrackSummary }) {
  return (
    <div className="flex flex-col gap-2">
      <TrackCard
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
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-semibold text-primary">
          {track.priceLabel ?? "$1.99"}
        </span>
        <Button asChild size="xs" variant="secondary" className="h-6 text-[10px] px-2">
          <Link
            params={
              track.regionSlug && track.slug
                ? { regionSlug: track.regionSlug, slug: track.slug }
                : { id: track.id }
            }
            to={
              track.regionSlug && track.slug
                ? "/tracks/$regionSlug/$slug"
                : "/tracks/$id"
            }
          >
            Buy License
          </Link>
        </Button>
      </div>
    </div>
  );
}

function GenreShopRail({
  genre,
  viewMode,
}: {
  genre: (typeof musicGenres)[number];
  viewMode: "grid" | "list";
}) {
  const { data: tracks = [] } = useTracksQuery(undefined, {
    forSale: true,
    genre: genre.value,
    limit: 12,
    region: "us-arkansas",
    regionType: "north-america",
    scope: "public",
    sort: "plays-desc",
  });

  const shopTracks = tracks.filter(
    (t) => t.isPurchasable ?? t.isForSale ?? true
  );

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-xl">{genre.label}</h2>
          <p className="text-muted-foreground text-sm">
            Top purchasable tracks in {genre.label}.
          </p>
        </div>
        <Button asChild size="sm" variant="ghost">
          <Link to="/shop" search={{ genre: genre.value, view: viewMode }}>
            View All {genre.label}
          </Link>
        </Button>
      </div>
      {shopTracks.length > 0 ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {shopTracks.map((track) => (
            <ShopTrackCard key={track.id} track={track} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-6 text-muted-foreground text-sm">
          No {genre.label} tracks are currently listed for sale.
        </div>
      )}
    </section>
  );
}

function ShopEmptyState({ genreLabel }: { genreLabel: string }) {
  return (
    <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
      <ShoppingBag className="mx-auto size-10 mb-3 opacity-50" />
      <h3 className="font-semibold text-foreground text-base">No purchasable tracks found</h3>
      <p className="mt-1 text-sm">
        No tracks in {genreLabel} are listed for sale yet. Check back soon as creators release new beats.
      </p>
    </div>
  );
}
