/* eslint-disable one-var, sort-vars */
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, Headphones } from "lucide-react";

import { CreateFanPartyDialog } from "@/components/explore/create-fan-party-dialog";
import {
  ExploreCollectionGrid,
  ExploreCollectionSection,
} from "@/components/explore/explore-collection";
import { LiveCollectionFilters } from "@/components/explore/live-collection-filters";
import {
  PublicCard,
  PublicCardMeta,
  PublicCardThumbnail,
} from "@/components/explore/public-card";
import { RegionSelectors } from "@/components/explore/region-selectors";
import { AppImage } from "@/components/ui/app-image";
import { Badge } from "@/components/ui/badge";
import {
  filterAndSortLiveItems,
  normalizeGenreValue,
} from "@/lib/live-collection";
import {
  useGenresQuery,
  useListeningPartiesQuery,
} from "@/lib/soundkit-api-hooks";
import type { ListeningPartySummary } from "@/lib/soundkit-api-hooks";

interface LivePartiesSearch {
  genre?: string;
  region?: string;
  regionType?: "global" | "north-america";
  sort?: string;
  status?: string;
  view?: "all" | "sections";
}

type PartyCollectionItem = ListeningPartySummary & {
  startsAt: string;
  viewerCount: number;
};

export const Route = createFileRoute("/_explore/live/parties/")({
  component: LivePartiesPage,
  validateSearch: (search: Record<string, unknown>): LivePartiesSearch => ({
    genre: typeof search.genre === "string" ? search.genre : "all",
    region: typeof search.region === "string" ? search.region : "all",
    regionType:
      search.regionType === "north-america" ? "north-america" : "global",
    sort: typeof search.sort === "string" ? search.sort : "starts-asc",
    status: typeof search.status === "string" ? search.status : "all",
    view: search.view === "all" ? "all" : "sections",
  }),
});

const formatPartyDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value));

function PartySummaryCard({ party }: { party: PartyCollectionItem }) {
  const isLive = party.status === "live",
    coverArt =
      party.playbackMode === "artist_hosted"
        ? "/summer-music-album-cover.webp"
        : "/night-music-album-cover.webp",
    categoryLabel =
      party.playbackMode === "artist_hosted"
        ? "Artist Hosted"
        : "Release Party";

  return (
    <Link
      className="block w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      params={{ id: party.liveRoomId ?? party.id }}
      to="/live/parties/$id"
    >
      <PublicCard>
        <PublicCardThumbnail className="transition-transform duration-300 group-hover:scale-[1.02]">
          <AppImage
            alt={`${party.title} thumbnail`}
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
            height={720}
            layout="constrained"
            loading="lazy"
            src={coverArt}
            width={1280}
          />
          <Badge
            className="absolute top-2 left-2 gap-1 font-bold text-[10px]"
            variant={isLive ? "destructive" : "secondary"}
          >
            {isLive ? "Live Party" : "Upcoming Party"}
          </Badge>
          <Badge
            className="absolute right-2 bottom-2 gap-1 bg-black/70 text-[10px] text-white"
            variant="outline"
          >
            <CalendarClock aria-hidden="true" className="size-3" />
            {formatPartyDate(party.scheduledStartAt)}
          </Badge>
        </PublicCardThumbnail>
        <PublicCardMeta className="space-y-1.5">
          <h3 className="truncate font-semibold text-foreground text-sm leading-snug transition-colors group-hover:text-primary">
            {party.title}
          </h3>
          <p className="truncate text-muted-foreground text-xs">
            {categoryLabel} <span aria-hidden="true">•</span>{" "}
            {party.genre ?? "Listening Party"}
          </p>
        </PublicCardMeta>
      </PublicCard>
    </Link>
  );
}

function LivePartiesPage() {
  const navigate = Route.useNavigate(),
    search = Route.useSearch(),
    region = search.region ?? "all",
    regionType = search.regionType ?? "global",
    genresQuery = useGenresQuery(),
    { data: parties = [], isLoading } = useListeningPartiesQuery({
      region,
      regionType,
    }),
    genre = search.genre ?? "all",
    sort = search.sort ?? "starts-asc",
    status = search.status ?? "all",
    view = search.view ?? "sections",
    genres = genresQuery.data ?? [],
    partyItems: PartyCollectionItem[] = parties.map((party) => ({
      ...party,
      startsAt: party.scheduledStartAt,
      viewerCount: 0,
    })),
    filteredParties = filterAndSortLiveItems({
      genre,
      items: partyItems,
      sort,
      status,
    }),
    openCollection = (next: Partial<LivePartiesSearch>) => {
      void navigate({
        search: (previous) => ({ ...previous, ...next, view: "all" }),
      });
    };

  return (
    <div className="space-y-8 pb-8">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-bold text-2xl md:text-3xl">
            <Headphones className="size-6 text-primary" />
            Listening Parties
          </h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Join scheduled release rooms and fan-hosted playlist sessions with
            synchronized playback and chat.
          </p>
        </div>
        <CreateFanPartyDialog />
      </section>

      <div className="hidden lg:block">
        <RegionSelectors
          onChange={(next) => {
            void navigate({
              search: (previous) => ({ ...previous, ...next }),
            });
          }}
          region={region}
          regionType={regionType}
        />
      </div>

      <LiveCollectionFilters
        onChange={(next) => {
          void navigate({
            search: (previous) => ({ ...previous, ...next, view: "all" }),
          });
        }}
        value={{ genre, sort }}
      />

      {view === "all" ? (
        <ExploreCollectionGrid
          empty="No listening parties match these filters."
          isLoading={isLoading}
          items={filteredParties}
          title="Listening Parties"
        >
          {(party) => <PartySummaryCard party={party} />}
        </ExploreCollectionGrid>
      ) : (
        <>
          <ExploreCollectionSection
            empty="No featured parties yet."
            isLoading={isLoading}
            items={partyItems.slice(0, 6)}
            onViewAll={() => openCollection({})}
            title="Featured"
          >
            {(party) => <PartySummaryCard party={party} />}
          </ExploreCollectionSection>
          <ExploreCollectionSection
            empty="No listening parties are live right now."
            items={partyItems.filter((party) => party.status === "live")}
            onViewAll={() => openCollection({ status: "live" })}
            title="Live Now"
          >
            {(party) => <PartySummaryCard party={party} />}
          </ExploreCollectionSection>
          <ExploreCollectionSection
            empty="No upcoming listening parties are scheduled."
            items={partyItems.filter((party) => party.status === "scheduled")}
            onViewAll={() => openCollection({ status: "scheduled" })}
            title="Upcoming"
          >
            {(party) => <PartySummaryCard party={party} />}
          </ExploreCollectionSection>
          {genres.map((sectionGenre) => {
            const sectionSlug = normalizeGenreValue(sectionGenre.slug),
              sectionLabel = normalizeGenreValue(sectionGenre.name);
            return (
              <ExploreCollectionSection
                empty={`No ${sectionGenre.name} parties are scheduled.`}
                hideWhenEmpty
                items={partyItems.filter((party) => {
                  const itemGenre = normalizeGenreValue(party.genre);
                  return (
                    itemGenre === sectionSlug ||
                    itemGenre === sectionLabel ||
                    itemGenre.startsWith(sectionSlug) ||
                    sectionSlug.startsWith(itemGenre)
                  );
                })}
                key={sectionGenre.slug}
                onViewAll={() => openCollection({ genre: sectionGenre.slug })}
                title={sectionGenre.name}
              >
                {(party) => <PartySummaryCard party={party} />}
              </ExploreCollectionSection>
            );
          })}
        </>
      )}
    </div>
  );
}
