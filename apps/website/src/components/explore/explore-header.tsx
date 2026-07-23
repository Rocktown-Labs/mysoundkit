import { Link, useRouterState } from "@tanstack/react-router";
import {
  FolderOpen,
  LayoutDashboard,
  Music,
  Search,
  ShoppingCart,
  User,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Suspense } from "react";

import { CartDrawer } from "@/components/cart-drawer";
import { useCart } from "@/components/cart-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useMeQuery, useSearchQuery } from "@/lib/soundkit-api-hooks";

const SEARCH_DEBOUNCE_MS = 250;

const resultLinkClassName =
  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent cursor-pointer";

export function ExploreHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { cart, setIsCartOpen } = useCart();
  const meQuery = useMeQuery();
  const me = meQuery.data;
  const isSignedIn = Boolean(me);
  const canOpenDashboard =
    me?.user.accountType === "artist" || me?.user.role === "admin";

  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearchValue, setDebouncedSearchValue] = useState("");
  const trimmedSearchValue = debouncedSearchValue.trim();

  const searchQuery = useSearchQuery({
    limit: "8",
    q: trimmedSearchValue,
    type: "all",
  });
  const results = searchQuery.data;
  const resultCount =
    (results?.artists.length ?? 0) +
    (results?.tracks.length ?? 0) +
    (results?.projects.length ?? 0);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchValue(searchValue);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [searchValue]);

  const getSearchPlaceholder = () => {
    if (pathname.startsWith("/artist")) {
      return "Search artists...";
    } else if (pathname.startsWith("/live")) {
      return "Search battles...";
    } else if (pathname.startsWith("/tracks")) {
      return "Search songs...";
    } else if (pathname.startsWith("/genres")) {
      return "Search genres...";
    }
    return "Search artists, tracks, battles...";
  };

  return (
    <header className="sticky top-0 z-10 flex h-14 md:h-16 items-center gap-2 md:gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
      <SidebarTrigger className="shrink-0" />

      <div className="flex-1 flex items-center justify-center max-w-3xl mx-auto">
        <div className="relative w-full max-w-md md:max-w-lg">
          <Suspense fallback={<div>Loading...</div>}>
            <Search className="absolute left-2 md:left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder={getSearchPlaceholder()}
              className="pl-8 md:pl-10 pr-8 w-full h-9 md:h-10 text-sm"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
            />
            {searchValue.length > 0 && (
              <button
                type="button"
                onClick={() => setSearchValue("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </Suspense>

          {trimmedSearchValue.length > 1 && (
            <div className="absolute top-11 right-0 left-0 z-50 rounded-lg border bg-popover p-2 text-popover-foreground shadow-2xl">
              {searchQuery.isLoading && (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  Searching SoundKit...
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
                <div className="max-h-96 overflow-y-auto space-y-1">
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
                      <User className="size-4 text-primary shrink-0" />
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
                      params={{ id: track.id }}
                      to="/tracks/$id"
                    >
                      <Music className="size-4 text-primary shrink-0" />
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
                      params={{ id: project.id }}
                      to="/projects/$id"
                    >
                      <FolderOpen className="size-4 text-primary shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-xs">
                          {project.title}
                        </span>
                        <span className="block truncate text-[10px] text-muted-foreground">
                          {project.artistName} • {project.type}
                        </span>
                      </span>
                    </Link>
                  ))}
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
            <Link to="/login">
              <Button variant="ghost" size="sm">
                Log In
              </Button>
            </Link>
            <Link to="/signup">
              <Button size="sm">Sign Up</Button>
            </Link>
          </>
        )}
      </div>
      <CartDrawer />
    </header>
  );
}
