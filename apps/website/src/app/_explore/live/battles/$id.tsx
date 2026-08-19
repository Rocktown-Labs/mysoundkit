"use client";
/* eslint-disable complexity, no-unused-vars, sort-vars, one-var, require-unicode-regexp, unicorn/consistent-function-scoping */

import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
  ArrowLeft,
  CheckCircle2,
  Heart,
  Maximize,
  Mic,
  MicOff,
  Minimize,
  Radio,
  Share2,
  Swords,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { LiveRoomAccessGuard } from "@/components/explore/live-room-access-guard";
import { LiveChatPanel } from "@/components/live/live-room-panels";
import { LiveTwitchShell } from "@/components/live/live-twitch-shell";
import { UserProfilePreviewModal } from "@/components/live/user-profile-preview-modal";
import type { UserPreviewData } from "@/components/live/user-profile-preview-modal";
import { AppImage } from "@/components/ui/app-image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import type { LiveBattleRound, LiveRoomArtist } from "@/lib/live-room";
import { useLiveRoom } from "@/lib/live-room";

export const Route = createFileRoute("/_explore/live/battles/$id")({
  component: BattlePage,
});

const voteTotal = (round: LiveBattleRound) =>
    Object.values(round.voteTotals).reduce((sum, votes) => sum + votes, 0),
  votePercent = (round: LiveBattleRound, artistId: string) => {
    const total = voteTotal(round);
    return total > 0
      ? Math.round(((round.voteTotals[artistId] ?? 0) / total) * 100)
      : 50;
  };

function WinnerBanner({
  artist,
  isTie,
}: {
  artist?: LiveRoomArtist;
  isTie?: boolean;
}) {
  if (isTie) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-center">
        <p className="font-bold text-amber-400 text-sm">Round Tied!</p>
        <p className="mt-1 text-muted-foreground text-xs">
          Audience votes were split evenly. Entering sudden death tiebreaker.
        </p>
      </div>
    );
  }

  if (!artist) {
    return null;
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-center">
      <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-primary/20 text-primary">
        <Trophy className="size-5" />
      </div>
      <p className="mt-2 font-bold text-base text-foreground">
        {artist.name} Wins Round!
      </p>
      <p className="text-muted-foreground text-xs">
        Highest audience score &amp; verified turn completion
      </p>
    </div>
  );
}

function StageCard({
  artist,
  isActive,
}: {
  artist: LiveRoomArtist;
  isActive: boolean;
}) {
  return (
    <div
      className={`relative flex items-center gap-3.5 rounded-xl border p-3.5 transition-all ${
        isActive
          ? "border-primary bg-primary/10 shadow-md ring-1 ring-primary/40"
          : "border-border/50 bg-card/60"
      }`}
    >
      <Avatar className="size-12 border-2 border-border/80">
        <AvatarImage src={artist.avatarUrl} />
        <AvatarFallback className="font-bold">
          {artist.name.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-1.5">
          <p className="truncate font-bold text-sm">{artist.name}</p>
          {artist.verified && (
            <CheckCircle2 className="size-3.5 text-primary" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 rounded bg-background/80 px-1.5 py-0.5 font-bold text-[10px] text-amber-400">
            <Trophy className="size-2.5" />
            {artist.roundsWon} Won
          </span>
          <Badge
            className="text-[9px] px-1.5 py-0"
            variant={artist.isMuted ? "outline" : "default"}
          >
            {artist.isMuted ? (
              <>
                <MicOff className="mr-1 size-2.5" />
                Muted until turn
              </>
            ) : (
              <>
                <Mic className="mr-1 size-2.5" />
                Turn
              </>
            )}
          </Badge>
        </div>
      </div>
    </div>
  );
}

function BattlePage() {
  const { id } = Route.useParams(),
    router = useRouter(),
    { chat, query, vote } = useLiveRoom(id),
    [isChatOpen, setIsChatOpen] = useState(true),
    [isFullscreen, setIsFullscreen] = useState(false),
    [isFollowingBattle, setIsFollowingBattle] = useState(false),
    [previewUser, setPreviewUser] = useState<UserPreviewData | null>(null),
    videoContainerRef = useRef<HTMLDivElement | null>(null),
    room = query.data,
    battle = room?.battle,
    currentRound = battle?.rounds.find(
      (round) => round.id === battle.currentRoundId
    ),
    currentTrack = room?.tracklist.find(
      (track) => track.id === room.currentTrackId
    );

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (videoContainerRef.current?.requestFullscreen) {
          await videoContainerRef.current.requestFullscreen();
        }
      } else if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch {
      setIsFullscreen((prev) => !prev);
    }
  };

  const handleShareBattle = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      toast({
        description: "Battle link copied to clipboard.",
        title: "Link Copied",
      });
    }
  };

  const handleToggleFollow = () => {
    setIsFollowingBattle((prev) => !prev);
    toast({
      description: isFollowingBattle
        ? "Unfollowed battle notifications."
        : "You will receive alerts when new battle rounds start!",
      title: isFollowingBattle ? "Unfollowed" : "Following Battle",
    });
  };

  if (query.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Swords className="mx-auto size-8 animate-pulse text-primary" />
          <p className="mt-3 font-semibold text-sm">Loading live room...</p>
        </div>
      </div>
    );
  }

  if (query.isError || !room || !battle) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="font-semibold text-sm">
            {query.error?.message ?? "Battle room offline"}
          </p>
        </div>
      </div>
    );
  }

  const [artistA, artistB] = battle.artists;

  if (!currentRound) {
    return (
      <LiveRoomAccessGuard allowPublic={true} roomTitle={room.title}>
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
                <Link
                  search={{
                    genre: undefined,
                    region: undefined,
                    regionType: "north-america",
                    sort: undefined,
                  }}
                  to="/live/battles"
                >
                  Back to Battles
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </LiveRoomAccessGuard>
    );
  }

  const chatPanel = (
      <LiveChatPanel
        disabled={chat.isPending}
        extraHeaderAction={
          <Badge className="font-mono text-[10px]" variant="outline">
            BattleBot Control
          </Badge>
        }
        fillHeight
        messages={room.chat}
        onCollapse={() => setIsChatOpen(false)}
        onSend={(message) => chat.mutate({ message, userName: "You" })}
        title="Arena Chat"
      />
    ),
    videoNode = (
      <div
        className="group relative aspect-video w-full overflow-hidden bg-black"
        ref={videoContainerRef}
      >
        <AppImage
          alt={currentTrack?.title ?? room.title}
          className="size-full object-cover opacity-80"
          height={720}
          src={
            currentTrack?.coverArtUrl ??
            "/music-battle-live-performance-video.jpg"
          }
          width={1280}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/30" />

        <div className="absolute left-4 top-4 right-4 flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="font-bold" variant="destructive">
              ROUND {currentRound.number}{" "}
              {currentRound.isTiebreaker ? "TIEBREAKER" : ""}
            </Badge>
            <Badge className="bg-black/60 backdrop-blur-md" variant="outline">
              Status: {currentRound.status.toUpperCase()}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              className="bg-black/60 text-white backdrop-blur-md"
              variant="outline"
            >
              <Users className="mr-1 size-3" />
              {room.viewerCount.toLocaleString()} watching
            </Badge>
            <Button
              className="size-8 bg-black/60 text-white hover:bg-black/80 backdrop-blur-md"
              onClick={toggleFullscreen}
              size="icon"
              type="button"
              variant="ghost"
            >
              {isFullscreen ? (
                <Minimize className="size-4" />
              ) : (
                <Maximize className="size-4" />
              )}
            </Button>
          </div>
        </div>

        <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
          <div className="grid w-full max-w-lg grid-cols-[1fr_auto_1fr] items-center gap-4 text-center">
            <button
              className="flex flex-col items-center space-y-1 cursor-pointer transition-transform hover:scale-105"
              onClick={() =>
                setPreviewUser({
                  avatarUrl: artistA.avatarUrl,
                  displayName: artistA.name,
                  followersCount: 1450,
                  role: "Battle Contender",
                  username: artistA.name.toLowerCase().replaceAll(/\s+/g, ""),
                  verified: artistA.verified,
                })
              }
              type="button"
            >
              <Avatar className="size-16 sm:size-20 border-2 border-primary ring-4 ring-primary/20 shadow-xl">
                <AvatarImage src={artistA.avatarUrl} />
                <AvatarFallback className="font-bold text-lg">
                  {artistA.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <p className="font-bold text-sm sm:text-base text-white truncate max-w-[120px]">
                {artistA.name}
              </p>
              <span className="text-xs text-amber-400 font-bold">
                {artistA.roundsWon} Wins
              </span>
            </button>

            <div className="rounded-full bg-destructive/90 p-2.5 text-white shadow-lg">
              <Swords className="size-6 sm:size-8" />
            </div>

            <button
              className="flex flex-col items-center space-y-1 cursor-pointer transition-transform hover:scale-105"
              onClick={() =>
                setPreviewUser({
                  avatarUrl: artistB.avatarUrl,
                  displayName: artistB.name,
                  followersCount: 1820,
                  role: "Battle Contender",
                  username: artistB.name.toLowerCase().replaceAll(/\s+/g, ""),
                  verified: artistB.verified,
                })
              }
              type="button"
            >
              <Avatar className="size-16 sm:size-20 border-2 border-secondary ring-4 ring-secondary/20 shadow-xl">
                <AvatarImage src={artistB.avatarUrl} />
                <AvatarFallback className="font-bold text-lg">
                  {artistB.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <p className="font-bold text-sm sm:text-base text-white truncate max-w-[120px]">
                {artistB.name}
              </p>
              <span className="text-xs text-amber-400 font-bold">
                {artistB.roundsWon} Wins
              </span>
            </button>
          </div>
        </div>

        {currentTrack && (
          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between rounded-xl border border-white/10 bg-black/75 px-4 py-2.5 backdrop-blur-md">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                Now Performing Track
              </p>
              <p className="truncate font-semibold text-white text-sm">
                {currentTrack.title} — {currentTrack.artistName}
              </p>
            </div>
          </div>
        )}
      </div>
    );

  return (
    <LiveRoomAccessGuard allowPublic={true} roomTitle={room.title}>
      <LiveTwitchShell
        chatPanel={chatPanel}
        defaultChatOpen={true}
        isChatOpen={isChatOpen}
        onChatOpenChange={setIsChatOpen}
        videoNode={videoNode}
      >
        <div className="space-y-4 pt-4">
          {/* Battle Header Strip directly under video */}
          <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/60 p-4 sm:flex-row sm:items-center sm:justify-between shadow-sm">
            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bold text-lg sm:text-xl text-foreground truncate">
                  {room.title}
                </h2>
                <Badge className="bg-destructive text-destructive-foreground text-[10px] font-bold">
                  LIVE
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  Trap / Boom Bap
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  SoundKit Battle League
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                <button
                  className="font-semibold text-foreground hover:text-primary transition-colors cursor-pointer"
                  onClick={() =>
                    setPreviewUser({
                      avatarUrl: artistA.avatarUrl,
                      displayName: artistA.name,
                      followersCount: 1450,
                      role: "Battle Contender",
                      username: artistA.name
                        .toLowerCase()
                        .replaceAll(/\s+/g, ""),
                      verified: artistA.verified,
                    })
                  }
                  type="button"
                >
                  {artistA.name}
                </button>{" "}
                vs{" "}
                <button
                  className="font-semibold text-foreground hover:text-primary transition-colors cursor-pointer"
                  onClick={() =>
                    setPreviewUser({
                      avatarUrl: artistB.avatarUrl,
                      displayName: artistB.name,
                      followersCount: 1820,
                      role: "Battle Contender",
                      username: artistB.name
                        .toLowerCase()
                        .replaceAll(/\s+/g, ""),
                      verified: artistB.verified,
                    })
                  }
                  type="button"
                >
                  {artistB.name}
                </button>{" "}
                • Click artist to view profile
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Badge
                variant="outline"
                className="gap-1.5 py-1 px-2.5 text-xs font-mono"
              >
                <Radio className="size-3 text-destructive animate-pulse" />
                {room.viewerCount.toLocaleString()} Viewers
              </Badge>
              <Button
                className="gap-1.5 text-xs"
                onClick={handleToggleFollow}
                size="sm"
                variant={isFollowingBattle ? "secondary" : "default"}
              >
                {isFollowingBattle ? (
                  <>
                    <UserCheck className="size-3.5" />
                    Following
                  </>
                ) : (
                  <>
                    <Heart className="size-3.5" />
                    Follow
                  </>
                )}
              </Button>
              <Button
                className="gap-1.5 text-xs"
                onClick={handleShareBattle}
                size="sm"
                variant="outline"
              >
                <Share2 className="size-3.5" />
                Share
              </Button>
            </div>
          </div>

          {/* Consolidated Arena Scoreboard & Side-by-Side Voting Box */}
          <Card className="border-primary/40 bg-card/90 shadow-xl overflow-hidden">
            {/* Header Scoreboard */}
            <div className="flex flex-wrap items-center justify-between border-b border-border/60 bg-muted/40 px-4 py-3 gap-2">
              <div className="flex items-center gap-2">
                <Trophy className="size-4.5 text-amber-400" />
                <div>
                  <span className="font-bold text-sm">Match Scoreboard</span>
                  <p className="text-[11px] text-muted-foreground">
                    Round {currentRound.number}{" "}
                    {currentRound.isTiebreaker ? "(Tiebreaker)" : ""} • Best of
                    3
                  </p>
                </div>
              </div>

              {/* Center Match Score Display */}
              <div className="flex items-center gap-2 rounded-lg border bg-background/80 px-3 py-1 shadow-sm text-xs">
                <span className="font-bold text-foreground truncate max-w-[80px]">
                  {artistA.name}
                </span>
                <span className="rounded bg-primary/20 px-2 py-0.5 font-mono text-sm font-black text-primary">
                  {artistA.roundsWon}
                </span>
                <span className="font-bold text-muted-foreground text-[10px]">
                  VS
                </span>
                <span className="rounded bg-secondary/20 px-2 py-0.5 font-mono text-sm font-black text-secondary-foreground">
                  {artistB.roundsWon}
                </span>
                <span className="font-bold text-foreground truncate max-w-[80px]">
                  {artistB.name}
                </span>
              </div>

              <Badge
                className="text-[11px]"
                variant={
                  currentRound.status === "voting" ? "default" : "secondary"
                }
              >
                {currentRound.status === "voting" ? "Voting Open" : "Turn Live"}
              </Badge>
            </div>

            {/* Side-by-side Artist Turn & Voting Strips (2 Columns on mobile & desktop) */}
            <CardContent className="p-3 sm:p-5 space-y-4">
              <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
                {battle.artists.map((artist) => {
                  const percent = votePercent(currentRound, artist.id),
                    isActive = !artist.isMuted;

                  return (
                    <div
                      className={`space-y-2 sm:space-y-3 rounded-xl border p-2.5 sm:p-4 transition-all ${
                        isActive
                          ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/30"
                          : "border-border/60 bg-background/50"
                      }`}
                      key={artist.id}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                        <button
                          className="flex items-center gap-2 min-w-0 text-left cursor-pointer transition-transform hover:scale-[1.02]"
                          onClick={() =>
                            setPreviewUser({
                              avatarUrl: artist.avatarUrl,
                              displayName: artist.name,
                              followersCount: 1450,
                              role: "Battle Contender",
                              username: artist.name
                                .toLowerCase()
                                .replaceAll(/\s+/g, ""),
                              verified: artist.verified,
                            })
                          }
                          type="button"
                        >
                          <Avatar className="size-8 sm:size-10 border shrink-0">
                            <AvatarImage src={artist.avatarUrl} />
                            <AvatarFallback className="text-xs">
                              {artist.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1">
                              <p className="font-bold text-xs sm:text-sm truncate">
                                {artist.name}
                              </p>
                              {artist.verified && (
                                <CheckCircle2 className="size-3 text-primary shrink-0" />
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {artist.roundsWon} Won
                            </p>
                          </div>
                        </button>

                        <Badge
                          className="text-[9px] sm:text-[10px] px-1.5 py-0 self-start sm:self-center shrink-0"
                          variant={isActive ? "default" : "outline"}
                        >
                          {isActive ? (
                            <>
                              <Mic className="mr-1 size-2.5" />
                              Turn
                            </>
                          ) : (
                            <>
                              <MicOff className="mr-1 size-2.5" />
                              Muted until turn
                            </>
                          )}
                        </Badge>
                      </div>

                      <div className="space-y-1 pt-0.5">
                        <div className="flex items-center justify-between text-[10px] sm:text-xs">
                          <span className="text-muted-foreground">Votes</span>
                          <span className="font-mono font-bold text-primary">
                            {percent}% (
                            {(
                              currentRound.voteTotals[artist.id] ?? 0
                            ).toLocaleString()}
                            )
                          </span>
                        </div>
                        <Progress className="h-1.5 sm:h-2" value={percent} />
                      </div>

                      <Button
                        className="w-full text-xs h-8 sm:h-9"
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
                        size="sm"
                      >
                        Vote {artist.name}
                      </Button>
                    </div>
                  );
                })}
              </div>

              {currentRound.winnerArtistId && (
                <WinnerBanner
                  artist={battle.artists.find(
                    (a) => a.id === currentRound.winnerArtistId
                  )}
                  isTie={currentRound.isTiebreaker}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </LiveTwitchShell>

      <UserProfilePreviewModal
        onClose={() => setPreviewUser(null)}
        open={Boolean(previewUser)}
        user={previewUser}
      />
    </LiveRoomAccessGuard>
  );
}
