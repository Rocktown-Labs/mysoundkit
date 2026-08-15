import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, Headphones, Mic, Radio } from "lucide-react";

import { CreateFanPartyDialog } from "@/components/explore/create-fan-party-dialog";
import {
  ExploreCollectionGrid,
  ExploreCollectionSection,
} from "@/components/explore/explore-collection";
import { LiveCollectionFilters } from "@/components/explore/live-collection-filters";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { filterAndSortLiveItems } from "@/lib/live-collection";
import { musicGenres } from "@/lib/music-genres";
import { useListeningPartiesQuery } from "@/lib/soundkit-api-hooks";
import type { ListeningPartySummary } from "@/lib/soundkit-api-hooks";

interface LivePartiesSearch {
  genre?: string;
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
  const isLive = party.status === "live";

  return (
    <Link
      className="block w-full min-w-[280px]"
      params={{ id: party.liveRoomId ?? party.id }}
      to="/live/parties/$id"
    >
      <Card className="h-full overflow-hidden border-border/50 bg-card/60 transition-colors hover:border-primary/60">
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center justify-between gap-2">
            <Badge variant={isLive ? "destructive" : "secondary"}>
              {isLive ? (
                <>
                  <Radio className="mr-1 size-3" />
                  Live
                </>
              ) : (
                "Scheduled"
              )}
            </Badge>
            <Badge variant="outline">
              {party.playbackMode === "artist_hosted" ? (
                <>
                  <Mic className="mr-1 size-3" />
                  Artist Hosted
                </>
              ) : (
                "Release Party"
              )}
            </Badge>
          </div>
          <div>
            <h3 className="line-clamp-2 font-bold text-lg">{party.title}</h3>
            <p className="mt-2 line-clamp-2 text-muted-foreground text-sm">
              {party.description ?? party.genre ?? "Listening party"}
            </p>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <CalendarClock className="size-4 text-primary" />
            <span>{formatPartyDate(party.scheduledStartAt)}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function LivePartiesPage() {
  const navigate = Route.useNavigate(),
   search = Route.useSearch(),
   { data: parties = [], isLoading } = useListeningPartiesQuery(),
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

      <LiveCollectionFilters
        onChange={(next) => {
          void navigate({ search: { ...next, view: "all" } });
        }}
        value={{ genre, sort, status }}
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
          {musicGenres.map((sectionGenre) => (
            <ExploreCollectionSection
              empty={`No ${sectionGenre.label} parties are scheduled.`}
              items={partyItems.filter(
                (party) => party.genre === sectionGenre.value
              )}
              key={sectionGenre.value}
              onViewAll={() => openCollection({ genre: sectionGenre.value })}
              title={sectionGenre.label}
            >
              {(party) => <PartySummaryCard party={party} />}
            </ExploreCollectionSection>
          ))}
        </>
      )}
    </div>
  );
}
