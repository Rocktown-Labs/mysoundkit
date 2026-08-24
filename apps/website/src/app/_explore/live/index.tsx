/* eslint-disable one-var, sort-vars, require-unicode-regexp, no-nested-ternary, unicorn/no-nested-ternary */
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, Zap } from "lucide-react";

import {
  ExploreCollectionGrid,
  ExploreCollectionSection,
} from "@/components/explore/explore-collection";
import { LiveCollectionFilters } from "@/components/explore/live-collection-filters";
import {
  filterAndSortLiveItems,
  normalizeGenreValue,
} from "@/lib/live-collection";
import { musicGenres } from "@/lib/music-genres";
import {
  useBattlesQuery,
  useListeningPartiesQuery,
  usePublicLiveExperiencesQuery,
} from "@/lib/soundkit-api-hooks";

interface LiveHubSearch {
  genre?: string;
  sort?: string;
  status?: string;
  view?: "all" | "sections";
}

interface LiveHubItem {
  genre: string | null;
  href: "/live/battles/$id" | "/live/parties/$id" | "/live/streams/$id";
  id: string;
  kind: "battle" | "party" | "stream";
  startsAt: string | null;
  status: string;
  title: string;
  viewerCount: number;
}

export const Route = createFileRoute("/_explore/live/")({
  component: LiveHubPage,
  validateSearch: (search: Record<string, unknown>): LiveHubSearch => ({
    genre: typeof search.genre === "string" ? search.genre : "all",
    sort: typeof search.sort === "string" ? search.sort : "starts-asc",
    status: typeof search.status === "string" ? search.status : "all",
    view: search.view === "all" ? "all" : "sections",
  }),
});

const kindLabel = (kind: LiveHubItem["kind"]) => {
  if (kind === "battle") {
    return "Battle";
  }
  if (kind === "party") {
    return "Listening Party";
  }
  return "Creator Stream";
};

function formatLiveHubViewers(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  }
  return count.toLocaleString();
}

function LiveHubCard({ item }: { item: LiveHubItem }) {
  const isLive = item.status === "live",
    posterImage =
      item.kind === "battle"
        ? "/music-battle-video-thumbnail.jpg"
        : item.kind === "party"
          ? "/summer-music-album-cover.webp"
          : "/night-music-album-cover.webp",
    categoryLabel = kindLabel(item.kind),
    tags = [
      item.genre,
      categoryLabel.toLowerCase(),
      isLive ? "live" : "upcoming",
    ].filter(Boolean) as string[];

  return (
    <Link
      className="group block w-full text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
      params={{ id: item.id }}
      to={item.href}
    >
      <div className="flex flex-col gap-2.5">
        <div className="relative aspect-video w-full overflow-hidden rounded-md bg-muted transition-transform duration-300 group-hover:scale-[1.02]">
          <img
            alt={item.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            height={720}
            src={posterImage}
            width={1280}
          />

          {/* Top-Left Live / Upcoming Badge */}
          <div className="absolute left-2 top-2">
            {isLive ? (
              <div className="rounded-[4px] bg-red-600 px-1.5 py-0.5 font-bold text-[11px] uppercase tracking-wider text-white shadow-sm">
                LIVE
              </div>
            ) : (
              <div className="flex items-center gap-1 rounded-[4px] bg-black/75 px-1.5 py-0.5 text-[11px] font-medium text-white backdrop-blur">
                <CalendarClock className="size-3 text-primary" />
                Upcoming
              </div>
            )}
          </div>

          {/* Bottom-Left Viewer Count or Schedule Date */}
          <div className="absolute bottom-2 left-2">
            {isLive ? (
              <div className="rounded-[4px] bg-black/70 px-1.5 py-0.5 text-xs font-semibold text-white backdrop-blur">
                {formatLiveHubViewers(item.viewerCount)} viewers
              </div>
            ) : item.startsAt ? (
              <div className="flex items-center gap-1 rounded-[4px] bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white backdrop-blur">
                <CalendarClock className="size-3 text-primary" />
                {new Date(item.startsAt).toLocaleDateString()}
              </div>
            ) : null}
          </div>
        </div>

        {/* Card info */}
        <div className="space-y-0.5 px-0.5">
          <h3 className="line-clamp-1 font-bold text-sm leading-tight text-foreground transition-colors group-hover:text-primary">
            {item.title}
          </h3>
          <p className="truncate text-xs text-muted-foreground">
            {item.genre ?? categoryLabel}
          </p>
          <div className="flex flex-wrap items-center gap-1 pt-1">
            {tags.map((tag) => (
              <span
                className="rounded-full bg-secondary/80 px-2 py-0.5 text-[10px] font-medium text-secondary-foreground transition-colors hover:bg-secondary"
                key={tag}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}

function LiveHubPage() {
  const navigate = Route.useNavigate(),
    search = Route.useSearch(),
    battlesQuery = useBattlesQuery(),
    partiesQuery = useListeningPartiesQuery(),
    streamsQuery = usePublicLiveExperiencesQuery("stream"),
    genre = search.genre ?? "all",
    sort = search.sort ?? "starts-asc",
    status = search.status ?? "all",
    view = search.view ?? "sections",
    battleItems: LiveHubItem[] = (battlesQuery.data ?? [])
      .filter(
        (battle) => battle.status === "live" || battle.status === "scheduled"
      )
      .map((battle) => ({
        genre: battle.genre,
        href: "/live/battles/$id",
        id: battle.id,
        kind: "battle",
        startsAt: battle.startsAt ?? null,
        status: battle.status,
        title: battle.title,
        viewerCount: battle.viewerCount,
      })),
    partyItems: LiveHubItem[] = (partiesQuery.data ?? []).map((party) => ({
      genre: party.genre ?? null,
      href: "/live/parties/$id",
      id: party.liveRoomId ?? party.id,
      kind: "party",
      startsAt: party.scheduledStartAt,
      status: party.status,
      title: party.title,
      viewerCount: 0,
    })),
    streamItems: LiveHubItem[] = (streamsQuery.data ?? [])
      .filter((stream) => stream.kind === "stream")
      .map((stream) => ({
        genre: stream.genre ?? null,
        href: "/live/streams/$id",
        id: stream.id,
        kind: "stream",
        startsAt: stream.startsAt,
        status: stream.status,
        title: stream.title,
        viewerCount: stream.viewerCount,
      })),
    allItems = [...battleItems, ...partyItems, ...streamItems],
    filteredItems = filterAndSortLiveItems({
      genre,
      items: allItems,
      sort,
      status,
    }),
    isLoading =
      battlesQuery.isLoading ||
      partiesQuery.isLoading ||
      streamsQuery.isLoading,
    openCollection = (next: Partial<LiveHubSearch>) => {
      void navigate({
        search: (previous) => ({ ...previous, ...next, view: "all" }),
      });
    };

  return (
    <div className="space-y-8 pb-8">
      <section>
        <h1 className="flex items-center gap-2 font-bold text-3xl">
          <Zap className="size-7 text-primary" />
          Live on SoundKit
        </h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Real battles, listening parties, and creator streams from the SoundKit
          community.
        </p>
      </section>

      <div className="hidden lg:block">
        <LiveCollectionFilters
          onChange={(next) => {
            void navigate({ search: { ...next, view: "all" } });
          }}
          value={{ genre, sort }}
        />
      </div>

      {view === "all" ? (
        <ExploreCollectionGrid
          empty="No live experiences match these filters."
          isLoading={isLoading}
          items={filteredItems}
          layout="landscape"
          title="Live Experiences"
        >
          {(item) => <LiveHubCard item={item} />}
        </ExploreCollectionGrid>
      ) : (
        <>
          <ExploreCollectionSection
            empty="No featured live experiences yet."
            isLoading={isLoading}
            items={allItems.slice(0, 8)}
            layout="landscape"
            onViewAll={() => openCollection({})}
            title="Featured"
          >
            {(item) => <LiveHubCard item={item} />}
          </ExploreCollectionSection>
          <ExploreCollectionSection
            empty="Nothing is live right now."
            items={allItems.filter((item) => item.status === "live")}
            layout="landscape"
            onViewAll={() => openCollection({ status: "live" })}
            title="Live Now"
          >
            {(item) => <LiveHubCard item={item} />}
          </ExploreCollectionSection>
          <ExploreCollectionSection
            empty="No upcoming live experiences are scheduled."
            items={allItems.filter((item) => item.status === "scheduled")}
            layout="landscape"
            onViewAll={() => openCollection({ status: "scheduled" })}
            title="Upcoming"
          >
            {(item) => <LiveHubCard item={item} />}
          </ExploreCollectionSection>
          {musicGenres.map((sectionGenre) => {
            const sectionSlug = normalizeGenreValue(sectionGenre.value),
              sectionLabel = normalizeGenreValue(sectionGenre.label);
            return (
              <ExploreCollectionSection
                empty={`No ${sectionGenre.label} live experiences yet.`}
                items={allItems.filter((item) => {
                  const itemGenre = normalizeGenreValue(item.genre);
                  return (
                    item.genre === sectionGenre.value ||
                    itemGenre === sectionSlug ||
                    itemGenre === sectionLabel ||
                    itemGenre.startsWith(sectionSlug) ||
                    sectionSlug.startsWith(itemGenre)
                  );
                })}
                key={sectionGenre.value}
                layout="landscape"
                onViewAll={() => openCollection({ genre: sectionGenre.value })}
                title={sectionGenre.label}
              >
                {(item) => <LiveHubCard item={item} />}
              </ExploreCollectionSection>
            );
          })}
        </>
      )}
    </div>
  );
}
