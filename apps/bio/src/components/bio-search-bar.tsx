/* eslint-disable one-var, sort-vars, complexity, no-nested-ternary, unicorn/no-nested-ternary, react/todo, react/set-state-in-effect */
"use client";

import { Link } from "@tanstack/react-router";
import { LoaderCircle, Search, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import { searchBioArtists } from "@/lib/api";
import type { BioArtistSearchResult } from "@/lib/api";

export function BioSearchBar({
  className = "",
  inputClassName = "",
  placeholder = "Search artists...",
}: {
  className?: string;
  inputClassName?: string;
  placeholder?: string;
}) {
  const [query, setQuery] = useState(""),
    [results, setResults] = useState<BioArtistSearchResult[]>([]),
    [isLoading, setIsLoading] = useState(false),
    [isOpen, setIsOpen] = useState(false),
    containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const artists = await searchBioArtists(trimmed);
        setResults(artists);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [query]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={`relative min-w-0 ${className}`} ref={containerRef}>
      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
        <input
          aria-label="Search artists"
          className={`h-10 w-full rounded-full border border-border/50 bg-card/60 pl-10 pr-9 text-sm placeholder:text-muted-foreground/70 transition-all focus:border-primary focus:bg-card focus:outline-none focus:ring-1 focus:ring-primary ${inputClassName}`}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          type="search"
          value={query}
        />
        {query ? (
          <button
            aria-label="Clear search"
            className="absolute right-2.5 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
            onClick={() => {
              setQuery("");
              setResults([]);
            }}
            type="button"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && (query.trim() || isLoading) ? (
        <div className="absolute top-full left-0 right-0 z-50 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-border/50 bg-card/95 p-2 shadow-2xl backdrop-blur-2xl">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin text-primary" />
              Searching artists...
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-1">
              <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Artists ({results.length})
              </p>
              {results.map((artist) => (
                <Link
                  className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-white/5"
                  key={artist.id}
                  onClick={() => setIsOpen(false)}
                  params={{ username: artist.username }}
                  to="/$username"
                >
                  <div className="relative size-10 shrink-0 overflow-hidden rounded-full border border-border/40 bg-muted/40">
                    {artist.avatarUrl ? (
                      <img
                        alt={artist.name}
                        className="size-full object-cover"
                        src={artist.avatarUrl}
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center font-bold text-xs">
                        {artist.name[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate font-semibold text-sm leading-tight text-foreground">
                        {artist.name}
                      </p>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      @{artist.username}{" "}
                      {artist.genre ? `· ${artist.genre}` : ""}
                    </p>
                  </div>
                  {artist.genre ? (
                    <span className="shrink-0 rounded-full border border-border/40 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                      {artist.genre}
                    </span>
                  ) : null}
                </Link>
              ))}
            </div>
          ) : query.trim() ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              No artist profiles found for &quot;{query}&quot;.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
