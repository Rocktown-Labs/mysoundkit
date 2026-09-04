/* eslint-disable one-var, sort-vars, complexity, no-nested-ternary, unicorn/no-nested-ternary, react/todo, react/exhaustive-effect-dependencies */
"use client";

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ChevronRight,
  LoaderCircle,
  MapPin,
  Music,
  RotateCcw,
  Trophy,
  UserCheck,
} from "lucide-react";
import React, { useEffect, useState } from "react";

import { BioMap } from "@/components/bio-map";
import { loadRegionArtists } from "@/lib/api";
import type { BioArtistSearchResult } from "@/lib/api";
import { exploreRegionSlug, regionTypeForMapScope } from "@/lib/explore-region";
import type { MapScope } from "@/lib/map-scopes";

export const Route = createFileRoute("/")({
  component: BioHomePage,
});

function BioHomePage() {
  const [mapScope, setMapScope] = useState<MapScope>("usa"),
    [selectedRegion, setSelectedRegion] = useState<string>("Arkansas"),
    [artists, setArtists] = useState<BioArtistSearchResult[]>([]),
    [isLoading, setIsLoading] = useState(false),
    [loadError, setLoadError] = useState<string | null>(null),
    [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let isCancelled = false;
    const fetchArtists = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const slug = exploreRegionSlug(selectedRegion),
          apiRegion = selectedRegion
            ? mapScope === "usa"
              ? `us-${slug}`
              : slug
            : mapScope === "global"
              ? "all"
              : mapScope,
          regionType = regionTypeForMapScope(mapScope),
          list = await loadRegionArtists(apiRegion, regionType);
        if (!isCancelled) {
          setArtists(list);
          setLoadError(null);
        }
      } catch {
        if (!isCancelled) {
          setArtists([]);
          setLoadError("We could not load artists for this region.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchArtists();
    return () => {
      isCancelled = true;
    };
  }, [mapScope, retryCount, selectedRegion]);

  const handleRegionSelect = (regionName: string) => {
      setSelectedRegion(regionName);
    },
    handleScopeChange = (scope: MapScope) => {
      setMapScope(scope);
      if (scope === "usa") {
        setSelectedRegion("Arkansas");
      } else if (scope === "canada") {
        setSelectedRegion("Ontario");
      } else if (scope === "global") {
        setSelectedRegion("");
      } else {
        setSelectedRegion("");
      }
    },
    resetToGlobal = () => {
      setMapScope("global");
      setSelectedRegion("");
    };

  return (
    <div className="mx-auto min-w-0 w-full max-w-7xl overflow-x-clip px-4 py-6 sm:px-6 sm:py-10 space-y-10 sm:space-y-14">
      {/* Hero Section */}
      <div className="relative min-w-0 overflow-hidden rounded-3xl border border-border/40 bg-card/40 p-5 shadow-lg sm:p-10 md:p-12">
        <div className="relative z-10 mx-auto max-w-2xl space-y-4 text-center sm:mx-0 sm:space-y-5 sm:text-left">
          <h1 className="font-playfair text-3xl sm:text-5xl md:text-6xl font-medium tracking-tight text-foreground leading-[1.08]">
            One link for the <span className="italic text-primary">music</span>{" "}
            you make.
          </h1>

          <p className="max-w-xl text-sm sm:text-base text-muted-foreground leading-relaxed">
            The official link-in-bio for SoundKit creators. Share your releases,
            let fans stream audio directly, discover artists by city and state,
            and collect tips.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2 sm:justify-start">
            <Link
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-2.5 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:scale-105 hover:opacity-90 active:scale-95 sm:w-auto sm:text-sm"
              to="/signup/artist"
            >
              <span>Claim Your Artist Bio</span>
              <ArrowRight className="size-4" />
            </Link>

            <Link
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border/60 bg-white/5 px-5 py-2.5 text-xs font-semibold text-foreground/90 transition-all hover:bg-white/10 hover:text-foreground sm:w-auto sm:text-sm"
              to="/signup/fan"
            >
              <span>Join as Fan</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Map & Regional Discovery Section */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
              <CompassIcon className="size-4" />
              <span>Interactive Map Discovery</span>
            </div>
            <h2 className="mt-1 font-playfair text-2xl sm:text-4xl font-medium text-foreground">
              Discover Music by Location
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedRegion
                ? `Viewing music stats and artists focused on ${selectedRegion}. Click another region to explore.`
                : "Select a region on the map or switch scope to view artists."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {selectedRegion ? (
              <button
                className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/80 px-3.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-card hover:text-foreground transition-all shadow-sm"
                onClick={resetToGlobal}
                type="button"
              >
                <RotateCcw className="size-3.5" />
                <span>Reset to Global View</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* Map Component */}
        <BioMap
          mapScope={mapScope}
          onRegionSelect={handleRegionSelect}
          onScopeChange={handleScopeChange}
          selectedRegion={selectedRegion}
        />
      </section>

      {/* Artists in Region Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="size-5 text-primary" />
            <h3 className="font-playfair text-xl sm:text-2xl font-medium text-foreground">
              {selectedRegion
                ? `Top Artists in ${selectedRegion}`
                : "Top Artists"}
            </h3>
          </div>

          <p className="text-xs text-muted-foreground">
            {artists.length > 0 ? `${artists.length} artists found` : ""}
          </p>
        </div>

        {loadError ? (
          <div className="rounded-3xl border border-destructive/30 bg-destructive/10 p-12 text-center space-y-4">
            <p className="text-sm text-destructive">{loadError}</p>
            <button
              className="inline-flex items-center gap-2 rounded-full border border-destructive/40 px-5 py-2 text-xs font-bold text-destructive hover:bg-destructive/10 transition-colors"
              onClick={() => setRetryCount((count) => count + 1)}
              type="button"
            >
              Try again
            </button>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <LoaderCircle className="size-7 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">
              Finding artists in {selectedRegion || "this region"}...
            </p>
          </div>
        ) : artists.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {artists.map((artist, idx) => (
              <Link
                className="group relative flex items-center justify-between rounded-2xl border border-border/50 bg-card/40 p-4 backdrop-blur-xl hover:border-primary/40 hover:bg-card/70 transition-all shadow-md"
                key={artist.id}
                params={{ username: artist.username }}
                to="/$username"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* Rank Badge */}
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/5 font-mono text-xs font-bold text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    {idx + 1}
                  </span>

                  {/* Avatar */}
                  <div className="relative size-12 shrink-0 overflow-hidden rounded-full border border-border/50 bg-black/40">
                    {artist.avatarUrl ? (
                      <img
                        alt={artist.name}
                        className="size-full object-cover group-hover:scale-105 transition-transform duration-300"
                        src={artist.avatarUrl}
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center font-bold text-sm text-primary">
                        {artist.name[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Meta */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h4 className="truncate font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                        {artist.name}
                      </h4>
                      {artist.verified ? (
                        <UserCheck className="size-3.5 shrink-0 text-primary" />
                      ) : null}
                    </div>

                    <p className="truncate text-xs text-muted-foreground">
                      @{artist.username}
                      {artist.genre ? ` · ${artist.genre}` : ""}
                    </p>

                    <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground/80">
                      {artist.location ? (
                        <span className="truncate flex items-center gap-1">
                          <MapPin className="size-3 shrink-0" />
                          {artist.location}
                        </span>
                      ) : null}
                      <span>·</span>
                      <span>
                        {artist.followers.toLocaleString()}{" "}
                        {artist.followers === 1 ? "follower" : "followers"}
                      </span>
                    </div>
                  </div>
                </div>

                <ChevronRight className="size-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-border/60 bg-card/20 p-12 text-center space-y-4">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-white/5 text-muted-foreground">
              <Music className="size-6" />
            </div>
            <div className="space-y-1">
              <h4 className="font-semibold text-base text-foreground">
                No artists found in {selectedRegion || "this region"}
              </h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Be the first creator to represent{" "}
                {selectedRegion || "this area"} on SoundKit.
              </p>
            </div>
            <Link
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-xs font-bold text-primary-foreground shadow-md hover:opacity-90 transition-opacity"
              to="/signup/artist"
            >
              <span>Claim Your Artist Profile</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

function CompassIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      fill="none"
      height="24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="24"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}
