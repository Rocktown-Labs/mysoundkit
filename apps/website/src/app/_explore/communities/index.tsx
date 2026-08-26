/* eslint-disable one-var, sort-vars, no-void */
import { createFileRoute } from "@tanstack/react-router";
import { MessageCircleHeart } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { CommunityCard } from "@/components/community/community-card";
import { CommunityFilters } from "@/components/community/community-filters";
import type { CommunityFilterValue } from "@/components/community/community-filters";
import { Button } from "@/components/ui/button";
import type { DbCommunity } from "@/lib/data-db";
import { useDbCommunities } from "@/lib/data-db";
import { musicGenres } from "@/lib/music-genres";

interface CommunitySearch extends CommunityFilterValue {
  view: "all" | "sections";
}

export const Route = createFileRoute("/_explore/communities/")({
  component: CommunitiesPage,
  ssr: false,
  validateSearch: (search: Record<string, unknown>): CommunitySearch => ({
    access:
      search.access === "free" || search.access === "paid"
        ? search.access
        : "all",
    genre: typeof search.genre === "string" ? search.genre : "all",
    q: typeof search.q === "string" ? search.q : "",
    sort:
      search.sort === "members-desc" ||
      search.sort === "name-asc" ||
      search.sort === "newest-desc"
        ? search.sort
        : "activity-desc",
    view: search.view === "all" ? "all" : "sections",
  }),
});

const sortCommunities = (
  communities: DbCommunity[],
  sort: CommunityFilterValue["sort"]
) =>
  communities.toSorted((left, right) => {
    if (sort === "members-desc") {
      return right.memberCount - left.memberCount;
    }
    if (sort === "name-asc") {
      return left.name.localeCompare(right.name);
    }
    if (sort === "newest-desc") {
      return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
    }
    return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
  });

function CommunitiesPage() {
  const search = Route.useSearch(),
    navigate = Route.useNavigate(),
    { data: communities, isLoading } = useDbCommunities(),
    [searchInput, setSearchInput] = useState(search.q),
    [debouncedSearch, setDebouncedSearch] = useState(search.q),
    filters: CommunityFilterValue = {
      access: search.access,
      genre: search.genre,
      q: searchInput,
      sort: search.sort,
    };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    if (debouncedSearch === search.q) {
      return;
    }
    void navigate({
      replace: true,
      search: (previous) => ({ ...previous, q: debouncedSearch }),
    });
  }, [debouncedSearch, navigate, search.q]);

  const filteredCommunities = useMemo(() => {
      const query = debouncedSearch.toLocaleLowerCase(),
        filtered = communities.filter((community) => {
          const matchesQuery =
            query.length === 0 ||
            community.name.toLocaleLowerCase().includes(query) ||
            community.artist.name.toLocaleLowerCase().includes(query) ||
            community.description?.toLocaleLowerCase().includes(query);
          const matchesGenre =
            search.genre === "all" || community.genre?.slug === search.genre;
          const matchesAccess =
            search.access === "all" ||
            (search.access === "free"
              ? community.monthlyPriceCents === 0
              : community.monthlyPriceCents > 0);
          return Boolean(matchesQuery && matchesGenre && matchesAccess);
        });
      return sortCommunities(filtered, search.sort);
    }, [
      communities,
      debouncedSearch,
      search.access,
      search.genre,
      search.sort,
    ]),
    updateFilters = (next: CommunityFilterValue) => {
      setSearchInput(next.q);
      void navigate({
        replace: true,
        search: {
          ...next,
          q: debouncedSearch,
          view: search.view,
        },
      });
    },
    openGenre = (genre: string) => {
      void navigate({
        search: (previous) => ({ ...previous, genre, view: "all" }),
      });
    },
    visibleGenres =
      search.genre === "all"
        ? musicGenres
        : musicGenres.filter((genre) => genre.value === search.genre);

  return (
    <main className="space-y-8 px-4 py-6 md:px-6 lg:px-8 lg:py-8">
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <MessageCircleHeart className="size-6" />
          </div>
          <div>
            <h1 className="font-bold text-3xl md:text-4xl">
              Artist Communities
            </h1>
            <p className="text-muted-foreground">
              Find artist-led spaces for updates, conversation, and shared
              listening moments.
            </p>
          </div>
        </div>
      </section>

      <CommunityFilters onChange={updateFilters} value={filters} />

      {search.view === "all" ? (
        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-semibold text-xl">
              {search.genre === "all"
                ? "All Communities"
                : `${musicGenres.find((genre) => genre.value === search.genre)?.label ?? "Genre"} Communities`}
            </h2>
            <Button
              onClick={() =>
                void navigate({
                  search: (previous) => ({ ...previous, view: "sections" }),
                })
              }
              size="sm"
              variant="ghost"
            >
              Show rails
            </Button>
          </div>
          {filteredCommunities.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredCommunities.map((community) => (
                <CommunityCard community={community} key={community.id} />
              ))}
            </div>
          ) : (
            <CommunityEmpty isLoading={isLoading} />
          )}
        </section>
      ) : (
        <div className="space-y-10">
          <CommunityRail
            communities={filteredCommunities.slice(0, 12)}
            isLoading={isLoading}
            onViewAll={() => openGenre("all")}
            title="Active Communities"
          />
          {visibleGenres.map((genre) => {
            const items = filteredCommunities.filter(
              (community) => community.genre?.slug === genre.value
            );
            if (items.length === 0 && !isLoading) {
              return null;
            }
            return (
              <CommunityRail
                communities={items}
                isLoading={isLoading}
                key={genre.value}
                onViewAll={() => openGenre(genre.value)}
                title={genre.label}
              />
            );
          })}
        </div>
      )}
    </main>
  );
}

function CommunityRail({
  communities,
  isLoading,
  onViewAll,
  title,
}: {
  communities: DbCommunity[];
  isLoading: boolean;
  onViewAll: () => void;
  title: string;
}) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-semibold text-xl">{title}</h2>
        <Button onClick={onViewAll} size="sm" variant="ghost">
          View All
        </Button>
      </div>
      {communities.length > 0 ? (
        <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-3 md:mx-0 md:px-0">
          {communities.map((community) => (
            <CommunityCard community={community} key={community.id} />
          ))}
        </div>
      ) : (
        <CommunityEmpty isLoading={isLoading} />
      )}
    </section>
  );
}

function CommunityEmpty({ isLoading }: { isLoading: boolean }) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
      {isLoading
        ? "Loading communities…"
        : "No communities match these filters yet."}
    </div>
  );
}
