/* eslint-disable sort-vars */
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Radio } from "lucide-react";

import {
  ExploreCollectionGrid,
  ExploreCollectionSection,
} from "@/components/explore/explore-collection";
import { LiveCollectionFilters } from "@/components/explore/live-collection-filters";
import { StreamCard } from "@/components/explore/stream-card";
import { Button } from "@/components/ui/button";
import {
  filterAndSortLiveItems,
  normalizeGenreValue,
} from "@/lib/live-collection";
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
  creatorAvatar?: null | string;
  creatorName?: null | string;
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

function LiveStreamsPage() {
  const navigate = Route.useNavigate(),
    search = Route.useSearch(),
    { data: streams = [], isLoading } = usePublicLiveExperiencesQuery("stream"),
    meQuery = useMeQuery(),
    entitlementsQuery = useMeEntitlementsQuery(),
    genre = search.genre ?? "all",
    sort = search.sort ?? "starts-asc",
    status = search.status ?? "all",
    view = search.view ?? "sections",
    publicStreams = (streams as PublicStream[]).filter(
      (stream) => stream.kind === "stream"
    ),
    filteredStreams = filterAndSortLiveItems({
      genre,
      items: publicStreams,
      sort,
      status,
    }),
    canCreateStream =
      meQuery.data?.user.accountType === "artist" &&
      Boolean(entitlementsQuery.data?.isPremium),
    openCollection = (next: Partial<LiveStreamsSearch>) => {
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
          layout="landscape"
          title="Creator Streams"
        >
          {(stream) => <StreamCard {...stream} />}
        </ExploreCollectionGrid>
      ) : (
        <>
          <ExploreCollectionSection
            empty="No featured streams are available."
            isLoading={isLoading}
            items={publicStreams.slice(0, 8)}
            layout="landscape"
            onViewAll={() => openCollection({})}
            title="Featured"
          >
            {(stream) => <StreamCard {...stream} />}
          </ExploreCollectionSection>
          <ExploreCollectionSection
            empty="No creator streams are live right now."
            items={publicStreams.filter((stream) => stream.status === "live")}
            layout="landscape"
            onViewAll={() => openCollection({ status: "live" })}
            title="Live Now"
          >
            {(stream) => <StreamCard {...stream} />}
          </ExploreCollectionSection>
          <ExploreCollectionSection
            empty="No upcoming streams are scheduled."
            items={publicStreams.filter(
              (stream) => stream.status === "scheduled"
            )}
            layout="landscape"
            onViewAll={() => openCollection({ status: "scheduled" })}
            title="Upcoming"
          >
            {(stream) => <StreamCard {...stream} />}
          </ExploreCollectionSection>
          {musicGenres.map((sectionGenre) => {
            const sectionSlug = normalizeGenreValue(sectionGenre.value),
              sectionLabel = normalizeGenreValue(sectionGenre.label);
            return (
              <ExploreCollectionSection
                empty={`No ${sectionGenre.label} streams are scheduled.`}
                items={publicStreams.filter((stream) => {
                  const itemGenre = normalizeGenreValue(stream.genre);
                  return (
                    stream.genre === sectionGenre.value ||
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
                {(stream) => <StreamCard {...stream} />}
              </ExploreCollectionSection>
            );
          })}
        </>
      )}
    </div>
  );
}
