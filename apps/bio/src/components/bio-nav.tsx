/* eslint-disable one-var, sort-vars, complexity, no-nested-ternary, unicorn/no-nested-ternary, react/todo, react/set-state-in-effect */
"use client";

import { Link } from "@tanstack/react-router";
import {
  ExternalLink,
  LayoutDashboard,
  LoaderCircle,
  LogIn,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import {
  getCurrentSessionUser,
  searchBioArtists,
  setBioAuthToken,
  SOUNDKIT_WEB_URL,
} from "@/lib/api";
import type { BioArtistSearchResult, BioCurrentUser } from "@/lib/api";

const getSoundKitWebOrigin = () => {
  try {
    return new URL(SOUNDKIT_WEB_URL).origin;
  } catch {
    return "https://mysoundkit.com";
  }
};
const SOUNDKIT_WEB_ORIGIN = getSoundKitWebOrigin();
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object");

export function BioNav() {
  const [query, setQuery] = useState(""),
    [results, setResults] = useState<BioArtistSearchResult[]>([]),
    [isLoading, setIsLoading] = useState(false),
    [isOpen, setIsOpen] = useState(false),
    [currentUser, setCurrentUser] = useState<BioCurrentUser | null>(null),
    containerRef = useRef<HTMLDivElement | null>(null),
    handoffWindowRef = useRef<Window | null>(null);

  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      try {
        const user = await getCurrentSessionUser();
        if (!cancelled) {
          setCurrentUser(user);
        }
      } catch {
        if (!cancelled) {
          setCurrentUser(null);
        }
      }
    };

    void checkSession();

    const handleMessage = async (event: MessageEvent<unknown>) => {
      if (
        event.origin !== SOUNDKIT_WEB_ORIGIN ||
        event.source !== handoffWindowRef.current ||
        !isRecord(event.data) ||
        event.data.type !== "soundkit-auth-handoff" ||
        typeof event.data.token !== "string"
      ) {
        return;
      }
      setBioAuthToken(event.data.token);
      const user = await getCurrentSessionUser();
      if (!cancelled) {
        setCurrentUser(user);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      cancelled = true;
      window.removeEventListener("message", handleMessage);
    };
  }, []);

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

  const handleSignIn = () => {
    if (typeof window === "undefined") {
      return;
    }
    const returnOrigin = window.location.origin,
      handoffUrl = `${SOUNDKIT_WEB_URL}/auth/handoff?returnOrigin=${encodeURIComponent(returnOrigin)}`,
      popup = window.open(
        handoffUrl,
        "soundkit-auth-handoff",
        "popup,width=480,height=760,resizable,scrollbars"
      );
    if (!popup) {
      window.location.href = `${SOUNDKIT_WEB_URL}/login?redirect=${encodeURIComponent(window.location.href)}`;
      return;
    }
    handoffWindowRef.current = popup;
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        {/* Logo without disc icon */}
        <Link
          className="flex items-center gap-2 font-bold tracking-wider text-sm hover:opacity-85 transition-opacity shrink-0"
          to="/"
        >
          <span className="font-notable tracking-[0.2em] text-xs sm:text-sm">
            SOUNDKIT<span className="text-primary">.BIO</span>
          </span>
        </Link>

        {/* Center Search Bar */}
        <div className="relative flex-1 max-w-md mx-auto" ref={containerRef}>
          <div className="relative flex items-center">
            <Search className="absolute left-3 size-4 text-muted-foreground pointer-events-none" />
            <input
              aria-label="Search artists"
              className="h-9 w-full rounded-full border border-border/50 bg-card/60 pl-9 pr-8 text-xs sm:text-sm placeholder:text-muted-foreground/70 focus:border-primary focus:bg-card focus:outline-none focus:ring-1 focus:ring-primary transition-all"
              onChange={(e) => {
                setQuery(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              placeholder="Search artists..."
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
            <div className="absolute top-full left-0 right-0 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-border/50 bg-card/95 p-2 shadow-2xl backdrop-blur-2xl z-50">
              {isLoading ? (
                <div className="flex items-center justify-center py-6 text-xs text-muted-foreground gap-2">
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
                      className="flex items-center gap-3 rounded-xl p-2 hover:bg-white/5 transition-colors"
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

        {/* Right CTAs */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {currentUser ? (
            <Link
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-all"
              to="/dashboard"
            >
              <LayoutDashboard className="size-3.5" />
              <span>Dashboard</span>
            </Link>
          ) : (
            <>
              <button
                className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-white/5 px-3 py-1.5 text-xs font-semibold text-foreground/85 hover:border-primary/40 hover:text-foreground transition-all"
                onClick={handleSignIn}
                type="button"
              >
                <LogIn className="size-3.5 text-primary" />
                <span>Sign In</span>
              </button>

              <Link
                className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-foreground/85 hover:border-primary/40 hover:text-foreground transition-all"
                to="/signup/artist"
              >
                <Sparkles className="size-3.5 text-primary" />
                <span>Claim Account</span>
              </Link>
            </>
          )}

          <a
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity"
            href={SOUNDKIT_WEB_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            <span>SoundKit</span>
            <ExternalLink className="size-3" />
          </a>
        </div>
      </div>
    </header>
  );
}
