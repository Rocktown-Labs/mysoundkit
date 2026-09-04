/* eslint-disable one-var, no-nested-ternary, unicorn/no-nested-ternary, no-void, react/set-state-in-effect, react/todo */
"use client";

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  LoaderCircle,
  MapPin,
  UserCheck,
} from "lucide-react";
import { useEffect, useState } from "react";

import { loadArtistDiscoveryPage } from "@/lib/api";
import type { BioArtistSearchResult } from "@/lib/api";

interface ArtistDiscoverySearch {
  region: string;
  regionType: "north-america" | "global";
}

export const Route = createFileRoute("/artists")({
  component: BioArtistsPage,
  validateSearch: (search: Record<string, unknown>): ArtistDiscoverySearch => ({
    region: typeof search.region === "string" ? search.region : "us-arkansas",
    regionType: search.regionType === "global" ? "global" : "north-america",
  }),
});

function BioArtistsPage() {
  const { region, regionType } = Route.useSearch(),
    [artists, setArtists] = useState<BioArtistSearchResult[]>([]),
    [nextCursor, setNextCursor] = useState<string | null>(null),
    [hasMore, setHasMore] = useState(false),
    [isLoading, setIsLoading] = useState(true),
    [isLoadingMore, setIsLoadingMore] = useState(false),
    [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setArtists([]);
    setNextCursor(null);

    const loadInitialPage = async () => {
      try {
        const page = await loadArtistDiscoveryPage({
          limit: 12,
          region,
          regionType,
        });
        if (cancelled) {
          return;
        }
        setArtists(page.artists);
        setHasMore(page.hasMore);
        setNextCursor(page.nextCursor);
      } catch {
        if (!cancelled) {
          setError("We could not load artists for this region.");
          setHasMore(false);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadInitialPage();
    return () => {
      cancelled = true;
    };
  }, [region, regionType]);

  const loadMore = async () => {
      if (!(nextCursor && !isLoadingMore)) {
        return;
      }

      setIsLoadingMore(true);
      try {
        const page = await loadArtistDiscoveryPage({
          cursor: nextCursor,
          limit: 12,
          region,
          regionType,
        });
        setArtists((current) => [...current, ...page.artists]);
        setHasMore(page.hasMore);
        setNextCursor(page.nextCursor);
      } catch {
        setError("We could not load more artists. Please try again.");
      } finally {
        setIsLoadingMore(false);
      }
    },
    regionLabel = region === "all" ? "the world" : region.replace(/^us-/u, "");

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 sm:px-6 sm:py-10">
      <header className="space-y-4">
        <Link
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          to="/"
        >
          <ArrowLeft className="size-4" />
          Back to discovery
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Regional discovery
            </p>
            <h1 className="mt-2 font-playfair text-3xl font-medium text-foreground sm:text-5xl">
              Artists in {regionLabel}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Explore the artists shaping this region, ranked by recent
              qualified listening, followers, and durable catalog engagement.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            Sorted by momentum
          </span>
        </div>
      </header>

      {error && artists.length === 0 ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-8 text-center text-sm text-destructive">
          {error}
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <LoaderCircle className="size-5 animate-spin" />
          Finding artists...
        </div>
      ) : artists.length > 0 ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {artists.map((artist, index) => (
              <ArtistDiscoveryCard
                artist={artist}
                displayRank={artist.rank ?? index + 1}
                key={artist.id}
              />
            ))}
          </div>

          {error ? (
            <p className="text-center text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {hasMore && nextCursor ? (
            <div className="flex justify-center pt-2">
              <button
                className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-white/5 px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-primary/50 hover:bg-primary/10 disabled:cursor-wait disabled:opacity-60"
                disabled={isLoadingMore}
                onClick={() => void loadMore()}
                type="button"
              >
                {isLoadingMore ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : null}
                {isLoadingMore ? "Loading..." : "Load more artists"}
                {isLoadingMore ? null : <ArrowRight className="size-4" />}
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-border/60 p-12 text-center text-sm text-muted-foreground">
          No public artists were found in this region yet.
        </div>
      )}
    </main>
  );
}

function ArtistDiscoveryCard({
  artist,
  displayRank,
}: {
  artist: BioArtistSearchResult;
  displayRank: number;
}) {
  return (
    <Link
      className="group flex min-w-0 items-center gap-4 rounded-2xl border border-border/50 bg-card/40 p-4 transition-colors hover:border-primary/40 hover:bg-card/70"
      params={{ username: artist.username }}
      to="/$username"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/5 font-mono text-xs font-bold text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground">
        {displayRank}
      </span>
      <div className="size-14 shrink-0 overflow-hidden rounded-full border border-border/50 bg-black/40">
        {artist.avatarUrl ? (
          <img
            alt={artist.name}
            className="size-full object-cover"
            decoding="async"
            height={56}
            loading="lazy"
            src={artist.avatarUrl}
            width={56}
          />
        ) : (
          <div className="flex size-full items-center justify-center font-semibold text-primary">
            {artist.name[0]?.toUpperCase()}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h2 className="truncate font-semibold text-foreground">
            {artist.name}
          </h2>
          {artist.verified ? (
            <UserCheck className="size-4 shrink-0 text-primary" />
          ) : null}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          @{artist.username} · {artist.genre}
        </p>
        <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground/80">
          <MapPin className="size-3 shrink-0" />
          {artist.location || "Location not listed"}
        </p>
      </div>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
    </Link>
  );
}
