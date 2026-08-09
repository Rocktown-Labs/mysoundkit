import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  DoorOpen,
  Mic,
  MicOff,
  Radio,
  ShieldCheck,
  Trophy,
  Users,
} from "lucide-react";

import { LiveRoomAccessGuard } from "@/components/explore/live-room-access-guard";
import {
  LiveChatPanel,
  LiveLyricsPanel,
} from "@/components/live/live-room-panels";
import { AppImage } from "@/components/ui/app-image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LiveBattleRound, LiveRoomArtist } from "@/lib/live-room";
import { useLiveRoom } from "@/lib/live-room";

export const Route = createFileRoute("/_explore/live/battles/$id")({
  component: BattlePage,
});

const voteTotal = (round: LiveBattleRound) =>
  Object.values(round.voteTotals).reduce((sum, votes) => sum + votes, 0);

const votePercent = (round: LiveBattleRound, artistId: string) => {
  const total = voteTotal(round);
  return total > 0
    ? Math.round(((round.voteTotals[artistId] ?? 0) / total) * 100)
    : 0;
};

function StageCard({
  artist,
  isActive,
}: {
  artist: LiveRoomArtist;
  isActive: boolean;
}) {
  return (
    <Card className={isActive ? "border-primary" : undefined}>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center gap-3">
          <Avatar className="size-12">
            <AvatarImage src={artist.avatarUrl} />
            <AvatarFallback>{artist.name.slice(0, 1)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate font-semibold">{artist.name}</p>
              {artist.verified && (
                <CheckCircle2 className="size-4 text-primary" />
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {artist.roundsWon} rounds won
            </p>
          </div>
        </div>
        <Badge variant={artist.isMuted ? "outline" : "default"}>
          {artist.isMuted ? (
            <MicOff className="mr-1 size-3" />
          ) : (
            <Mic className="mr-1 size-3" />
          )}
          {artist.isMuted ? "Muted until turn" : "Live on stage"}
        </Badge>
      </CardContent>
    </Card>
  );
}

function BattlePage() {
  const { id } = Route.useParams();
  const router = useRouter();
  const { chat, query, vote } = useLiveRoom(id);
  const room = query.data;
  const battle = room?.battle;
  const currentRound = battle?.rounds.find(
    (round) => round.id === battle.currentRoundId
  );
  const currentTrack = room?.tracklist.find(
    (track) => track.id === room.currentTrackId
  );

  if (query.isLoading || !room || !battle) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        Loading live battle...
      </div>
    );
  }

  const [artistA, artistB] = battle.artists;

  if (!currentRound) {
    return (
      <LiveRoomAccessGuard roomTitle={room.title}>
        <div className="space-y-6 pb-8">
          <Button
            className="px-0"
            onClick={() => router.history.back()}
            size="sm"
            variant="ghost"
          >
            <ArrowLeft className="mr-2 size-4" />
            Back
          </Button>
          <Card>
            <CardHeader>
              <CardTitle>{room.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground">
              <p>
                This battle room is live, but no battle rounds have been
                published yet.
              </p>
              <Button asChild variant="outline">
                <Link to="/live/battles">Back to Battles</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </LiveRoomAccessGuard>
    );
  }

  const isTieAfterCompletedRounds = artistA.roundsWon === artistB.roundsWon;

  return (
    <LiveRoomAccessGuard roomTitle={room.title}>
      <div className="space-y-6 pb-8">
        <Button
          className="px-0"
          onClick={() => router.history.back()}
          size="sm"
          variant="ghost"
        >
          <ArrowLeft className="mr-2 size-4" />
          Back
        </Button>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px_minmax(0,1fr)]">
          <StageCard artist={artistA} isActive={!artistA.isMuted} />
          <div className="flex items-center justify-center rounded-lg border bg-card p-4 text-center">
            <div>
              <Badge variant="destructive">
                <Radio className="mr-1 size-3" />
                Live Battle
              </Badge>
              <h1 className="mt-3 text-3xl font-bold">{room.title}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Round {currentRound.number}
                {currentRound.isTiebreaker ? " tiebreaker" : ""} is{" "}
                {currentRound.status}.
              </p>
            </div>
          </div>
          <StageCard artist={artistB} isActive={!artistB.isMuted} />
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_420px]">
          <main className="space-y-6">
            <section className="overflow-hidden rounded-lg border bg-card">
              <div className="relative aspect-video">
                <AppImage
                  alt={currentTrack?.title ?? room.title}
                  className="h-full w-full object-cover"
                  height={720}
                  src={
                    currentTrack?.coverArtUrl ??
                    "/music-battle-live-performance-video.jpg"
                  }
                  width={1280}
                />
                <div className="absolute inset-0 bg-black/45" />
                <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                  <Badge variant="secondary">Cloudflare Realtime ready</Badge>
                  <Badge variant="outline" className="bg-black/60 text-white">
                    <Users className="mr-1 size-3" />
                    {room.viewerCount.toLocaleString()}
                  </Badge>
                </div>
                <div className="absolute bottom-5 left-5 right-5">
                  <p className="text-sm font-medium uppercase tracking-wide text-white/70">
                    Now performing
                  </p>
                  <h2 className="text-3xl font-bold text-white">
                    {currentTrack?.title}
                  </h2>
                  <p className="text-white/75">{currentTrack?.artistName}</p>
                </div>
              </div>
            </section>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="size-5" />
                  Vote This Round
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                {battle.artists.map((artist) => (
                  <div
                    className="space-y-3 rounded-lg border p-4"
                    key={artist.id}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{artist.name}</p>
                      <Badge variant="outline">
                        {votePercent(currentRound, artist.id)}%
                      </Badge>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary"
                        style={{
                          width: `${votePercent(currentRound, artist.id)}%`,
                        }}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {(
                        currentRound.voteTotals[artist.id] ?? 0
                      ).toLocaleString()}{" "}
                      votes
                    </p>
                    <Button
                      className="w-full"
                      disabled={
                        currentRound.status !== "voting" || vote.isPending
                      }
                      onClick={() =>
                        vote.mutate({
                          artistId: artist.id,
                          roundId: currentRound.id,
                          voterId: "browser-viewer",
                        })
                      }
                    >
                      Vote {artist.name}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <LiveLyricsPanel track={currentTrack} />
          </main>

          <aside className="space-y-6">
            <LiveChatPanel
              disabled={chat.isPending}
              messages={room.chat}
              onSend={(message) => chat.mutate({ message, userName: "You" })}
            />

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bot className="size-5 text-primary" />
                  BattleBot Control
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 font-medium">
                      <DoorOpen className="size-4 text-primary" />
                      Next-round lobby
                    </span>
                    <Badge variant="outline">Text chat only</Badge>
                  </div>
                  <p className="mt-2 text-muted-foreground">
                    Viewers who arrive mid-round wait in a RealtimeKit breakout
                    lobby and move into the battle between rounds.
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 font-medium">
                      <ShieldCheck className="size-4 text-primary" />
                      Voter snapshot
                    </span>
                    <Badge>Mandatory</Badge>
                  </div>
                  <p className="mt-2 text-muted-foreground">
                    Only viewers in the active battle room at round start count
                    as voters. Missed votes remove them before the next round.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Round Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {battle.rounds.map((round) => (
                  <div className="rounded-lg border p-3 text-sm" key={round.id}>
                    <div className="flex items-center justify-between gap-3">
                      <span>
                        {round.isTiebreaker
                          ? "Tiebreaker"
                          : `Round ${round.number}`}
                      </span>
                      <Badge
                        variant={
                          round.status === "voting" ? "default" : "outline"
                        }
                      >
                        {round.status}
                      </Badge>
                    </div>
                    <p className="mt-2 text-muted-foreground">
                      {round.artistATrack.title} vs {round.artistBTrack.title}
                    </p>
                  </div>
                ))}
                {isTieAfterCompletedRounds && (
                  <div className="rounded-lg border border-primary/50 bg-primary/10 p-3 text-sm">
                    {battle.tiePolicy}
                  </div>
                )}
                <Button asChild className="w-full" variant="outline">
                  <Link to="/live/battles">Back to Battles</Link>
                </Button>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </LiveRoomAccessGuard>
  );
}
