import { useHotkey } from "@tanstack/react-hotkeys";
import { Link } from "@tanstack/react-router";
import { Bell, FolderOpen, Music, Search, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  useMarkNotificationReadMutation,
  useMarkNotificationsReadMutation,
  useNotificationsQuery,
  useSearchQuery,
} from "@/lib/soundkit-api-hooks";

const SEARCH_DEBOUNCE_MS = 250,
  resultLinkClassName =
    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent";

export function DashboardHeader() {
  const [searchValue, setSearchValue] = useState(""),
    [debouncedSearchValue, setDebouncedSearchValue] = useState(""),
    searchInputRef = useRef<HTMLInputElement>(null),
    trimmedSearchValue = debouncedSearchValue.trim();

  useHotkey("Mod+K", (event) => {
    event.preventDefault();
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  });

  const notificationsQuery = useNotificationsQuery(),
    markNotificationReadMutation = useMarkNotificationReadMutation(),
    markReadMutation = useMarkNotificationsReadMutation(),
    notificationPages = notificationsQuery.data?.pages ?? [],
    notifications = notificationPages.flatMap((page) => page.items),
    unreadCount = notificationPages[0]?.unreadCount ?? 0,
    searchQuery = useSearchQuery({
      limit: "8",
      q: trimmedSearchValue,
      type: "all",
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

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 md:px-6">
      <SidebarTrigger className="md:hidden" />

      <div className="flex flex-1 items-center gap-4">
        <div className="hidden md:block">
          <SidebarTrigger />
        </div>

        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            type="search"
            placeholder="Search tracks, projects, artists..."
            className="pl-9 w-full"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
          />
          {trimmedSearchValue.length > 1 && (
            <div className="absolute top-11 right-0 left-0 z-50 rounded-md border bg-popover p-2 text-popover-foreground shadow-lg">
              {searchQuery.isLoading && (
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  Searching SoundKit...
                </p>
              )}
              {searchQuery.error && (
                <p className="px-3 py-2 text-sm text-destructive">
                  Search is unavailable right now.
                </p>
              )}
              {!searchQuery.isLoading &&
                !searchQuery.error &&
                resultCount === 0 && (
                  <p className="px-3 py-2 text-sm text-muted-foreground">
                    No real results found.
                  </p>
                )}
              {!searchQuery.isLoading && !searchQuery.error && results && (
                <div className="max-h-96 overflow-y-auto">
                  {results.artists.map((artist) => (
                    <Link
                      className={resultLinkClassName}
                      key={`artist-${artist.id}`}
                      onClick={() => setSearchValue("")}
                      params={{ username: artist.username }}
                      to="/artist/$username"
                    >
                      <User className="size-4 text-primary" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {artist.name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {artist.genre} • {artist.location}
                        </span>
                      </span>
                    </Link>
                  ))}
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
                      <Music className="size-4 text-primary" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {track.title}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {track.artistName} • {track.genre}
                        </span>
                      </span>
                    </Link>
                  ))}
                  {results.projects.map((project) => (
                    <Link
                      className={resultLinkClassName}
                      key={`project-${project.id}`}
                      onClick={() => setSearchValue("")}
                      params={{ id: project.id }}
                      to="/projects/$id"
                    >
                      <FolderOpen className="size-4 text-primary" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {project.title}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {project.artistName} • {project.projectType}
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

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="relative" size="icon" variant="ghost">
              <Bell className="size-5" />
              {unreadCount > 0 ? (
                <Badge className="absolute -top-1 -right-1 flex size-5 items-center justify-center bg-primary p-0 text-primary-foreground text-xs">
                  {unreadCount}
                </Badge>
              ) : null}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-2">
            <div className="mb-1 flex items-center justify-between border-border/40 border-b px-2 py-1.5">
              <p className="font-semibold text-sm">Notifications</p>
              {unreadCount > 0 ? (
                <button
                  className="font-medium text-[10px] text-primary hover:underline"
                  onClick={() => markReadMutation.mutate()}
                  type="button"
                >
                  Mark all read
                </button>
              ) : null}
            </div>

            {notifications.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-xs">
                No notifications yet.
              </div>
            ) : (
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {notifications.map((item) => {
                  const link = item.link ?? undefined,
                    content = (
                      <>
                        <div className="flex w-full items-center justify-between">
                          <p className="font-semibold text-xs">{item.title}</p>
                          {item.read ? null : (
                            <span className="size-1.5 rounded-full bg-primary" />
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-tight">
                          {item.message}
                        </p>
                      </>
                    );

                  return (
                    <DropdownMenuItem
                      asChild={Boolean(link)}
                      className="flex cursor-pointer flex-col items-start gap-1 rounded-lg p-2 focus:bg-accent"
                      key={item.id}
                    >
                      {link ? (
                        <Link
                          onClick={() =>
                            markNotificationReadMutation.mutate(item.id)
                          }
                          to={link}
                        >
                          {content}
                        </Link>
                      ) : (
                        <button
                          className="w-full text-left"
                          onClick={() =>
                            markNotificationReadMutation.mutate(item.id)
                          }
                          type="button"
                        >
                          {content}
                        </button>
                      )}
                    </DropdownMenuItem>
                  );
                })}
                {notificationsQuery.hasNextPage ? (
                  <Button
                    className="w-full"
                    disabled={notificationsQuery.isFetchingNextPage}
                    onClick={() => notificationsQuery.fetchNextPage()}
                    size="sm"
                    variant="ghost"
                  >
                    {notificationsQuery.isFetchingNextPage
                      ? "Loading…"
                      : "Load more"}
                  </Button>
                ) : null}
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
