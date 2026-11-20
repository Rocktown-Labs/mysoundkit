import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Disc3,
  LayoutGrid,
  List,
  Music2,
  Search,
  Shirt,
  ShoppingBag,
  Sparkles,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import { TrackCard } from "@/components/explore/track-card";
import { PhysicalMediaVisual } from "@/components/shop/physical-media-visual";
import {
  PHYSICAL_FORMAT_LABELS,
  SHOP_CATEGORY_TABS,
  buildUnifiedShopItems,
  formatShopPrice,
  formatTechniqueLabel,
} from "@/components/shop/shop-model";
import type {
  ShopCategoryFilter,
  ShopSortOption,
  UnifiedShopItem,
} from "@/components/shop/shop-model";
import {
  ShopMerchCard,
  ShopPhysicalReleaseCard,
} from "@/components/shop/shop-product-card";
import { AppImage } from "@/components/ui/app-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useGenresQuery,
  usePublicMerchQuery,
  usePublicPhysicalReleasesQuery,
  useTracksQuery,
} from "@/lib/soundkit-api-hooks";
import type { TrackSummary } from "@/lib/soundkit-api-hooks";
import { cn } from "@/lib/utils";

interface ShopSearch {
  category?: ShopCategoryFilter;
  genre?: string;
  q?: string;
  sort?: ShopSortOption;
  view?: "grid" | "list";
}

const VALID_CATEGORIES = new Set<ShopCategoryFilter>([
    "accessories",
    "all",
    "apparel",
    "cd",
    "digital",
    "dvd",
    "home",
    "merch",
    "vinyl",
  ]),
  VALID_SORTS = new Set<ShopSortOption>([
    "featured",
    "newest",
    "price-asc",
    "price-desc",
  ]),
  PAGE_SIZE = 24;

export const Route = createFileRoute("/_explore/shop/")({
  component: ShopPage,
  validateSearch: (search: Record<string, unknown>): ShopSearch => ({
    category:
      typeof search.category === "string" &&
      VALID_CATEGORIES.has(search.category as ShopCategoryFilter)
        ? (search.category as ShopCategoryFilter)
        : undefined,
    genre: typeof search.genre === "string" ? search.genre : undefined,
    q: typeof search.q === "string" ? search.q : undefined,
    sort:
      typeof search.sort === "string" &&
      VALID_SORTS.has(search.sort as ShopSortOption)
        ? (search.sort as ShopSortOption)
        : undefined,
    view:
      search.view === "list" || search.view === "grid"
        ? search.view
        : undefined,
  }),
});

function ShopPage() {
  const search = Route.useSearch(),
    navigate = useNavigate({ from: Route.fullPath }),
    activeCategory: ShopCategoryFilter = search.category ?? "all",
    activeGenre = search.genre ?? "all",
    activeSort: ShopSortOption = search.sort ?? "featured",
    viewMode: "grid" | "list" = search.view ?? "grid",
    [searchInput, setSearchInput] = useState(search.q ?? ""),
    [currentPage, setCurrentPage] = useState(1),
    genresQuery = useGenresQuery(),
    genres = genresQuery.data ?? [],
    merchQuery = usePublicMerchQuery({ limit: 50 }),
    physicalQuery = usePublicPhysicalReleasesQuery({ limit: 60 }),
    tracksQuery = useTracksQuery(undefined, {
      forSale: true,
      genre: activeGenre,
      limit: 100,
      region: "us-arkansas",
      regionType: "north-america",
      scope: "public",
      sort: "plays-desc",
    }),
    merchDesigns = merchQuery.data ?? [],
    physicalReleases = physicalQuery.data ?? [],
    rawTracks = tracksQuery.data ?? [],
    isLoading =
      merchQuery.isLoading || physicalQuery.isLoading || tracksQuery.isLoading,
    unifiedItems = useMemo(
      () =>
        buildUnifiedShopItems({
          category: activeCategory,
          genre: activeGenre,
          merchDesigns,
          physicalReleases,
          query: searchInput,
          sort: activeSort,
          tracks: rawTracks,
        }),
      [
        activeCategory,
        activeGenre,
        activeSort,
        merchDesigns,
        physicalReleases,
        rawTracks,
        searchInput,
      ]
    ),
    totalPages = Math.ceil(unifiedItems.length / PAGE_SIZE) || 1,
    safePage = Math.min(currentPage, totalPages),
    paginatedItems = unifiedItems.slice(
      (safePage - 1) * PAGE_SIZE,
      safePage * PAGE_SIZE
    ),
    showShowcaseRails =
      activeCategory === "all" &&
      activeGenre === "all" &&
      searchInput.trim().length === 0 &&
      activeSort === "featured" &&
      viewMode === "grid",
    showGenreFilter =
      activeCategory === "all" ||
      activeCategory === "digital" ||
      activeCategory === "vinyl" ||
      activeCategory === "cd" ||
      activeCategory === "dvd",
    updateSearch = (patch: Partial<ShopSearch>) => {
      setCurrentPage(1);
      void navigate({
        replace: true,
        search: (prev) => ({
          ...prev,
          ...patch,
        }),
      });
    };

  return (
    <div className="flex flex-col gap-8 px-4 py-5 pb-16 md:px-6 md:py-7 lg:px-8 lg:py-8">
      {/* Header */}
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              <Sparkles className="size-3" data-icon="inline-start" />
              Official Creator Store
            </Badge>
          </div>
          <h1 className="font-bold text-3xl tracking-tight md:text-4xl">
            SoundKit Store
          </h1>
          <p className="max-w-2xl text-muted-foreground text-sm md:text-base">
            Shop creator-designed apparel &amp; merch, limited vinyl pressings,
            CDs, DVDs, and lossless digital tracks directly from independent
            artists.
          </p>
        </div>

        {/* Search & Sort Controls */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search store"
              className="pr-8 pl-9"
              enterKeyHint="search"
              onChange={(event) => {
                setSearchInput(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search merch, vinyl, tracks…"
              type="search"
              value={searchInput}
            />
            {searchInput ? (
              <button
                aria-label="Clear search"
                className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setSearchInput("");
                  setCurrentPage(1);
                }}
                type="button"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>

          <Select
            onValueChange={(value) =>
              updateSearch({ sort: value as ShopSortOption })
            }
            value={activeSort}
          >
            <SelectTrigger
              aria-label="Sort products"
              className="w-full sm:w-44"
            >
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="featured">Featured</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="price-asc">Price: Low to High</SelectItem>
                <SelectItem value="price-desc">Price: High to Low</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* Primary Category Bar + View Toggle */}
      <div className="flex flex-col gap-3 border-border/50 border-b pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="shop-snap-rail no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1">
            {SHOP_CATEGORY_TABS.map((tab) => {
              const isActive = activeCategory === tab.id;
              return (
                <Button
                  className={cn(
                    "shop-snap-item shrink-0 rounded-full text-xs transition-transform active:scale-[0.97]",
                    !isActive && "border-border/50"
                  )}
                  key={tab.id}
                  onClick={() => updateSearch({ category: tab.id })}
                  size="sm"
                  variant={isActive ? "default" : "outline"}
                >
                  {tab.label}
                </Button>
              );
            })}
          </div>

          <div className="flex shrink-0 items-center rounded-lg border border-border/50 bg-muted/40 p-1">
            <Button
              aria-label="Grid view"
              className="size-7 rounded"
              onClick={() => updateSearch({ view: "grid" })}
              size="icon"
              variant={viewMode === "grid" ? "default" : "ghost"}
            >
              <LayoutGrid className="size-3.5" />
            </Button>
            <Button
              aria-label="List view"
              className="size-7 rounded"
              onClick={() => updateSearch({ view: "list" })}
              size="icon"
              variant={viewMode === "list" ? "default" : "ghost"}
            >
              <List className="size-3.5" />
            </Button>
          </div>
        </div>

        {/* Genre Pills */}
        {showGenreFilter && genres.length > 0 ? (
          <div className="shop-snap-rail no-scrollbar flex items-center gap-1.5 overflow-x-auto pt-0.5">
            <Button
              className="shop-snap-item shrink-0 rounded-full text-xs"
              onClick={() => updateSearch({ genre: "all" })}
              size="sm"
              variant={activeGenre === "all" ? "secondary" : "ghost"}
            >
              All Genres
            </Button>
            {genres.map((genre) => (
              <Button
                className="shop-snap-item shrink-0 rounded-full text-xs"
                key={genre.slug}
                onClick={() => updateSearch({ genre: genre.slug })}
                size="sm"
                variant={activeGenre === genre.slug ? "secondary" : "ghost"}
              >
                {genre.name}
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Curated Showcase Rails (All + Default view) */}
      {showShowcaseRails ? (
        <div className="flex flex-col gap-10">
          {/* Creator Merch & Apparel Rail */}
          {merchQuery.isLoading || merchDesigns.length > 0 ? (
            <section className="flex flex-col gap-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-xl">
                    Creator Merch &amp; Apparel
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    Print-on-demand tees, hoodies, hats, and accessories shipped
                    worldwide.
                  </p>
                </div>
                <Button
                  onClick={() => updateSearch({ category: "merch" })}
                  size="sm"
                  variant="ghost"
                >
                  Explore Merch
                </Button>
              </div>
              {merchQuery.isLoading ? (
                <ShopCardGridSkeleton count={5} />
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {merchDesigns.slice(0, 10).map((merch) => (
                    <ShopMerchCard key={merch.id} merch={merch} />
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {/* Physical Media (Vinyl, CD, DVD) Rail */}
          {physicalQuery.isLoading || physicalReleases.length > 0 ? (
            <section className="flex flex-col gap-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-xl">
                    Vinyl, CDs &amp; DVDs
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    Collectible physical pressings and video editions paired
                    with instant digital downloads.
                  </p>
                </div>
                <Button
                  onClick={() => updateSearch({ category: "vinyl" })}
                  size="sm"
                  variant="ghost"
                >
                  Browse Vinyl
                </Button>
              </div>
              {physicalQuery.isLoading ? (
                <ShopCardGridSkeleton count={5} />
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {physicalReleases.slice(0, 10).map((release) => (
                    <ShopPhysicalReleaseCard
                      key={release.id}
                      release={release}
                    />
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {/* Digital Tracks & Licenses */}
          <section className="flex flex-col gap-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="font-semibold text-xl">
                  Digital Releases &amp; Licenses
                </h2>
                <p className="text-muted-foreground text-sm">
                  Instant high-resolution downloads, beats, and commercial
                  licenses.
                </p>
              </div>
              <Button
                onClick={() => updateSearch({ category: "digital" })}
                size="sm"
                variant="ghost"
              >
                View All Digital
              </Button>
            </div>
            {tracksQuery.isLoading ? (
              <ShopCardGridSkeleton count={6} />
            ) : (rawTracks.filter((t) => t.isForSale).length > 0 ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {rawTracks
                  .filter((t) => t.isForSale)
                  .slice(0, 18)
                  .map((track) => (
                    <ShopTrackCard key={track.id} track={track} />
                  ))}
              </div>
            ) : (
              <ShopEmptyState
                onReset={() => {
                  setSearchInput("");
                  updateSearch({ category: "all", genre: "all" });
                }}
              />
            ))}
          </section>
        </div>
      ) : (
        /* Filtered / Search / List Results */
        <section className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-muted-foreground text-sm">
              Showing{" "}
              <span className="font-medium text-foreground">
                {unifiedItems.length}
              </span>{" "}
              {unifiedItems.length === 1 ? "item" : "items"}
            </p>
            {(activeCategory !== "all" ||
              activeGenre !== "all" ||
              searchInput.trim().length > 0) && (
              <Button
                onClick={() => {
                  setSearchInput("");
                  updateSearch({
                    category: "all",
                    genre: "all",
                    sort: "featured",
                  });
                }}
                size="sm"
                variant="ghost"
              >
                Reset filters
              </Button>
            )}
          </div>

          {isLoading ? (
            <ShopCardGridSkeleton count={8} />
          ) : paginatedItems.length === 0 ? (
            <ShopEmptyState
              onReset={() => {
                setSearchInput("");
                updateSearch({ category: "all", genre: "all" });
              }}
            />
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {paginatedItems.map((item) => {
                if (item.kind === "merch") {
                  return (
                    <ShopMerchCard
                      key={`merch-${item.merch.id}`}
                      merch={item.merch}
                    />
                  );
                }
                if (item.kind === "release") {
                  return (
                    <ShopPhysicalReleaseCard
                      key={`release-${item.release.id}`}
                      release={item.release}
                    />
                  );
                }
                return (
                  <ShopTrackCard
                    key={`track-${item.track.id}`}
                    track={item.track}
                  />
                );
              })}
            </div>
          ) : (
            <ShopListTable items={paginatedItems} />
          )}

          {totalPages > 1 ? (
            <div className="flex items-center justify-center gap-3 pt-4">
              <Button
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                size="sm"
                variant="outline"
              >
                Previous
              </Button>
              <span className="text-muted-foreground text-xs tabular-nums">
                Page {safePage} of {totalPages}
              </span>
              <Button
                disabled={safePage >= totalPages}
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                size="sm"
                variant="outline"
              >
                Next
              </Button>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}

function ShopTrackCard({ track }: { track: TrackSummary }) {
  return (
    <div className="flex flex-col gap-2">
      <TrackCard
        artist={track.artistName}
        artistSlug={track.artistUsername ?? "artist"}
        cover={track.coverArtUrl ?? "/placeholder.svg"}
        duration={track.duration}
        id={track.id}
        plays={track.plays.toLocaleString()}
        regionSlug={track.regionSlug}
        slug={track.slug}
        title={track.title}
      />
      <div className="flex items-center justify-between px-1">
        <span className="font-semibold text-primary text-xs">
          {formatShopPrice(track.priceCents)}
        </span>
        <Button
          asChild
          className="h-6 px-2 text-[10px]"
          size="sm"
          variant="secondary"
        >
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

function ShopListTable({ items }: { items: UnifiedShopItem[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/50 bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead className="hidden sm:table-cell">Format</TableHead>
            <TableHead className="hidden md:table-cell">Creator</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="w-28 text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            if (item.kind === "merch") {
              return (
                <TableRow key={`merch-${item.merch.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="size-11 shrink-0 overflow-hidden rounded-md bg-muted">
                        {item.merch.previewMockupUrl ? (
                          <AppImage
                            alt={item.merch.title}
                            className="size-full object-cover"
                            height={88}
                            src={item.merch.previewMockupUrl}
                            width={88}
                          />
                        ) : (
                          <div className="flex size-full items-center justify-center text-muted-foreground">
                            <Shirt className="size-4" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-sm">
                          {item.merch.title}
                        </p>
                        <p className="truncate text-muted-foreground text-xs md:hidden">
                          {item.merch.artistName ?? "SoundKit Creator"}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="outline">
                      {item.merch.category ?? "Merch"} ·{" "}
                      {formatTechniqueLabel(item.merch.technique)}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground text-sm md:table-cell">
                    {item.merch.artistName ?? "SoundKit Creator"}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-primary tabular-nums">
                    {formatShopPrice(item.merch.retailPriceCents)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="secondary">
                      <Link
                        params={{ id: item.merch.id }}
                        search={{ type: "merch" }}
                        to="/shop/$id"
                      >
                        View
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            }

            if (item.kind === "release") {
              return (
                <TableRow key={`release-${item.release.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="size-11 shrink-0 overflow-hidden rounded-md">
                        <PhysicalMediaVisual
                          artworkUrl={item.release.coverArtUrl}
                          format={item.release.mediaFormat}
                          size="sm"
                          title={item.release.title}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-sm">
                          {item.release.title}
                        </p>
                        <p className="truncate text-muted-foreground text-xs md:hidden">
                          {item.release.artistName ?? "SoundKit Artist"}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="secondary">
                      <Disc3 className="size-3" data-icon="inline-start" />
                      {PHYSICAL_FORMAT_LABELS[item.release.mediaFormat]}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground text-sm md:table-cell">
                    {item.release.artistName ?? "SoundKit Artist"}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-primary tabular-nums">
                    {formatShopPrice(item.release.retailPriceCents)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="secondary">
                      <Link
                        params={{ id: item.release.id }}
                        search={{ type: "release" }}
                        to="/shop/$id"
                      >
                        View
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            }

            return (
              <TableRow key={`track-${item.track.id}`}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="size-11 shrink-0 overflow-hidden rounded-md bg-muted">
                      <AppImage
                        alt={item.track.title}
                        className="size-full object-cover"
                        height={88}
                        src={item.track.coverArtUrl ?? "/placeholder.svg"}
                        width={88}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-sm">
                        {item.track.title}
                      </p>
                      <p className="truncate text-muted-foreground text-xs md:hidden">
                        {item.track.artistName}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Badge variant="outline">
                    <Music2 className="size-3" data-icon="inline-start" />
                    Digital
                  </Badge>
                </TableCell>
                <TableCell className="hidden text-muted-foreground text-sm md:table-cell">
                  {item.track.artistName}
                </TableCell>
                <TableCell className="text-right font-semibold text-primary tabular-nums">
                  {formatShopPrice(item.track.priceCents)}
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild size="sm" variant="secondary">
                    <Link
                      params={
                        item.track.regionSlug && item.track.slug
                          ? {
                              regionSlug: item.track.regionSlug,
                              slug: item.track.slug,
                            }
                          : { id: item.track.id }
                      }
                      to={
                        item.track.regionSlug && item.track.slug
                          ? "/tracks/$regionSlug/$slug"
                          : "/tracks/$id"
                      }
                    >
                      View
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function ShopCardGridSkeleton({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: count }).map((_, index) => (
        <div
          className="flex flex-col gap-3 overflow-hidden rounded-xl border border-border/40 bg-card p-3"
          key={index}
        >
          <Skeleton className="aspect-[4/5] w-full rounded-lg" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      ))}
    </div>
  );
}

function ShopEmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/60 bg-card/40 px-6 py-14 text-center">
      <ShoppingBag className="size-10 text-muted-foreground opacity-50" />
      <div className="flex flex-col gap-1">
        <h3 className="font-semibold text-base text-foreground">
          No store items match your filters
        </h3>
        <p className="max-w-md text-muted-foreground text-sm">
          Try clearing your search or switching categories to explore merch,
          vinyl pressings, CDs, DVDs, and digital releases.
        </p>
      </div>
      <Button onClick={onReset} size="sm" variant="outline">
        Show all products
      </Button>
    </div>
  );
}
