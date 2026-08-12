import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, Headphones, Mic, Radio } from "lucide-react";

import { CreateFanPartyDialog } from "@/components/explore/create-fan-party-dialog";
import { SectionHeader } from "@/components/explore/section-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useListeningPartiesQuery } from "@/lib/soundkit-api-hooks";
import type { ListeningPartySummary } from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/_explore/live/parties/")({
  component: LivePartiesPage,
});

const formatPartyDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value));

function PartyRail({
  empty,
  items,
  title,
}: {
  empty: string;
  items: ListeningPartySummary[];
  title: string;
}) {
  return (
    <section className="space-y-3">
      <SectionHeader
        description="Synced listening rooms with shared chat and saves."
        title={title}
        viewAllHref="/live/parties"
      />
      {items.length > 0 ? (
        <div className="-mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
          <div className="flex min-w-max gap-4 md:gap-6">
            {items.map((party) => (
              <PartySummaryCard key={party.id} party={party} />
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-6 text-muted-foreground text-sm">
          {empty}
        </div>
      )}
    </section>
  );
}

function PartySummaryCard({ party }: { party: ListeningPartySummary }) {
  const isLive = party.status === "live";

  return (
    <Link
      className="block w-[300px] shrink-0 md:w-[350px]"
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
            {party.description ? (
              <p className="mt-2 line-clamp-2 text-muted-foreground text-sm">
                {party.description}
              </p>
            ) : null}
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
  const { data: parties = [], isLoading } = useListeningPartiesQuery();
  const featured = parties.slice(0, 6);
  const liveParties = parties.filter((party) => party.status === "live");
  const upcomingParties = parties.filter(
    (party) => party.status === "scheduled"
  );
  const modeSections = [
    {
      items: parties.filter((party) => party.playbackMode === "artist_hosted"),
      title: "Artist Hosted",
    },
    {
      items: parties.filter(
        (party) => party.playbackMode === "programmed_release"
      ),
      title: "Release Parties",
    },
  ].filter((section) => section.items.length > 0);

  return (
    <div className="space-y-8 pb-8">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-bold text-2xl md:text-3xl">
            <Headphones className="size-6 text-primary" />
            Listening Parties
          </h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Join release rooms and artist-hosted listening sessions. Browse
            featured rooms, live chats, upcoming parties, and room types.
          </p>
        </div>
        <CreateFanPartyDialog />
      </section>

      {isLoading ? (
        <div className="rounded-lg border border-dashed p-6 text-muted-foreground text-sm">
          Loading listening parties...
        </div>
      ) : (
        <div className="space-y-8">
          <PartyRail
            empty="No featured parties yet."
            items={featured}
            title="Featured"
          />
          <PartyRail
            empty="No listening parties are live right now."
            items={liveParties}
            title="Live Now"
          />
          <PartyRail
            empty="No upcoming listening parties are scheduled yet."
            items={upcomingParties}
            title="Upcoming"
          />
          {modeSections.map((section) => (
            <PartyRail
              empty={`No ${section.title} parties yet.`}
              items={section.items}
              key={section.title}
              title={section.title}
            />
          ))}
        </div>
      )}
    </div>
  );
}
