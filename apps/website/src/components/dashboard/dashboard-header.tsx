import { Link } from "@tanstack/react-router";
import { Bell, FolderOpen, Music, Search, User } from "lucide-react";
import { useEffect, useState } from "react";

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
import { useSearchQuery } from "@/lib/soundkit-api-hooks";

const SEARCH_DEBOUNCE_MS = 250;

const resultLinkClassName =
  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent";

export function DashboardHeader() {
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
                      params={{ id: track.id }}
                      to="/tracks/$id"
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
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="size-5" />
              <Badge className="absolute -top-1 -right-1 size-5 flex items-center justify-center p-0 text-xs">
                3
              </Badge>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="p-2">
              <p className="font-semibold mb-2">Notifications</p>
              <DropdownMenuItem>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">
                    New collaboration request
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Sarah wants to collaborate on &ldquo;Summer Vibes&rdquo;
                  </p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">Track uploaded</p>
                  <p className="text-xs text-muted-foreground">
                    Mike added vocals to &ldquo;Night Drive&rdquo;
                  </p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">Release reminder</p>
                  <p className="text-xs text-muted-foreground">
                    &ldquo;Midnight Dreams&rdquo; releases in 3 days
                  </p>
                </div>
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
