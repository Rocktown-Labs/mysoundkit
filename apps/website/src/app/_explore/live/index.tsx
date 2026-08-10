import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Trophy,
  Zap,
  Headphones,
  Radio,
  Users,
  Music,
  CalendarClock,
} from "lucide-react";
import { useState, useEffect } from "react";
import type { ReactNode } from "react";

import { BattleCard } from "@/components/explore/battle-card";
import { SectionHeader } from "@/components/explore/section-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useBattlesQuery,
  useListeningPartiesQuery,
  useMeEntitlementsQuery,
  type BattleSummary,
  type ListeningPartySummary,
} from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/_explore/live/")({
  component: LiveHubPage,
});

function LiveSummaryRail<T>({
  empty,
  isLoading,
  items,
  renderItem,
}: {
  empty: string;
  isLoading: boolean;
  items: T[];
  renderItem: (item: T) => ReactNode;
}) {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-muted-foreground text-sm">
        Loading live rooms...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-muted-foreground text-sm">
        {empty}
      </div>
    );
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0">
      <div className="flex min-w-max gap-4 md:gap-6">
        {items.map((item) => renderItem(item))}
      </div>
    </div>
  );
}

function BattleSummaryCard({
  battle,
  isPremiumUser,
}: {
  battle: BattleSummary;
  isPremiumUser: boolean;
}) {
  const tracks = battle.tracks ?? [];

  if (tracks.length >= 2) {
    return (
      <div className="w-[280px] shrink-0 md:w-[300px]">
        <BattleCard
          currentRound={battle.round?.current ?? 1}
          genre={battle.genre}
          id={battle.id}
          isLive={battle.status === "live"}
          isPremiumUser={isPremiumUser}
          isVoting={battle.round?.isVoting ?? false}
          joinMode={battle.joinMode}
          phaseEndsAt={battle.phaseEndsAt}
          queueSize={battle.queueSize}
          title={battle.title}
          totalRounds={battle.round?.total ?? 1}
          track1={{
            artist: tracks[0].artist,
            cover: tracks[0].cover ?? "",
            title: tracks[0].title,
            votes: tracks[0].votes,
          }}
          track2={{
            artist: tracks[1].artist,
            cover: tracks[1].cover ?? "",
            title: tracks[1].title,
            votes: tracks[1].votes,
          }}
        />
      </div>
    );
  }

  return (
    <Link
      className="block w-[260px] shrink-0 md:w-[300px]"
      params={{ id: battle.id }}
      to="/live/battles/$id"
    >
      <Card className="h-full border-border/40 bg-card/60 transition-colors hover:border-primary/50">
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center justify-between gap-2">
            <Badge variant="secondary">{battle.genre}</Badge>
            <Badge
              variant={battle.status === "live" ? "destructive" : "outline"}
            >
              {battle.status}
            </Badge>
          </div>
          <div>
            <h3 className="line-clamp-2 font-semibold text-base">
              {battle.title}
            </h3>
            <p className="mt-1 text-muted-foreground text-xs">
              {battle.format.replaceAll("_", " ")}
            </p>
          </div>
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>{battle.viewerCount.toLocaleString()} viewers</span>
            <span>
              {battle.visibility === "premium_only" ? "Premium" : "Public"}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

const formatPartyDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value));

function PartySummaryCard({ party }: { party: ListeningPartySummary }) {
  return (
    <Link
      className="block w-[300px] shrink-0 md:w-[350px]"
      params={{ id: party.liveRoomId ?? party.id }}
      to="/live/parties/$id"
    >
      <Card className="h-full border-border/40 bg-card/60 transition-colors hover:border-primary/50">
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center justify-between gap-2">
            <Badge
              variant={party.status === "live" ? "destructive" : "secondary"}
            >
              {party.status}
            </Badge>
            <Badge variant="outline">
              {party.playbackMode === "programmed_release"
                ? "Release Party"
                : "Listening Party"}
            </Badge>
          </div>
          <div>
            <h3 className="line-clamp-2 font-bold text-lg">{party.title}</h3>
            {party.description && (
              <p className="mt-2 line-clamp-2 text-muted-foreground text-sm">
                {party.description}
              </p>
            )}
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

function LiveHubPage() {
  const [selectedLocation, setSelectedLocation] = useState("California");
  const [viewMode, setViewMode] = useState<"usa" | "global">("usa");
  const [selectedState, setSelectedState] = useState("USA");
  const { data: battles = [], isLoading: isLoadingBattles } = useBattlesQuery();
  const entitlementsQuery = useMeEntitlementsQuery();
  const { data: parties = [], isLoading: isLoadingParties } =
    useListeningPartiesQuery();
  const liveBattles = battles.filter((battle) => battle.status === "live");
  const liveParties = parties.filter((party) => party.status === "live");
  const isPremiumUser = Boolean(
    entitlementsQuery.data?.isPremium ||
    entitlementsQuery.data?.canViewLiveBattles ||
    entitlementsQuery.data?.canVoteLiveBattles
  );

  const usStates = [
    "USA",
    "California",
    "New York",
    "Texas",
    "Florida",
    "Illinois",
    "Georgia",
    "Pennsylvania",
  ];

  return (
    <>
      <section id="live-battles" className="mb-8 md:mb-12">
        <SectionHeader
          title="Live Battles"
          description="Epic head-to-head matchups."
          icon={<Zap className="size-6 text-primary" />}
          viewAllHref="/live/battles"
        />

        <LiveSummaryRail
          empty="No live battles are active right now."
          isLoading={isLoadingBattles}
          items={liveBattles}
          renderItem={(battle) => (
            <BattleSummaryCard
              battle={battle}
              isPremiumUser={isPremiumUser}
              key={battle.id}
            />
          )}
        />
      </section>

      <section className="mb-8 md:mb-12">
        <SectionHeader
          title="Live Listening Parties"
          description="Vibe together, discover new music, and chat with other fans."
          icon={<Headphones className="size-6 text-primary" />}
          viewAllHref="/live/parties"
        />
        <LiveSummaryRail
          empty="No listening parties are live right now."
          isLoading={isLoadingParties}
          items={liveParties}
          renderItem={(party) => (
            <PartySummaryCard key={party.id} party={party} />
          )}
        />
      </section>

      <section className="mb-8 md:mb-12">
        <SectionHeader
          title="Creator Streams"
          description="Watch producers make beats and artists track vocals live."
          icon={<Radio className="size-6 text-primary" />}
          viewAllHref="/live/streams"
        />
        <div className="rounded-lg border border-dashed p-6 text-muted-foreground text-sm">
          No public creator streams are live right now.
        </div>
      </section>

      <section className="mb-8 md:mb-12">
        <SectionHeader
          title="Browse Live By Genre"
          description="Genre-specific live rooms appear here as artists schedule public sessions."
          icon={<Music className="size-6 text-primary" />}
          viewAllHref="/live"
        />
        <div className="rounded-lg border border-dashed p-6 text-muted-foreground text-sm">
          Live genre rails will fill in once public live rooms expose genre
          metadata.
        </div>
      </section>

      {/* Battle Leaderboard */}
      <section className="mb-8 md:mb-12">
        <SectionHeader
          title="Battle Leaderboard"
          description="Top artists in the battle scene"
          icon={<Trophy className="size-6 text-primary" />}
          viewAllHref="/live/battles/leaderboard"
        />

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
          <Select
            value={viewMode === "usa" ? selectedState : ""}
            onValueChange={(value) => {
              setViewMode("usa");
              setSelectedState(value);
              setSelectedLocation(value);
            }}
            disabled={viewMode === "global"}
          >
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Select US location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USA-header" disabled className="font-semibold">
                🇺🇸 United States
              </SelectItem>
              {usStates.map((state) => (
                <SelectItem key={state} value={state}>
                  {state === "USA" ? "All USA" : state}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={viewMode === "global" ? selectedLocation : ""}
            onValueChange={(value) => {
              setViewMode("global");
              setSelectedLocation(value);
            }}
            disabled={viewMode === "usa"}
          >
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Select global region" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="global">🌍 All Global</SelectItem>
              <SelectItem value="africa">🌍 Africa</SelectItem>
              <SelectItem value="europe">🌍 Europe</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto pb-4 scrollbar-hide">
          <div className="flex gap-4 md:gap-6">
            {/* Card 1: Ranks 1-4 */}
            <div className="shrink-0 w-[85vw] md:w-[400px] space-y-3">
              {[
                {
                  battles: 52,
                  city: "Los Angeles, CA",
                  flag: "🇺🇸",
                  name: "DJ Nova",
                  rank: 1,
                  wins: 47,
                },
                {
                  battles: 50,
                  city: "Brooklyn, NY",
                  flag: "🇺🇸",
                  name: "MC Rhythm",
                  rank: 2,
                  wins: 42,
                },
                {
                  battles: 45,
                  city: "Atlanta, GA",
                  flag: "🇺🇸",
                  name: "Luna Eclipse",
                  rank: 3,
                  wins: 38,
                },
                {
                  battles: 44,
                  city: "Houston, TX",
                  flag: "🇺🇸",
                  name: "Street Poet",
                  rank: 4,
                  wins: 35,
                },
              ].map((artist) => (
                <Link
                  key={artist.rank}
                  to="/artist/$username"
                  params={{
                    username: artist.name.toLowerCase().replace(" ", "-"),
                  }}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div
                    className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                      artist.rank === 1
                        ? "bg-yellow-500 text-yellow-950"
                        : artist.rank === 2
                          ? "bg-gray-400 text-gray-950"
                          : artist.rank === 3
                            ? "bg-amber-600 text-amber-950"
                            : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {artist.rank}
                  </div>
                  <Avatar className="size-10">
                    <AvatarImage src="/diverse-user-avatars.png" />
                    <AvatarFallback>{artist.name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">
                      {artist.name}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {artist.city}
                    </div>
                  </div>
                  <div className="text-xl shrink-0">{artist.flag}</div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

    </>
  );
}
