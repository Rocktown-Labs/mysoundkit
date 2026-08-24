/* eslint-disable one-var, sort-vars */
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Disc3, Headphones, Play, Radio } from "lucide-react";

import { CreateFanPartyDialog } from "@/components/explore/create-fan-party-dialog";
import {
  ExploreCollectionGrid,
  ExploreCollectionSection,
} from "@/components/explore/explore-collection";
import { LiveCollectionFilters } from "@/components/explore/live-collection-filters";
import { RegionSelectors } from "@/components/explore/region-selectors";
import { AppImage } from "@/components/ui/app-image";
import {
  filterAndSortLiveItems,
  normalizeGenreValue,
} from "@/lib/live-collection";
import { musicGenres } from "@/lib/music-genres";
import { useListeningPartiesQuery } from "@/lib/soundkit-api-hooks";
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
        : "Release Party",
    tags = [
      party.genre,
      party.playbackMode.replaceAll("_", " "),
      isLive ? "live" : "upcoming",
    ].filter(Boolean) as string[];

  return (
    <Link
      className="group block w-full text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
      params={{ id: party.liveRoomId ?? party.id }}
      to="/live/parties/$id"
    >
      <div className="flex flex-col gap-2.5">
        {/* Album Cover Art Poster with responsive overlays */}
        <div className="relative aspect-video w-full overflow-hidden rounded-md bg-muted transition-transform duration-300 group-hover:scale-[1.02]">
          <AppImage
            alt={party.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            height={720}
            src={coverArt}
            width={1280}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

          {/* Top-left status badge */}
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
            {isLive ? (
              <span className="flex items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 font-bold text-[11px] text-white uppercase tracking-wider shadow-sm">
                <Radio className="size-3 animate-pulse" />
                LIVE
              </span>
            ) : (
              <span className="rounded bg-black/75 px-1.5 py-0.5 font-medium text-[11px] text-white/90 backdrop-blur-sm">
                {formatPartyDate(party.scheduledStartAt)}
              </span>
            )}
          </div>

          {/* Bottom-left listeners / tracks badge */}
          <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5">
            <span className="flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[11px] text-white/90 backdrop-blur-sm">
              <Headphones className="size-3" />
              {party.playbackMode === "artist_hosted"
                ? "Artist Room"
                : "Album Premiere"}
            </span>
          </div>

          {/* Hover play button */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-black/30">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform duration-200 group-hover:scale-110">
              <Play className="size-5 fill-current ml-0.5" />
            </div>
          </div>
        </div>

        {/* Party Details */}
        <div className="flex gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted border border-border/40 text-primary">
            <Disc3 className="size-4 animate-spin-slow" />
          </div>

          <div className="min-w-0 flex-1 space-y-0.5">
            <h3 className="truncate font-semibold text-foreground text-sm leading-snug transition-colors group-hover:text-primary">
              {party.title}
            </h3>

            <div className="flex items-center gap-1 text-muted-foreground text-xs">
              <span className="truncate">{categoryLabel}</span>
              <CheckCircle2 className="size-3 text-primary shrink-0" />
            </div>

            <p className="truncate text-muted-foreground/80 text-xs">
              {party.genre ?? "Listening Party"}
            </p>

            <div className="flex flex-wrap items-center gap-1 pt-1">
              {tags.slice(0, 3).map((tag) => (
                <span
                  className="rounded-full bg-muted/80 px-2 py-0.5 font-medium text-[10px] text-muted-foreground hover:bg-muted"
                  key={tag}
                >
                  {tag.toLowerCase()}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function LivePartiesPage() {
  const navigate = Route.useNavigate(),
    search = Route.useSearch(),
    region = search.region ?? "all",
    regionType = search.regionType ?? "global",
    { data: parties = [], isLoading } = useListeningPartiesQuery({
      region,
      regionType,
    }),
    genre = search.genre ?? "all",
    sort = search.sort ?? "starts-asc",
    status = search.status ?? "all",
    view = search.view ?? "sections",
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
          {musicGenres.map((sectionGenre) => {
            const sectionSlug = normalizeGenreValue(sectionGenre.value),
              sectionLabel = normalizeGenreValue(sectionGenre.label);
            return (
              <ExploreCollectionSection
                empty={`No ${sectionGenre.label} parties are scheduled.`}
                items={partyItems.filter((party) => {
                  const itemGenre = normalizeGenreValue(party.genre);
                  return (
                    party.genre === sectionGenre.value ||
                    itemGenre === sectionSlug ||
                    itemGenre === sectionLabel ||
                    itemGenre.startsWith(sectionSlug) ||
                    sectionSlug.startsWith(itemGenre)
                  );
                })}
                key={sectionGenre.value}
                onViewAll={() => openCollection({ genre: sectionGenre.value })}
                title={sectionGenre.label}
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
