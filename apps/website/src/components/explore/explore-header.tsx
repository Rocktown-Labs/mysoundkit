/* eslint-disable one-var, sort-vars, no-nested-ternary, unicorn/no-nested-ternary */
import { useHotkey } from "@tanstack/react-hotkeys";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  FolderOpen,
  LayoutDashboard,
  Music,
  Search,
  ShoppingCart,
  UserRound,
  X,
} from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { CartDrawer } from "@/components/cart-drawer";
import { useCart } from "@/components/cart-provider";
import { AppImage } from "@/components/ui/app-image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useMeQuery, useSearchQuery } from "@/lib/soundkit-api-hooks";

const SEARCH_DEBOUNCE_MS = 250,
  resultLinkClassName =
    "flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  canOpenDashboardForUser = (user?: {
    accountType: string;
    onboardingCompletedAt?: string | null;
    role?: string | null;
  }) =>
    Boolean(user?.onboardingCompletedAt) &&
    (user?.accountType === "artist" || user?.role === "admin");

function SearchResultArtwork({
  alt,
  fallback,
  src,
}: {
  alt: string;
  fallback: ReactNode;
  src?: null | string;
}) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground">
      {src ? (
        <AppImage
          alt={alt}
          className="size-full object-cover"
          height={40}
          layout="fixed"
          loading="lazy"
          src={src}
          width={40}
        />
      ) : (
        fallback
      )}
    </span>
  );
}

// The search, cart, and account controls intentionally share one responsive header.
// eslint-disable-next-line complexity
export function ExploreHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname }),
    locationHref = useRouterState({ select: (s) => s.location.href }),
    { cart, setIsCartOpen } = useCart(),
    meQuery = useMeQuery(),
    me = meQuery.data,
    isSignedIn = Boolean(me),
    canOpenDashboard = canOpenDashboardForUser(me?.user),
    [searchValue, setSearchValue] = useState(""),
    [debouncedSearchValue, setDebouncedSearchValue] = useState(""),
    searchInputRef = useRef<HTMLInputElement>(null),
    trimmedSearchValue = debouncedSearchValue.trim();

  useHotkey("Mod+K", (event) => {
    event.preventDefault();
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  });

  const searchScope = pathname.startsWith("/projects")
      ? "projects"
      : pathname.startsWith("/tracks")
        ? "tracks"
        : pathname.startsWith("/artist")
          ? "artists"
          : "all",
    searchQuery = useSearchQuery({
      limit: "8",
      q: trimmedSearchValue,
      type: searchScope,
    }),
    results = searchQuery.data,
    resultCount =
      (results?.artists.length ?? 0) +
      (results?.tracks.length ?? 0) +
      (results?.projects.length ?? 0);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchValue(searchValue);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [searchValue]);

  const getScopedSearch = () => {
      if (searchScope === "projects") {
        return { q: trimmedSearchValue };
      }

      if (searchScope === "tracks") {
        return { genre: "all", q: trimmedSearchValue, view: "all" as const };
      }

      return { q: trimmedSearchValue };
    },
    getSearchPlaceholder = () => {
      if (pathname.startsWith("/artist")) {
        return "Search artists…";
      } else if (pathname.startsWith("/live")) {
        return "Search battles…";
      } else if (pathname.startsWith("/tracks")) {
        return "Search songs…";
      } else if (pathname.startsWith("/genres")) {
        return "Search genres…";
      }
      return "Search artists, tracks, battles…";
    };

  return (
    <header
      className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:h-16 md:gap-4"
      data-testid="explore-header"
    >
      <SidebarTrigger className="shrink-0" />

      <div className="flex-1 flex items-center justify-center max-w-3xl mx-auto">
        <div className="relative w-full max-w-md md:max-w-lg">
          <Suspense fallback={<div>Loading...</div>}>
            <Search
              aria-hidden="true"
              className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground md:left-3"
            />
            <Input
              aria-label="Search SoundKit"
              autoComplete="off"
              className="h-9 w-full pr-8 pl-8 text-sm md:h-10 md:pl-10"
              name="soundkit-search"
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder={getSearchPlaceholder()}
              ref={searchInputRef}
              type="search"
              value={searchValue}
            />
            {searchValue.length > 0 && (
              <button
                aria-label="Clear search"
                className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setSearchValue("")}
                type="button"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            )}
          </Suspense>

          {trimmedSearchValue.length > 1 && (
            <div className="absolute top-11 right-0 left-0 z-50 rounded-lg border bg-popover p-2 text-popover-foreground shadow-2xl">
              {searchQuery.isLoading && (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  Searching SoundKit…
                </p>
              )}
              {searchQuery.error && (
                <p className="px-3 py-2 text-xs text-destructive">
                  Search is currently unavailable.
                </p>
              )}
              {!searchQuery.isLoading &&
                !searchQuery.error &&
                resultCount === 0 && (
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    No results found for &ldquo;{trimmedSearchValue}&rdquo;.
                  </p>
                )}
              {!searchQuery.isLoading && !searchQuery.error && results && (
                <div className="flex max-h-96 flex-col gap-1 overflow-y-auto">
                  {results.artists.length > 0 && (
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Artists
                    </div>
                  )}
                  {results.artists.map((artist) => (
                    <Link
                      className={resultLinkClassName}
                      key={`artist-${artist.id}`}
                      onClick={() => setSearchValue("")}
                      params={{ username: artist.username }}
                      to="/artist/$username"
                    >
                      <Avatar className="size-10 shrink-0 rounded-md">
                        <AvatarImage
                          alt={`${artist.name} profile photo`}
                          src={artist.avatarUrl ?? undefined}
                        />
                        <AvatarFallback className="rounded-md text-xs">
                          {artist.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-xs">
                          {artist.name}
                        </span>
                        <span className="block truncate text-[10px] text-muted-foreground">
                          {artist.genre} • {artist.location}
                        </span>
                      </span>
                    </Link>
                  ))}

                  {results.tracks.length > 0 && (
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground pt-2">
                      Songs
                    </div>
                  )}
                  {results.tracks.map((track) => (
                    <Link
                      className={resultLinkClassName}
                      key={`track-${track.id}`}
                      onClick={() => setSearchValue("")}
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
                      <SearchResultArtwork
                        alt={`${track.title} cover artwork`}
                        fallback={
                          <Music
                            aria-hidden="true"
                            className="size-4 text-primary"
                          />
                        }
                        src={track.coverArtUrl}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-xs">
                          {track.title}
                        </span>
                        <span className="block truncate text-[10px] text-muted-foreground">
                          {track.artistName} • {track.genre}
                        </span>
                      </span>
                    </Link>
                  ))}

                  {results.projects.length > 0 && (
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground pt-2">
                      Projects
                    </div>
                  )}
                  {results.projects.map((project) => (
                    <Link
                      className={resultLinkClassName}
                      key={`project-${project.id}`}
                      onClick={() => setSearchValue("")}
                      params={{ id: project.slug || project.id }}
                      to="/projects/$id"
                    >
                      <SearchResultArtwork
                        alt={`${project.title} cover artwork`}
                        fallback={
                          <FolderOpen
                            aria-hidden="true"
                            className="size-4 text-primary"
                          />
                        }
                        src={project.coverArtUrl}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-xs">
                          {project.title}
                        </span>
                        <span className="block truncate text-[10px] text-muted-foreground">
                          {project.artistName} • {project.projectType}
                        </span>
                      </span>
                    </Link>
                  ))}
                  {searchScope === "all" ? null : (
                    <Link
                      className="mt-2 block rounded-md border px-3 py-2 text-center text-xs font-medium hover:bg-accent"
                      onClick={() => setSearchValue("")}
                      search={getScopedSearch()}
                      to={
                        searchScope === "projects"
                          ? "/projects"
                          : searchScope === "tracks"
                            ? "/tracks"
                            : "/artist"
                      }
                    >
                      View all {searchScope}
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-2 shrink-0 ml-auto">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative"
          onClick={() => setIsCartOpen(true)}
        >
          <ShoppingCart className="size-4" />
          <span className="sr-only">Open cart</span>
          {cart.itemCount > 0 && (
            <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-black text-primary-foreground">
              {cart.itemCount}
            </span>
          )}
        </Button>
        {isSignedIn ? (
          <>
            {canOpenDashboard ? (
              <Button asChild variant="outline" size="sm">
                <Link to="/dashboard">
                  <LayoutDashboard className="size-4" />
                  Dashboard
                </Link>
              </Button>
            ) : null}
            <Button asChild size="sm">
              <Link to="/library/settings">
                <UserRound className="size-4" />
                Account
              </Link>
            </Button>
          </>
        ) : (
          <>
            <Link search={{ redirect: locationHref }} to="/login">
              <Button variant="ghost" size="sm">
                Log In
              </Button>
            </Link>
            <Link search={{}} to="/signup">
              <Button size="sm">Sign Up</Button>
            </Link>
          </>
        )}
      </div>
      <CartDrawer />
    </header>
  );
}
