import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, Headphones, Radio, Swords, Zap } from "lucide-react";

import {
  ExploreCollectionGrid,
  ExploreCollectionSection,
} from "@/components/explore/explore-collection";
import { LiveCollectionFilters } from "@/components/explore/live-collection-filters";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { filterAndSortLiveItems } from "@/lib/live-collection";
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

function LiveHubCard({ item }: { item: LiveHubItem }) {
  const Icon = item.kind === "battle" ? Swords : item.kind === "party" ? Headphones : Radio;

  return (
    <Link
      className="block w-full min-w-[280px]"
      params={{ id: item.id }}
      to={item.href}
    >
      <Card className="h-full border-border/50 bg-card/60 transition-colors hover:border-primary/60">
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center justify-between gap-2">
            <Badge variant={item.status === "live" ? "destructive" : "secondary"}>
              {item.status === "live" ? "Live" : "Upcoming"}
            </Badge>
            <Badge className="gap-1" variant="outline">
              <Icon className="size-3" />
              {kindLabel(item.kind)}
            </Badge>
          </div>
          <div>
            <h3 className="line-clamp-2 font-bold text-lg">{item.title}</h3>
            <p className="mt-2 text-muted-foreground text-sm">
              {item.genre ?? "Live on SoundKit"}
            </p>
          </div>
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>{item.viewerCount.toLocaleString()} viewers</span>
            {item.startsAt ? (
              <span className="flex items-center gap-1">
                <CalendarClock className="size-3" />
                {new Date(item.startsAt).toLocaleDateString()}
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function LiveHubPage() {
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const battlesQuery = useBattlesQuery();
  const partiesQuery = useListeningPartiesQuery();
  const streamsQuery = usePublicLiveExperiencesQuery("stream");
  const genre = search.genre ?? "all";
  const sort = search.sort ?? "starts-asc";
  const status = search.status ?? "all";
  const view = search.view ?? "sections";

  const battleItems: LiveHubItem[] = (battlesQuery.data ?? [])
    .filter((battle) => battle.status === "live" || battle.status === "scheduled")
    .map((battle) => ({
      genre: battle.genre,
      href: "/live/battles/$id",
      id: battle.id,
      kind: "battle",
      startsAt: null,
      status: battle.status,
      title: battle.title,
      viewerCount: battle.viewerCount,
    }));
  const partyItems: LiveHubItem[] = (partiesQuery.data ?? []).map((party) => ({
    genre: party.genre ?? null,
    href: "/live/parties/$id",
    id: party.liveRoomId ?? party.id,
    kind: "party",
    startsAt: party.scheduledStartAt,
    status: party.status,
    title: party.title,
    viewerCount: 0,
  }));
  const streamItems: LiveHubItem[] = (streamsQuery.data ?? [])
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
    }));
  const allItems = [...battleItems, ...partyItems, ...streamItems];
  const filteredItems = filterAndSortLiveItems({
    genre,
    items: allItems,
    sort,
    status,
  });
  const isLoading =
    battlesQuery.isLoading || partiesQuery.isLoading || streamsQuery.isLoading;

  const openCollection = (next: Partial<LiveHubSearch>) => {
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
          Real battles, listening parties, and creator streams from the SoundKit community.
        </p>
      </section>

      <LiveCollectionFilters
        onChange={(next) => {
          void navigate({ search: { ...next, view: "all" } });
        }}
        value={{ genre, sort, status }}
      />

      {view === "all" ? (
        <ExploreCollectionGrid
          empty="No live experiences match these filters."
          isLoading={isLoading}
          items={filteredItems}
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
            onViewAll={() => openCollection({})}
            title="Featured"
          >
            {(item) => <LiveHubCard item={item} />}
          </ExploreCollectionSection>
          <ExploreCollectionSection
            empty="Nothing is live right now."
            items={allItems.filter((item) => item.status === "live")}
            onViewAll={() => openCollection({ status: "live" })}
            title="Live Now"
          >
            {(item) => <LiveHubCard item={item} />}
          </ExploreCollectionSection>
          <ExploreCollectionSection
            empty="No upcoming live experiences are scheduled."
            items={allItems.filter((item) => item.status === "scheduled")}
            onViewAll={() => openCollection({ status: "scheduled" })}
            title="Upcoming"
          >
            {(item) => <LiveHubCard item={item} />}
          </ExploreCollectionSection>
          {musicGenres.map((sectionGenre) => (
            <ExploreCollectionSection
              empty={`No ${sectionGenre.label} live experiences yet.`}
              items={allItems.filter((item) => item.genre === sectionGenre.value)}
              key={sectionGenre.value}
              onViewAll={() => openCollection({ genre: sectionGenre.value })}
              title={sectionGenre.label}
            >
              {(item) => <LiveHubCard item={item} />}
            </ExploreCollectionSection>
          ))}
        </>
      )}
    </div>
  );
}
