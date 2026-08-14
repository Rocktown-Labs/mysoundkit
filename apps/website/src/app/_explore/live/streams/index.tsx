import { createFileRoute, Link } from "@tanstack/react-router";
import { Eye, Plus, Radio } from "lucide-react";

import {
  ExploreCollectionGrid,
  ExploreCollectionSection,
} from "@/components/explore/explore-collection";
import { LiveCollectionFilters } from "@/components/explore/live-collection-filters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { filterAndSortLiveItems } from "@/lib/live-collection";
import { musicGenres } from "@/lib/music-genres";
import {
  useMeEntitlementsQuery,
  useMeQuery,
  usePublicLiveExperiencesQuery,
} from "@/lib/soundkit-api-hooks";

interface LiveStreamsSearch {
  genre?: string;
  sort?: string;
  status?: string;
  view?: "all" | "sections";
}

interface PublicStream {
  endsAt: string | null;
  genre: string | null;
  id: string;
  kind: "battle" | "party" | "stream";
  source: string;
  startsAt: string;
  status: string;
  title: string;
  viewerCount: number;
}

export const Route = createFileRoute("/_explore/live/streams/")({
  component: LiveStreamsPage,
  validateSearch: (search: Record<string, unknown>): LiveStreamsSearch => ({
    genre: typeof search.genre === "string" ? search.genre : "all",
    sort: typeof search.sort === "string" ? search.sort : "starts-asc",
    status: typeof search.status === "string" ? search.status : "all",
    view: search.view === "all" ? "all" : "sections",
  }),
});

function StreamCard({ stream }: { stream: PublicStream }) {
  return (
    <Link
      className="block w-full min-w-[280px]"
      params={{ id: stream.id }}
      to="/live/streams/$id"
    >
      <Card className="h-full border-border/50 bg-card/60 transition-colors hover:border-primary/60">
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center justify-between gap-2">
            <Badge variant={stream.status === "live" ? "destructive" : "secondary"}>
              {stream.status === "live" ? "Live" : "Scheduled"}
            </Badge>
            <Badge variant="outline">{stream.source.toUpperCase()}</Badge>
          </div>
          <div>
            <h3 className="line-clamp-2 font-bold text-lg">{stream.title}</h3>
            <p className="mt-2 text-muted-foreground text-sm">
              {stream.genre ?? "Creator stream"}
            </p>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Eye className="size-4 text-primary" />
            {stream.viewerCount.toLocaleString()} viewers
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function LiveStreamsPage() {
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const { data: streams = [], isLoading } =
    usePublicLiveExperiencesQuery("stream");
  const meQuery = useMeQuery();
  const entitlementsQuery = useMeEntitlementsQuery();
  const genre = search.genre ?? "all";
  const sort = search.sort ?? "starts-asc";
  const status = search.status ?? "all";
  const view = search.view ?? "sections";
  const publicStreams = (streams as PublicStream[]).filter(
    (stream) => stream.kind === "stream"
  );
  const filteredStreams = filterAndSortLiveItems({
    genre,
    items: publicStreams,
    sort,
    status,
  });
  const canCreateStream =
    meQuery.data?.user.accountType === "artist" &&
    Boolean(entitlementsQuery.data?.isPremium);

  const openCollection = (next: Partial<LiveStreamsSearch>) => {
    void navigate({
      search: (previous) => ({ ...previous, ...next, view: "all" }),
    });
  };

  return (
    <div className="space-y-8 pb-8">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-bold text-2xl md:text-3xl">
            <Radio className="size-6 text-primary" />
            Creator Streams
          </h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Browse featured broadcasts, live OBS rooms, scheduled streams, and
            genre channels.
          </p>
        </div>
        {canCreateStream ? (
          <Button asChild>
            <Link to="/dashboard/live/streams">
              <Plus className="mr-2 size-4" />
              Start A Stream
            </Link>
          </Button>
        ) : null}
      </section>

      <LiveCollectionFilters
        onChange={(next) => {
          void navigate({ search: { ...next, view: "all" } });
        }}
        value={{ genre, sort, status }}
      />

      {view === "all" ? (
        <ExploreCollectionGrid
          empty="No creator streams match these filters."
          isLoading={isLoading}
          items={filteredStreams}
          title="Creator Streams"
        >
          {(stream) => <StreamCard stream={stream} />}
        </ExploreCollectionGrid>
      ) : (
        <>
          <ExploreCollectionSection
            empty="No featured streams are available."
            isLoading={isLoading}
            items={publicStreams.slice(0, 6)}
            onViewAll={() => openCollection({})}
            title="Featured"
          >
            {(stream) => <StreamCard stream={stream} />}
          </ExploreCollectionSection>
          <ExploreCollectionSection
            empty="No creator streams are live right now."
            items={publicStreams.filter((stream) => stream.status === "live")}
            onViewAll={() => openCollection({ status: "live" })}
            title="Live Now"
          >
            {(stream) => <StreamCard stream={stream} />}
          </ExploreCollectionSection>
          <ExploreCollectionSection
            empty="No upcoming streams are scheduled."
            items={publicStreams.filter((stream) => stream.status === "scheduled")}
            onViewAll={() => openCollection({ status: "scheduled" })}
            title="Upcoming"
          >
            {(stream) => <StreamCard stream={stream} />}
          </ExploreCollectionSection>
          {musicGenres.map((sectionGenre) => (
            <ExploreCollectionSection
              empty={`No ${sectionGenre.label} streams are scheduled.`}
              items={publicStreams.filter(
                (stream) => stream.genre === sectionGenre.value
              )}
              key={sectionGenre.value}
              onViewAll={() => openCollection({ genre: sectionGenre.value })}
              title={sectionGenre.label}
            >
              {(stream) => <StreamCard stream={stream} />}
            </ExploreCollectionSection>
          ))}
        </>
      )}
    </div>
  );
}
