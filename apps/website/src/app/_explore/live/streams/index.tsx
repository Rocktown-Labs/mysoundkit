import { createFileRoute, Link } from "@tanstack/react-router";
import { Eye, Plus, Radio } from "lucide-react";

import { SectionHeader } from "@/components/explore/section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  useMeQuery,
  usePublicLiveExperiencesQuery,
} from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/_explore/live/streams/")({
  component: LiveStreamsPage,
});

function StreamRail({
  items,
  title,
}: {
  items: PublicStream[];
  title: string;
}) {
  return (
    <section className="space-y-3">
      <SectionHeader
        description="Public creator broadcasts from OBS and other live sources."
        title={title}
        viewAllHref="/live/streams"
      />
      {items.length > 0 ? (
        <div className="-mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
          <div className="flex min-w-max gap-4 md:gap-6">
            {items.map((stream) => (
              <Link
                className="block w-[300px] shrink-0 md:w-[350px]"
                key={stream.id}
                params={{ id: stream.id }}
                to="/live/streams/$id"
              >
                <Card className="h-full border-border/50 bg-card/60 transition-colors hover:border-primary/60">
                  <CardContent className="space-y-4 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <Badge
                        variant={
                          stream.status === "live" ? "destructive" : "secondary"
                        }
                      >
                        {stream.status === "live" ? "Live" : "Scheduled"}
                      </Badge>
                      <Badge variant="outline">
                        {stream.source.toUpperCase()}
                      </Badge>
                    </div>
                    <div>
                      <h3 className="line-clamp-2 font-bold text-lg">
                        {stream.title}
                      </h3>
                      <p className="mt-2 line-clamp-2 text-muted-foreground text-sm">
                        Public creator broadcast
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <Eye className="size-4 text-primary" />
                      {stream.viewerCount.toLocaleString()} viewers
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-6 text-muted-foreground text-sm">
          No public creator streams are available right now.
        </div>
      )}
    </section>
  );
}

interface PublicStream {
  endsAt: string | null;
  id: string;
  kind: "battle" | "party" | "stream";
  source: string;
  status: string;
  title: string;
  viewerCount: number;
}

function LiveStreamsPage() {
  const { data: streams = [], isLoading } =
    usePublicLiveExperiencesQuery("stream");
  const meQuery = useMeQuery();
  const publicStreams = streams.filter((stream) => stream.kind === "stream");

  return (
    <div className="space-y-8 pb-8">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-bold text-2xl md:text-3xl">
            <Radio className="size-6 text-primary" />
            Creator Streams
          </h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Browse featured public broadcasts, live OBS rooms, and scheduled
            creator streams.
          </p>
        </div>
        {meQuery.data ? (
          <Button asChild>
            <Link to="/dashboard/live/streams">
              <Plus className="mr-2 size-4" />
              Start A Stream
            </Link>
          </Button>
        ) : (
          <Button asChild>
            <Link search={{ redirect: "/live/streams" }} to="/login">
              <Plus className="mr-2 size-4" />
              Start A Stream
            </Link>
          </Button>
        )}
      </section>

      {isLoading ? (
        <div className="rounded-lg border border-dashed p-6 text-muted-foreground text-sm">
          Loading creator streams...
        </div>
      ) : (
        <div className="space-y-8">
          <StreamRail
            items={publicStreams
              .filter((stream) => stream.status === "live")
              .slice(0, 6)}
            title="Featured"
          />
          <StreamRail
            items={publicStreams.filter((stream) => stream.status === "live")}
            title="Live Now"
          />
          <StreamRail
            items={publicStreams.filter(
              (stream) => stream.status === "scheduled"
            )}
            title="Upcoming"
          />
        </div>
      )}
    </div>
  );
}
