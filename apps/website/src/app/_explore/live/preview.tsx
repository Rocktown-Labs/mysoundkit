"use client";
/* eslint-disable complexity, no-unused-vars, sort-vars, one-var, require-unicode-regexp */

import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  CalendarClock,
  CheckCircle2,
  Crown,
  Disc3,
  FolderKanban,
  Heart,
  ListMusic,
  Maximize,
  Mic,
  MicOff,
  Minimize,
  Music,
  Music2,
  Pause,
  Play,
  Plus,
  Radio,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  Swords,
  Trophy,
  Users,
  Video,
  Volume2,
} from "lucide-react";
import React, { useState } from "react";

import { BattleTimer } from "@/components/live/battle-timer";
import { LiveCreatorPanel } from "@/components/live/live-creator-panel";
import { LiveChatPanel } from "@/components/live/live-room-panels";
import { LiveTwitchShell } from "@/components/live/live-twitch-shell";
import { useBrowserFullscreen } from "@/components/live/use-browser-fullscreen";
import { AppImage } from "@/components/ui/app-image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_explore/live/preview")({
  component: LiveInteractivePreviewHub,
});

type PreviewMode = "battle" | "challenge" | "party" | "stream" | "video";
type Perspective = "artist_a" | "artist_b" | "fan";
type BattleState =
  | "between_rounds"
  | "booted"
  | "ended"
  | "live_round"
  | "lobby"
  | "recording_processing"
  | "replay_available"
  | "tiebreaker"
  | "transition"
  | "voting";
type StreamState =
  | "ended"
  | "live"
  | "reconnecting"
  | "recording_processing"
  | "replay_available"
  | "scheduled"
  | "waiting";

interface ChatItem {
  id: string;
  message: string;
  sentAt: string;
  userName: string;
}

function LiveInteractivePreviewHub() {
  const [battleState, setBattleState] = useState<BattleState>("live_round"),
    [challengePerspective, setChallengePerspective] = useState<
      "challenged" | "challenger"
    >("challenged"),
    [chatMessages, setChatMessages] = useState<ChatItem[]>([
      {
        id: "msg-1",
        message: "Welcome to the official SoundKit Live Arena! 🎛️",
        sentAt: new Date(Date.now() - 1000 * 120).toISOString(),
        userName: "SoundKitBot",
      },
      {
        id: "msg-2",
        message: "These 808s in Round 1 are insane 🔥🔥",
        sentAt: new Date(Date.now() - 1000 * 60).toISOString(),
        userName: "producer_jay",
      },
      {
        id: "msg-3",
        message: "Voted for Nova! Track 2 was clean.",
        sentAt: new Date(Date.now() - 1000 * 30).toISOString(),
        userName: "beatmaster99",
      },
    ]),
    [hasVoted, setHasVoted] = useState(false),
    [isPartyPlaying, setIsPartyPlaying] = useState(true),
    [mode, setMode] = useState<PreviewMode>("battle"),
    [perspective, setPerspective] = useState<Perspective>("artist_a"),
    [streamState, setStreamState] = useState<StreamState>("live"),
    [votes, setVotes] = useState({ artistA: 142, artistB: 189 }),
    handleSendChatMessage = (text: string) => {
      const newMsg = {
        id: `user-${Date.now()}`,
        message: text,
        sentAt: new Date().toISOString(),
        userName: perspective === "fan" ? "Fan (You)" : "Artist (You)",
      };
      setChatMessages((prev) => [...prev, newMsg]);
    },
    handleCastVote = (artist: "artistA" | "artistB") => {
      if (hasVoted) {
        return;
      }
      setVotes((prev) => ({
        ...prev,
        [artist]: prev[artist] + 1,
      }));
      setHasVoted(true);
      toast({
        description: "Your vote was counted in real time!",
        title: "Vote Recorded",
      });
    },
    handleResetVotes = () => {
      setVotes({ artistA: 0, artistB: 0 });
      setHasVoted(false);
    };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border/80 bg-background/95 p-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge className="font-mono text-[10px]" variant="outline">
              REALTIME MOCK ENVIRONMENT
            </Badge>
            <span className="font-bold text-sm">Live Experience Preview</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border bg-muted/40 p-1">
              <Button
                className="h-7 text-xs"
                onClick={() => setMode("battle")}
                size="sm"
                variant={mode === "battle" ? "default" : "ghost"}
              >
                <Swords className="mr-1 size-3.5" />
                Live Battle
              </Button>
              <Button
                className="h-7 text-xs"
                onClick={() => setMode("stream")}
                size="sm"
                variant={mode === "stream" ? "default" : "ghost"}
              >
                <Radio className="mr-1 size-3.5" />
                Creator Stream
              </Button>
              <Button
                className="h-7 text-xs"
                onClick={() => setMode("party")}
                size="sm"
                variant={mode === "party" ? "default" : "ghost"}
              >
                <Music className="mr-1 size-3.5" />
                Listening Party
              </Button>
              <Button
                className="h-7 text-xs"
                onClick={() => setMode("video")}
                size="sm"
                variant={mode === "video" ? "default" : "ghost"}
              >
                <Video className="mr-1 size-3.5" />
                Music Video
              </Button>
              <Button
                className="h-7 text-xs"
                onClick={() => setMode("challenge")}
                size="sm"
                variant={mode === "challenge" ? "default" : "ghost"}
              >
                <Trophy className="mr-1 size-3.5" />
                Battle Invite
              </Button>
            </div>

            <div className="flex items-center rounded-lg border bg-muted/40 p-1">
              <Button
                className="h-7 text-xs"
                onClick={() => setPerspective("artist_a")}
                size="sm"
                variant={perspective === "artist_a" ? "secondary" : "ghost"}
              >
                <Crown className="mr-1 size-3 text-amber-400" />
                Artist A View
              </Button>
              <Button
                className="h-7 text-xs"
                onClick={() => setPerspective("artist_b")}
                size="sm"
                variant={perspective === "artist_b" ? "secondary" : "ghost"}
              >
                <Crown className="mr-1 size-3 text-amber-400" />
                Artist B View
              </Button>
              <Button
                className="h-7 text-xs"
                onClick={() => setPerspective("fan")}
                size="sm"
                variant={perspective === "fan" ? "secondary" : "ghost"}
              >
                <Users className="mr-1 size-3 text-sky-400" />
                Fan View
              </Button>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-2 flex max-w-7xl flex-wrap items-center gap-2 border-t border-border/40 pt-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Scenario:</span>
          {mode === "battle" && (
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["lobby", "Waiting Room"],
                  ["live_round", "Artist A Turn"],
                  ["transition", "Turn Transition"],
                  ["voting", "Voting Active"],
                  ["booted", "Non-Voter Booted"],
                  ["between_rounds", "Between Rounds"],
                  ["tiebreaker", "Tiebreaker Round"],
                  ["ended", "Match Winner"],
                  ["recording_processing", "Recording Processing"],
                  ["replay_available", "Replay Available"],
                ] as const
              ).map(([state, label]) => (
                <button
                  className={`rounded-full px-2.5 py-0.5 font-medium transition-colors ${
                    battleState === state
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80"
                  }`}
                  key={state}
                  onClick={() => setBattleState(state)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {mode === "stream" && (
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["waiting", "Waiting for OBS"],
                  ["live", "OBS Connected / Live"],
                  ["reconnecting", "Reconnecting"],
                  ["ended", "Ended"],
                  ["recording_processing", "Replay Processing"],
                  ["replay_available", "Replay Available"],
                ] as const
              ).map(([state, label]) => (
                <button
                  className={`rounded-full px-2.5 py-0.5 font-medium ${
                    streamState === state
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                  key={state}
                  onClick={() => setStreamState(state)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {mode === "challenge" && (
            <div className="flex flex-wrap gap-1.5">
              <button
                className={`rounded-full px-2.5 py-0.5 font-medium ${
                  challengePerspective === "challenger"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
                onClick={() => setChallengePerspective("challenger")}
                type="button"
              >
                Challenger Perspective (Sent Request)
              </button>
              <button
                className={`rounded-full px-2.5 py-0.5 font-medium ${
                  challengePerspective === "challenged"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
                onClick={() => setChallengePerspective("challenged")}
                type="button"
              >
                Opponent Perspective (Accept / Decline)
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="w-full">
        {mode === "battle" && (
          <BattlePreviewSection
            battleState={battleState}
            chatMessages={chatMessages}
            hasVoted={hasVoted}
            onCastVote={handleCastVote}
            onResetVotes={handleResetVotes}
            onSendMessage={handleSendChatMessage}
            onSetBattleState={setBattleState}
            perspective={perspective}
            votes={votes}
          />
        )}

        {mode === "stream" && (
          <StreamPreviewSection
            chatMessages={chatMessages}
            onSendMessage={handleSendChatMessage}
            streamState={streamState}
          />
        )}

        {mode === "party" && (
          <PartyPreviewSection
            chatMessages={chatMessages}
            isPlaying={isPartyPlaying}
            onSendMessage={handleSendChatMessage}
            onTogglePlaying={() => setIsPartyPlaying((p) => !p)}
            perspective={perspective}
          />
        )}

        {mode === "video" && (
          <VideoPreviewSection
            chatMessages={chatMessages}
            onSendMessage={handleSendChatMessage}
          />
        )}

        {mode === "challenge" && (
          <ChallengePreviewSection
            challengePerspective={challengePerspective}
            onAccept={() => setMode("battle")}
          />
        )}
      </main>
    </div>
  );
}

function BattlePreviewSection({
  battleState,
  chatMessages,
  hasVoted,
  onCastVote,
  onResetVotes,
  onSendMessage,
  onSetBattleState,
  perspective,
  votes,
}: {
  battleState: BattleState;
  chatMessages: ChatItem[];
  hasVoted: boolean;
  onCastVote: (artist: "artistA" | "artistB") => void;
  onResetVotes?: () => void;
  onSendMessage: (msg: string) => void;
  onSetBattleState: (state: BattleState) => void;
  perspective: Perspective;
  votes: { artistA: number; artistB: number };
}) {
  const [isChatOpen, setIsChatOpen] = useState(true),
    {
      containerRef: battleVideoRef,
      isFullscreen,
      toggleFullscreen,
    } = useBrowserFullscreen(),
    [previewPhaseEndsAt] = useState(() => Date.now() + 180_000),
    [currentTurn, setCurrentTurn] = useState<"artistA" | "artistB">("artistA"),
    [roundNumber, setRoundNumber] = useState(1),
    [scores, setScores] = useState({ artistA: 1, artistB: 1 }),
    [artistASelectedTrack, setArtistASelectedTrack] = useState("808 Massacre"),
    [artistBSelectedTrack, setArtistBSelectedTrack] =
      useState("Boom Bap Eclipse"),
    [activeKitTab, setActiveKitTab] = useState<"artistA" | "artistB">(
      "artistA"
    ),
    artistAKitTracks = [
      {
        bpm: 140,
        duration: "3:12",
        id: "a1",
        key: "F#m",
        title: "808 Massacre",
      },
      {
        bpm: 144,
        duration: "3:05",
        id: "a2",
        key: "Cm",
        title: "Dungeon Synth Heat",
      },
      {
        bpm: 138,
        duration: "3:20",
        id: "a3",
        key: "G#m",
        title: "Trap Symphony IV",
      },
      {
        bpm: 142,
        duration: "2:58",
        id: "a4",
        key: "Dm",
        title: "Phantom Bass 99",
      },
    ],
    artistBKitTracks = [
      {
        bpm: 92,
        duration: "3:10",
        id: "b1",
        key: "Am",
        title: "Boom Bap Eclipse",
      },
      {
        bpm: 88,
        duration: "3:18",
        id: "b2",
        key: "Em",
        title: "Vinyl Dust Crates",
      },
      {
        bpm: 94,
        duration: "3:02",
        id: "b3",
        key: "C#m",
        title: "Liberty Bell Rhythm",
      },
      {
        bpm: 90,
        duration: "3:25",
        id: "b4",
        key: "Fm",
        title: "SP-1200 Soul Chop",
      },
    ],
    totalVotes = votes.artistA + votes.artistB,
    artistAPercent =
      totalVotes > 0 ? Math.round((votes.artistA / totalVotes) * 100) : 50,
    artistBPercent = 100 - artistAPercent,
    roundLabel = (() => {
      if (battleState === "lobby") {
        return "LOBBY WAITING ROOM";
      }
      if (battleState === "tiebreaker") {
        return "TIEBREAKER ROUND";
      }
      if (battleState === "transition") {
        return "SHORT TRANSITION";
      }
      if (battleState === "between_rounds") {
        return "BETWEEN ROUNDS — WAITING ROOM ADMISSION";
      }
      if (battleState === "booted") {
        return "VOTING CLOSED — NON-VOTER REMOVED";
      }
      if (battleState === "recording_processing") {
        return "RECORDING PROCESSING";
      }
      if (battleState === "replay_available") {
        return "REPLAY AVAILABLE";
      }
      if (battleState === "voting") {
        return `ROUND ${roundNumber} VOTING (2:00)`;
      }
      if (battleState === "ended") {
        return "MATCH CONCLUDED";
      }
      return `ROUND ${roundNumber} LIVE (3:00 Turn)`;
    })(),
    getVoteLabel = (artistName: string) => {
      if (hasVoted) {
        return "Vote Recorded";
      }
      if (battleState === "voting") {
        return `Vote ${artistName}`;
      }
      return "Voting Opens After Turn 2";
    },
    handleNextTurn = () => {
      const nextTurn = currentTurn === "artistA" ? "artistB" : "artistA";
      setCurrentTurn(nextTurn);
      toast({
        description: `Active stage audio passed to ${
          nextTurn === "artistA" ? "Metro K" : "Nova Beats"
        } (3:00 min timer running)`,
        title: "Stage Turn Switched",
      });
    },
    handleAdvanceRound = () => {
      const winningArtist =
        votes.artistA >= votes.artistB ? "artistA" : "artistB";
      const nextScores = {
        ...scores,
        [winningArtist]: scores[winningArtist] + 1,
      };
      setScores(nextScores);
      onResetVotes?.();

      if (nextScores.artistA >= 2 || nextScores.artistB >= 2) {
        onSetBattleState("ended");
        toast({
          description: `Match Won! ${
            nextScores.artistA >= 2 ? "Metro K" : "Nova Beats"
          } is crowned champion with 2 round victories!`,
          title: "Match Concluded",
        });
      } else {
        const nextRound = roundNumber + 1;
        setRoundNumber(nextRound);
        onSetBattleState("live_round");
        toast({
          description: `Round ${roundNumber} awarded to ${
            winningArtist === "artistA" ? "Metro K" : "Nova Beats"
          }! Admitted lobby waiting room viewers into Round ${nextRound}.`,
          title: "Round Advanced",
        });
      }
    },
    handleResetMatch = () => {
      setScores({ artistA: 0, artistB: 0 });
      onResetVotes?.();
      setRoundNumber(1);
      setCurrentTurn("artistA");
      onSetBattleState("live_round");
      toast({
        description:
          "Arena match score reset to 0 - 0. Fresh round votes ready.",
        title: "Match Reset",
      });
    },
    chatPanel = (
      <LiveChatPanel
        disabled={false}
        extraHeaderAction={
          <Badge className="font-mono text-[10px]" variant="outline">
            BOT ON
          </Badge>
        }
        fillHeight
        messages={chatMessages}
        onCollapse={() => setIsChatOpen(false)}
        onSend={onSendMessage}
        title="Arena Live Chat"
      />
    ),
    videoNode = (
      <div
        className="group relative aspect-video w-full overflow-hidden bg-black"
        ref={battleVideoRef}
      >
        <AppImage
          alt="Battle Stage"
          className="size-full object-cover opacity-75"
          height={720}
          src="/music-battle-live-performance-video.jpg"
          width={1280}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-black/40" />

        {/* Top Floating Match Badge Bar */}
        <div className="absolute left-4 top-4 right-4 flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="font-bold" variant="destructive">
              {roundLabel}
            </Badge>
            <Badge
              className="bg-black/60 backdrop-blur-md text-white border-white/20"
              variant="outline"
            >
              Format: 2x 3min Turns + 2min Vote
            </Badge>
            {perspective !== "fan" && (
              <Badge className="bg-primary/80 font-semibold text-primary-foreground">
                PERFORMER CONTROLS ON
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/60 px-3 py-1 font-mono text-xs text-white backdrop-blur-md">
              <Radio className="size-3 text-destructive animate-pulse" />
              <span>1,842 Viewers</span>
            </div>
            <BattleTimer phaseEndsAt={previewPhaseEndsAt} label={roundLabel} />
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

        {/* Lobby Waiting Room Overlay if lobby state */}
        {battleState === "lobby" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-6 text-center text-white backdrop-blur-sm">
            <CalendarClock className="mb-3 size-12 text-primary animate-pulse" />
            <h3 className="text-2xl font-black">
              Arena Lobby &amp; Waiting Room
            </h3>
            <p className="mt-1 text-sm text-white/70 max-w-md">
              Battle starting in 0:45. Viewers admitted at start of each round.
              Late arrivals will stream in lobby until next round.
            </p>
            <Button
              onClick={() => onSetBattleState("live_round")}
              className="mt-4 gap-2 bg-primary font-bold"
            >
              <Swords className="size-4" />
              Enter Arena (Start Round 1)
            </Button>
          </div>
        ) : (
          /* Center Stage Artists Visual */
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
            <div className="grid w-full max-w-lg grid-cols-[1fr_auto_1fr] items-center gap-4 text-center">
              <div className="flex flex-col items-center space-y-1">
                <Avatar
                  className={`size-16 sm:size-20 border-2 transition-all duration-300 shadow-2xl ${
                    currentTurn === "artistA"
                      ? "border-primary ring-4 ring-primary/40 scale-105"
                      : "border-border/60 opacity-80"
                  }`}
                >
                  <AvatarImage src="/soundkit-default-avatar.svg" />
                  <AvatarFallback className="font-bold">MK</AvatarFallback>
                </Avatar>
                <p className="font-bold text-sm sm:text-base text-white">
                  Metro K
                </p>
                <span className="text-xs text-amber-400 font-bold">
                  {scores.artistA} Won
                </span>
              </div>

              <div className="flex flex-col items-center gap-1">
                <div className="rounded-full bg-destructive p-2.5 sm:p-3 text-white shadow-xl">
                  <Swords className="size-5 sm:size-7" />
                </div>
                <div className="rounded-full bg-black/80 border border-white/20 px-2.5 py-0.5 font-mono text-xs font-black text-white">
                  {scores.artistA} - {scores.artistB}
                </div>
              </div>

              <div className="flex flex-col items-center space-y-1">
                <Avatar
                  className={`size-16 sm:size-20 border-2 transition-all duration-300 shadow-2xl ${
                    currentTurn === "artistB"
                      ? "border-secondary ring-4 ring-secondary/40 scale-105"
                      : "border-border/60 opacity-80"
                  }`}
                >
                  <AvatarImage src="/soundkit-default-avatar.svg" />
                  <AvatarFallback className="font-bold">NV</AvatarFallback>
                </Avatar>
                <p className="font-bold text-sm sm:text-base text-white">
                  Nova Beats
                </p>
                <span className="text-xs text-amber-400 font-bold">
                  {scores.artistB} Won
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Stage Banner */}
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between rounded-xl border border-white/10 bg-black/75 px-4 py-2.5 backdrop-blur-md">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
              {battleState === "voting"
                ? "AUDIENCE VOTING (2:00 Window)"
                : `Now Performing — ${currentTurn === "artistA" ? "Metro K" : "Nova Beats"} (3:00 Turn)`}
            </p>
            <p className="truncate font-semibold text-white text-sm">
              {currentTurn === "artistA"
                ? `${artistASelectedTrack} — Metro K`
                : `${artistBSelectedTrack} — Nova Beats`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              className="bg-primary/20 text-primary border-primary/40 font-semibold"
              variant="outline"
            >
              <Mic className="mr-1 size-3" />
              {currentTurn === "artistA"
                ? "Metro K Mic On (2:18 left)"
                : "Nova Beats Mic On (2:45 left)"}
            </Badge>
          </div>
        </div>
      </div>
    );

  return (
    <LiveTwitchShell
      chatPanel={chatPanel}
      defaultChatOpen={true}
      isChatOpen={isChatOpen}
      onChatOpenChange={setIsChatOpen}
      videoNode={videoNode}
    >
      <div className="space-y-6 pt-4">
        {/* Consolidated Scoreboard, Turns, & Voting Box */}
        <Card className="border-primary/40 bg-card/90 shadow-xl overflow-hidden">
          {/* Header Scoreboard */}
          <div className="flex flex-wrap items-center justify-between border-b border-border/60 bg-muted/40 px-5 py-3.5 gap-3">
            <div className="flex items-center gap-2.5">
              <Trophy className="size-5 text-amber-400" />
              <div>
                <span className="font-bold text-sm">
                  Match Arena Scoreboard
                </span>
                <p className="text-xs text-muted-foreground">
                  Round {roundNumber} of 3 •{" "}
                  {battleState === "voting"
                    ? "Audience Voting Open (2:00 min)"
                    : "Live Performance (3:00 min turn)"}
                </p>
              </div>
            </div>

            {/* Center Scoreboard Display */}
            <div className="flex items-center gap-3 rounded-lg border bg-background/80 px-4 py-1.5 shadow-sm">
              <span className="text-xs font-bold text-foreground">Metro K</span>
              <span className="rounded-md bg-primary/20 px-2.5 py-0.5 font-mono text-base font-black text-primary">
                {scores.artistA}
              </span>
              <span className="text-xs font-bold text-muted-foreground">
                VS
              </span>
              <span className="rounded-md bg-secondary/20 px-2.5 py-0.5 font-mono text-base font-black text-secondary-foreground">
                {scores.artistB}
              </span>
              <span className="text-xs font-bold text-foreground">
                Nova Beats
              </span>
            </div>

            <Badge
              className="text-xs"
              variant={battleState === "voting" ? "default" : "secondary"}
            >
              {battleState === "voting"
                ? "Voting Active (2:00)"
                : "Round in Progress"}
            </Badge>
          </div>

          {/* Integrated Side-by-Side Turn & Voting Controls */}
          <CardContent className="p-5 space-y-5">
            {battleState === "ended" ? (
              <div className="rounded-2xl border-2 border-amber-500/40 bg-gradient-to-b from-amber-500/10 via-background to-background p-6 text-center space-y-4 shadow-2xl">
                <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 ring-4 ring-amber-500/30">
                  <Trophy className="size-8" />
                </div>
                <div>
                  <Badge className="bg-amber-500 text-black font-bold uppercase tracking-wider mb-2">
                    SoundKit Battle Champion
                  </Badge>
                  <h3 className="text-2xl font-black text-foreground">
                    {scores.artistA > scores.artistB ? "Metro K" : "Nova Beats"}{" "}
                    Claims Victory!
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Final Score: {scores.artistA} - {scores.artistB} in Best of
                    3 Battle League
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <Button onClick={handleResetMatch} className="gap-2">
                    <RotateCcw className="size-4" />
                    Restart Match Simulation
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {/* Metro K Strip */}
                <div
                  className={`space-y-3 rounded-xl border p-4 transition-all ${
                    currentTurn === "artistA"
                      ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/30"
                      : "border-border/60 bg-background/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-11 border">
                        <AvatarImage src="/soundkit-default-avatar.svg" />
                        <AvatarFallback>MK</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-sm">Metro K</p>
                          <CheckCircle2 className="size-3.5 text-primary" />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          ATL Trap Producer • {scores.artistA} Won
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={
                        currentTurn === "artistA" ? "default" : "outline"
                      }
                    >
                      {currentTurn === "artistA"
                        ? "Live On Stage (3:00)"
                        : "Muted until turn"}
                    </Badge>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        Live Round Votes
                      </span>
                      <span className="font-mono font-bold text-primary">
                        {artistAPercent}% ({votes.artistA.toLocaleString()}{" "}
                        votes)
                      </span>
                    </div>
                    <Progress className="h-2" value={artistAPercent} />
                  </div>

                  <Button
                    className="w-full"
                    disabled={hasVoted || battleState !== "voting"}
                    onClick={() => onCastVote("artistA")}
                    size="sm"
                    variant="default"
                  >
                    {getVoteLabel("Metro K")}
                  </Button>
                </div>

                {/* Nova Beats Strip */}
                <div
                  className={`space-y-3 rounded-xl border p-4 transition-all ${
                    currentTurn === "artistB"
                      ? "border-secondary bg-secondary/10 shadow-sm ring-1 ring-secondary/30"
                      : "border-border/60 bg-background/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-11 border">
                        <AvatarImage src="/soundkit-default-avatar.svg" />
                        <AvatarFallback>NV</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-sm">Nova Beats</p>
                          <CheckCircle2 className="size-3.5 text-primary" />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Philly Boom Bap • {scores.artistB} Won
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={
                        currentTurn === "artistB" ? "default" : "outline"
                      }
                    >
                      {currentTurn === "artistB"
                        ? "Live On Stage (3:00)"
                        : "Muted until turn"}
                    </Badge>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        Live Round Votes
                      </span>
                      <span className="font-mono font-bold text-primary">
                        {artistBPercent}% ({votes.artistB.toLocaleString()}{" "}
                        votes)
                      </span>
                    </div>
                    <Progress className="h-2" value={artistBPercent} />
                  </div>

                  <Button
                    className="w-full"
                    disabled={hasVoted || battleState !== "voting"}
                    onClick={() => onCastVote("artistB")}
                    size="sm"
                    variant="default"
                  >
                    {getVoteLabel("Nova Beats")}
                  </Button>
                </div>
              </div>
            )}

            {/* Interactive Battle Progression Bar (Preview Simulator) */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-border/80 bg-muted/20 p-3 text-xs">
              <span className="font-bold text-muted-foreground">
                Battle Simulation Controls:
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={handleNextTurn} size="sm" variant="outline">
                  <RotateCcw className="mr-1.5 size-3.5" />
                  Switch 3-Min Turn
                </Button>
                <Button
                  onClick={() =>
                    onSetBattleState(
                      battleState === "voting" ? "live_round" : "voting"
                    )
                  }
                  size="sm"
                  variant={battleState === "voting" ? "secondary" : "outline"}
                >
                  <Trophy className="mr-1.5 size-3.5 text-amber-400" />
                  {battleState === "voting"
                    ? "Close Voting"
                    : "Open 2-Min Voting"}
                </Button>
                <Button
                  className="bg-primary/90 hover:bg-primary"
                  onClick={handleAdvanceRound}
                  size="sm"
                >
                  <ArrowRight className="mr-1.5 size-3.5" />
                  Advance Round &amp; Admit Lobby
                </Button>
                <Button onClick={handleResetMatch} size="sm" variant="ghost">
                  Reset Match
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Battle Kits: Kit vs Kit Showcase & Artist Track Selection */}
        <Card className="border-border/60 bg-card/80 shadow-lg">
          <CardHeader className="border-b border-border/40 pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2 font-[family-name:var(--font-playfair)]">
                  <FolderKanban className="size-5 text-primary" />
                  Battle Kits (Kit vs Kit Showcase)
                </CardTitle>
                <CardDescription className="text-xs">
                  Kit vs Kit verified audio tracklists for this match. Artists
                  select their weapon for each round.
                </CardDescription>
              </div>
              <div className="flex items-center gap-1.5 bg-muted/50 p-1 rounded-lg border">
                <button
                  type="button"
                  onClick={() => setActiveKitTab("artistA")}
                  className={cn(
                    "px-3 py-1 text-xs font-bold rounded-md transition cursor-pointer",
                    activeKitTab === "artistA"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Metro K Kit
                </button>
                <button
                  type="button"
                  onClick={() => setActiveKitTab("artistB")}
                  className={cn(
                    "px-3 py-1 text-xs font-bold rounded-md transition cursor-pointer",
                    activeKitTab === "artistB"
                      ? "bg-secondary text-secondary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Nova Beats Kit
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4 space-y-4">
            {activeKitTab === "artistA" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-primary/10 border border-primary/30 p-3 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="size-12 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-black">
                      808
                    </div>
                    <div>
                      <p className="font-bold text-sm">Atlanta 808 Heat Kit</p>
                      <p className="text-xs text-muted-foreground">
                        By Metro K • 12 Stems &amp; Master Tracks • Trap / Hard
                        808
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-primary/20 text-primary border-primary/40">
                    Contender A Kit
                  </Badge>
                </div>

                <div className="grid gap-2">
                  {artistAKitTracks.map((track) => {
                    const isCurrent = artistASelectedTrack === track.title;
                    return (
                      <div
                        key={track.id}
                        className={cn(
                          "flex items-center justify-between p-2.5 rounded-xl border transition",
                          isCurrent
                            ? "bg-primary/15 border-primary/50 shadow-sm"
                            : "bg-muted/30 border-border/40 hover:bg-muted/50"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Music
                            className={cn(
                              "size-4",
                              isCurrent
                                ? "text-primary font-bold"
                                : "text-muted-foreground"
                            )}
                          />
                          <div>
                            <p className="font-bold text-xs">{track.title}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {track.bpm} BPM • Key: {track.key} •{" "}
                              {track.duration}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {isCurrent ? (
                            <Badge className="bg-primary text-primary-foreground text-[10px]">
                              Active in Round
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px]"
                              onClick={() => {
                                setArtistASelectedTrack(track.title);
                                toast({
                                  description: `Metro K queued "${track.title}" for next turn.`,
                                  title: "Track Queued",
                                });
                              }}
                            >
                              Queue Next
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-secondary/10 border border-secondary/30 p-3 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="size-12 rounded-lg bg-secondary/20 flex items-center justify-center text-secondary-foreground font-black">
                      SP
                    </div>
                    <div>
                      <p className="font-bold text-sm">
                        Philly Boom Bap Weaponry
                      </p>
                      <p className="text-xs text-muted-foreground">
                        By Nova Beats • 10 Stems &amp; Master Beats • Gritty
                        Soul / Boom Bap
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-secondary/20 text-secondary-foreground border-secondary/40">
                    Contender B Kit
                  </Badge>
                </div>

                <div className="grid gap-2">
                  {artistBKitTracks.map((track) => {
                    const isCurrent = artistBSelectedTrack === track.title;
                    return (
                      <div
                        key={track.id}
                        className={cn(
                          "flex items-center justify-between p-2.5 rounded-xl border transition",
                          isCurrent
                            ? "bg-secondary/15 border-secondary/50 shadow-sm"
                            : "bg-muted/30 border-border/40 hover:bg-muted/50"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Music
                            className={cn(
                              "size-4",
                              isCurrent
                                ? "text-secondary-foreground font-bold"
                                : "text-muted-foreground"
                            )}
                          />
                          <div>
                            <p className="font-bold text-xs">{track.title}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {track.bpm} BPM • Key: {track.key} •{" "}
                              {track.duration}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {isCurrent ? (
                            <Badge className="bg-secondary text-secondary-foreground text-[10px]">
                              Active in Round
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px]"
                              onClick={() => {
                                setArtistBSelectedTrack(track.title);
                                toast({
                                  description: `Nova Beats queued "${track.title}" for next turn.`,
                                  title: "Track Queued",
                                });
                              }}
                            >
                              Queue Next
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </LiveTwitchShell>
  );
}

function StreamPreviewSection({
  chatMessages,
  onSendMessage,
  streamState,
}: {
  chatMessages: ChatItem[];
  onSendMessage: (msg: string) => void;
  streamState: StreamState;
}) {
  const [isChatOpen, setIsChatOpen] = useState(true),
    {
      containerRef: streamVideoRef,
      isFullscreen,
      toggleFullscreen,
    } = useBrowserFullscreen(),
    chatPanel = (
      <LiveChatPanel
        disabled={false}
        fillHeight
        messages={chatMessages}
        onCollapse={() => setIsChatOpen(false)}
        onSend={onSendMessage}
        title="Stream Chat"
      />
    ),
    videoNode = (
      <div
        className="group relative aspect-video w-full bg-black"
        ref={streamVideoRef}
      >
        {streamState === "live" ? (
          <>
            <AppImage
              alt="Producer Stream"
              className="size-full object-cover"
              height={720}
              src="/diverse-producers-in-studio.png"
              width={1280}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
          </>
        ) : (
          <div className="flex size-full flex-col items-center justify-center bg-black/90 p-6 text-center text-white">
            <CalendarClock className="mb-3 size-12 text-primary animate-pulse" />
            <p className="font-bold text-xl">Broadcast Scheduled</p>
            <p className="mt-1 text-sm text-white/70">
              Starts Tonight at 8:00 PM EST
            </p>
            <p className="mt-3 text-xs text-white/50">
              Waiting for encoder signal from OBS...
            </p>
          </div>
        )}

        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          <Badge variant={streamState === "live" ? "destructive" : "secondary"}>
            {streamState === "live" ? "LIVE" : "SCHEDULED"}
          </Badge>
          <Badge
            className="bg-black/60 backdrop-blur-md text-white border-white/20"
            variant="outline"
          >
            OBS 1080p60
          </Badge>
          <Badge
            className="bg-black/60 backdrop-blur-md text-white border-white/20"
            variant="outline"
          >
            Hip-Hop / Beatmaking
          </Badge>
        </div>

        <div className="absolute right-4 bottom-4">
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
    );

  return (
    <LiveTwitchShell
      chatPanel={chatPanel}
      defaultChatOpen={true}
      isChatOpen={isChatOpen}
      onChatOpenChange={setIsChatOpen}
      videoNode={videoNode}
    >
      <LiveCreatorPanel
        creator={{
          displayName: "K-Sound Productions",
          followersCount: 4200,
          username: "ksound",
        }}
        genre="Hip Hop / R&B"
        isLive={streamState === "live"}
        statusLabel="OBS HD Stream"
        title="Cookup Session: Cooking 808s and Melodies from Scratch"
        viewerCount={streamState === "live" ? 920 : 0}
      />
    </LiveTwitchShell>
  );
}

const partyAlbumTracks = [
  {
    artist: "Aura Sound Lab",
    duration: "3:24",
    id: "t1",
    title: "Starlight Drive",
  },
  {
    artist: "Aura Sound Lab",
    duration: "4:02",
    id: "t2",
    title: "Midnight Echoes",
  },
  {
    artist: "Aura Sound Lab",
    duration: "3:45",
    id: "t3",
    title: "Neon Highway",
  },
  {
    artist: "Aura Sound Lab",
    duration: "4:18",
    id: "t4",
    title: "Velvet Skyline",
  },
  {
    artist: "Aura Sound Lab",
    duration: "2:58",
    id: "t5",
    title: "After Hours (Outro)",
  },
];

function PartyPreviewSection({
  chatMessages,
  isPlaying,
  onSendMessage,
  onTogglePlaying,
  perspective,
}: {
  chatMessages: ChatItem[];
  isPlaying: boolean;
  onSendMessage: (msg: string) => void;
  onTogglePlaying: () => void;
  perspective: Perspective;
}) {
  const [isChatOpen, setIsChatOpen] = useState(true),
    {
      containerRef: partyVideoRef,
      isFullscreen,
      toggleFullscreen,
    } = useBrowserFullscreen(),
    [isLiked, setIsLiked] = useState(false),
    [isSaved, setIsSaved] = useState(false),
    [savedTrackIds, setSavedTrackIds] = useState<Set<string>>(new Set()),
    [currentTrackIndex, setCurrentTrackIndex] = useState(2),
    activeTrack = partyAlbumTracks[currentTrackIndex],
    handleToggleSaveTrack = (trackId: string, trackTitle: string) => {
      setSavedTrackIds((prev) => {
        const next = new Set(prev);
        if (next.has(trackId)) {
          next.delete(trackId);
          toast({
            description: `"${trackTitle}" removed from your saved tracks.`,
            title: "Removed from Library",
          });
        } else {
          next.add(trackId);
          toast({
            description: `"${trackTitle}" saved to your music library!`,
            title: "Track Saved",
          });
        }
        return next;
      });
    },
    handleReplaySong = (index = currentTrackIndex) => {
      setCurrentTrackIndex(index);
      toast({
        description: `Restarted "${partyAlbumTracks[index].title}" for everyone in the listening party.`,
        title: "Replaying Track",
      });
    },
    chatPanel = (
      <LiveChatPanel
        disabled={false}
        fillHeight
        messages={chatMessages}
        onCollapse={() => setIsChatOpen(false)}
        onSend={onSendMessage}
        title="Party Chat"
      />
    ),
    videoNode = (
      <div
        className="group relative min-h-[560px] md:min-h-[600px] w-full overflow-hidden bg-zinc-950 select-none rounded-2xl border border-white/10 shadow-2xl flex flex-col justify-between"
        ref={partyVideoRef}
      >
        {/* Ambient Blur Background */}
        <AppImage
          alt="Album Background"
          className="size-full object-cover opacity-25 blur-3xl transition-all duration-700 scale-110 absolute inset-0 pointer-events-none"
          height={720}
          src="/night-music-album-cover.webp"
          width={1280}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/85 to-black/60 pointer-events-none" />

        {/* Top Header Strip */}
        <div className="relative z-20 flex items-center justify-between p-4 pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="font-bold bg-primary text-primary-foreground flex items-center gap-1.5 shadow-lg">
              <Disc3 className="size-3.5 animate-spin" />
              LISTENING PARTY
            </Badge>
            <Badge
              className="bg-black/60 backdrop-blur-md text-white border-white/20 hidden sm:inline-flex"
              variant="outline"
            >
              Synced Audio Stream
            </Badge>
            {perspective === "fan" ? (
              <Badge className="bg-white/10 font-semibold text-white border-white/20">
                FAN MODE: LIVE LISTENER
              </Badge>
            ) : (
              <Badge className="bg-primary/80 font-semibold text-primary-foreground">
                HOST MODE: FULL CONTROL
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/60 px-3 py-1 font-mono text-xs text-white backdrop-blur-md">
              <Radio className="size-3 text-destructive animate-pulse" />
              <span>1,340 Listeners</span>
            </div>
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

        {/* Main Stage Grid: Large Album Cover on Left + Player Header & Full Tracklist on Right */}
        <div className="relative z-10 flex-1 p-4 sm:p-6 pt-2">
          <div className="grid size-full grid-cols-1 md:grid-cols-12 gap-6 items-start">
            {/* Left Side: Prominent Album Cover Art and Album Actions (5 cols) */}
            <div className="md:col-span-5 flex flex-col items-center justify-center text-center p-2">
              <div className="relative group/art">
                <div className="relative size-44 sm:size-56 md:size-64 overflow-hidden rounded-2xl border-2 border-white/20 shadow-2xl transition-transform duration-300 group-hover/art:scale-105">
                  <AppImage
                    alt="Midnight Reverie Album Art"
                    className="size-full object-cover"
                    height={256}
                    src="/night-music-album-cover.webp"
                    width={256}
                  />
                  {isPlaying && (
                    <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 shadow-xl backdrop-blur-md">
                      <Volume2 className="size-3.5 text-primary-foreground animate-bounce" />
                      <span className="font-mono text-[10px] font-bold text-primary-foreground">
                        LIVE
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <h2 className="mt-4 font-bold text-lg sm:text-xl text-white drop-shadow-md truncate max-w-[320px]">
                Midnight Reverie (Deluxe Edition)
              </h2>
              <p className="text-xs text-primary font-semibold truncate max-w-[280px] mt-0.5">
                By Aura Sound Lab • Worldwide Premiere
              </p>

              {/* Action Strip for Album & Fan Support */}
              <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className={cn(
                    "h-8 text-xs px-3 gap-1.5 backdrop-blur-md border-white/20 text-white",
                    isSaved
                      ? "bg-primary text-primary-foreground"
                      : "bg-black/40 hover:bg-white/20"
                  )}
                  onClick={() => {
                    setIsSaved((s) => !s);
                    toast({
                      description: isSaved
                        ? "Album removed from saved library."
                        : "Midnight Reverie saved to your music library!",
                      title: isSaved ? "Album Removed" : "Album Saved",
                    });
                  }}
                >
                  {isSaved ? (
                    <BookmarkCheck className="size-3.5" />
                  ) : (
                    <Bookmark className="size-3.5" />
                  )}
                  {isSaved ? "Album Saved" : "Save Album"}
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-xs px-3 gap-1.5 bg-primary text-primary-foreground shadow-sm font-bold"
                  onClick={() => {
                    toast({
                      description:
                        "Opened checkout for Midnight Reverie ($9.99)",
                      title: "Buy Full Album",
                    });
                  }}
                >
                  <ShoppingBag className="size-3.5" />
                  Buy Full Album ($9.99)
                </Button>
              </div>
            </div>

            {/* Right Side: Player Header directly on Top + Full Synced Tracklist below (7 cols) */}
            <div className="md:col-span-7 flex flex-col h-full overflow-hidden rounded-2xl border border-white/15 bg-black/70 backdrop-blur-xl shadow-2xl">
              {/* Player Header directly above the Tracklist */}
              <div className="p-3.5 sm:p-4 border-b border-white/10 bg-white/[0.03] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-primary/20 text-primary border-primary/40 text-[10px] font-bold">
                      <Music2 className="size-3 mr-1" />
                      SYNCHRONIZED AUDIO
                    </Badge>
                    <span className="text-[10px] text-white/50 font-mono hidden sm:inline">
                      Lossless 48kHz
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-white/60">
                    Host: @aurasound
                  </span>
                </div>

                {/* Player Controls Bar */}
                <div className="flex items-center justify-between gap-3 bg-black/60 border border-white/10 p-2.5 rounded-xl">
                  <div className="flex items-center gap-3 min-w-0">
                    <Button
                      className="size-9 rounded-full bg-primary text-primary-foreground hover:scale-105 transition shrink-0 shadow-md"
                      onClick={onTogglePlaying}
                      size="icon"
                      variant="default"
                    >
                      {isPlaying ? (
                        <Pause className="size-4 fill-current" />
                      ) : (
                        <Play className="size-4 fill-current translate-x-0.5" />
                      )}
                    </Button>
                    <div className="min-w-0">
                      <p className="font-bold text-xs sm:text-sm text-white truncate max-w-[200px] sm:max-w-[260px]">
                        {activeTrack.title}
                      </p>
                      <p className="text-[10px] text-white/60 truncate">
                        {activeTrack.artist} • Track {currentTrackIndex + 1} of{" "}
                        {partyAlbumTracks.length}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {perspective === "fan" ? (
                      <Button
                        className={cn(
                          "size-7 rounded-full text-white/70 hover:text-white hover:bg-white/20",
                          savedTrackIds.has(activeTrack.id) && "text-primary"
                        )}
                        onClick={() =>
                          handleToggleSaveTrack(
                            activeTrack.id,
                            activeTrack.title
                          )
                        }
                        size="icon"
                        title={
                          savedTrackIds.has(activeTrack.id)
                            ? "Saved to Library"
                            : "Save Track to Library"
                        }
                        variant="ghost"
                      >
                        {savedTrackIds.has(activeTrack.id) ? (
                          <BookmarkCheck className="size-3.5 text-primary" />
                        ) : (
                          <Plus className="size-3.5" />
                        )}
                      </Button>
                    ) : (
                      <Button
                        className="size-7 rounded-full text-white/70 hover:text-white hover:bg-white/20"
                        onClick={() => handleReplaySong(currentTrackIndex)}
                        size="icon"
                        title="Replay Current Track (Host Control)"
                        variant="ghost"
                      >
                        <RotateCcw className="size-3.5" />
                      </Button>
                    )}
                    <Button
                      className={cn(
                        "size-7 rounded-full text-white/70 hover:text-white hover:bg-white/20",
                        isLiked && "text-destructive"
                      )}
                      onClick={() => {
                        setIsLiked((l) => !l);
                        toast({
                          description: isLiked
                            ? "Removed from liked songs"
                            : "Added to liked songs!",
                          title: isLiked ? "Unliked" : "Liked Track",
                        });
                      }}
                      size="icon"
                      title="Like Track"
                      variant="ghost"
                    >
                      <Heart
                        className={cn(
                          "size-3.5",
                          isLiked && "fill-destructive"
                        )}
                      />
                    </Button>
                  </div>
                </div>

                {/* Progress Timeline */}
                <div className="space-y-1">
                  <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, Math.max(15, (currentTrackIndex + 1) * 20))}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-white/40 font-mono">
                    <span>1:45</span>
                    <span>{activeTrack.duration}</span>
                  </div>
                </div>
              </div>

              {/* Full Tracklist below Player */}
              <div className="flex flex-col flex-1">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 shrink-0 bg-white/[0.01]">
                  <div className="flex items-center gap-1.5 text-xs text-white font-semibold">
                    <ListMusic className="size-3.5 text-primary" />
                    <span>All Songs ({partyAlbumTracks.length})</span>
                  </div>
                  <span className="text-[10px] text-white/50">
                    Track {currentTrackIndex + 1} of {partyAlbumTracks.length}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-1.5 max-h-[300px] sm:max-h-[340px] focus-visible:outline-none custom-scrollbar">
                  {partyAlbumTracks.map((track, idx) => {
                    const isCurrent = idx === currentTrackIndex;

                    return (
                      <div
                        className={cn(
                          "group flex items-center justify-between rounded-xl p-2.5 text-xs transition-all border",
                          isCurrent
                            ? "bg-primary/20 border-primary/40 text-white font-semibold shadow-md"
                            : "border-transparent bg-white/[0.02] hover:bg-white/10 text-white/80"
                        )}
                        key={track.id}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span className="w-5 font-mono text-[11px] text-white/40 text-center">
                            {idx + 1}
                          </span>
                          <div className="truncate min-w-0 flex-1">
                            <p className="truncate font-medium text-white">
                              {track.title}
                            </p>
                            <p className="text-[10px] text-white/50 truncate">
                              {track.artist}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isCurrent && (
                            <Badge className="bg-primary text-primary-foreground text-[9px] px-1.5 py-0 mr-1 animate-pulse">
                              NOW PLAYING
                            </Badge>
                          )}

                          {perspective === "fan" ? (
                            <Button
                              className={cn(
                                "size-7 rounded-full text-white/70 hover:text-white hover:bg-white/20",
                                savedTrackIds.has(track.id) && "text-primary"
                              )}
                              onClick={() =>
                                handleToggleSaveTrack(track.id, track.title)
                              }
                              size="icon"
                              title={
                                savedTrackIds.has(track.id)
                                  ? "Saved to Library"
                                  : "Save Track to Library"
                              }
                              variant="ghost"
                            >
                              {savedTrackIds.has(track.id) ? (
                                <BookmarkCheck className="size-3.5 text-primary" />
                              ) : (
                                <Plus className="size-3.5" />
                              )}
                            </Button>
                          ) : (
                            <Button
                              className="size-7 rounded-full text-white/70 hover:text-white hover:bg-white/20"
                              onClick={() => handleReplaySong(idx)}
                              size="icon"
                              title="Play or Replay this track for the party (Host)"
                              variant="ghost"
                            >
                              <RotateCcw className="size-3" />
                            </Button>
                          )}

                          <span className="font-mono text-[11px] text-white/50 w-10 text-right">
                            {track.duration}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );

  return (
    <LiveTwitchShell
      chatPanel={chatPanel}
      defaultChatOpen={true}
      isChatOpen={isChatOpen}
      onChatOpenChange={setIsChatOpen}
      videoNode={videoNode}
    >
      <LiveCreatorPanel
        creator={{
          displayName: "Aura Sound Lab",
          followersCount: 8100,
          username: "aurasound",
        }}
        genre="Electronic / Synthwave"
        isLive
        statusLabel="Listening Premiere"
        title="Midnight Reverie — Worldwide Album Premiere"
        viewerCount={1340}
      />
    </LiveTwitchShell>
  );
}

function VideoPreviewSection({
  chatMessages,
  onSendMessage,
}: {
  chatMessages: ChatItem[];
  onSendMessage: (msg: string) => void;
}) {
  const [isChatOpen, setIsChatOpen] = useState(true),
    {
      containerRef: videoRef,
      isFullscreen,
      toggleFullscreen,
    } = useBrowserFullscreen(),
    chatPanel = (
      <LiveChatPanel
        disabled={false}
        fillHeight
        messages={chatMessages}
        onCollapse={() => setIsChatOpen(false)}
        onSend={onSendMessage}
        title="Video Comments"
      />
    ),
    videoNode = (
      <div className="relative aspect-video w-full bg-black" ref={videoRef}>
        <AppImage
          alt="Music Video"
          className="size-full object-cover"
          height={720}
          src="/music-battle-video-thumbnail.jpg"
          width={1280}
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <Button className="size-16 rounded-full shadow-2xl" size="icon">
            <Play className="size-8 fill-current translate-x-0.5" />
          </Button>
        </div>
        <Button
          className="absolute right-4 bottom-4 size-8 bg-black/60 text-white hover:bg-black/80"
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
    );

  return (
    <LiveTwitchShell
      chatPanel={chatPanel}
      defaultChatOpen={true}
      isChatOpen={isChatOpen}
      onChatOpenChange={setIsChatOpen}
      videoNode={videoNode}
    >
      <LiveCreatorPanel
        creator={{
          displayName: "Shadow Realm Records",
          followersCount: 15_600,
          username: "shadowrealm",
        }}
        genre="Trap / Dark Drill"
        isLive={false}
        statusLabel="Official 4K Music Video"
        title="City of Ghosts (Official 4K Visualizer)"
        viewerCount={4820}
      />
    </LiveTwitchShell>
  );
}

function ChallengePreviewSection({
  challengePerspective,
  onAccept,
}: {
  challengePerspective: "challenged" | "challenger";
  onAccept: () => void;
}) {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <Card className="border-primary/40 bg-card/90 shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-full bg-destructive/20 text-destructive">
            <Swords className="size-8" />
          </div>
          <CardTitle className="text-2xl">
            {challengePerspective === "challenger"
              ? "Battle Challenge Sent!"
              : "You Received a Battle Challenge!"}
          </CardTitle>
          <CardDescription>
            {challengePerspective === "challenger"
              ? "Waiting for @novabeats to accept your Best of 5 Hip-Hop challenge."
              : "@metro_k has challenged you to a 5-Round Beat Battle in Trap / Hip-Hop."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Target Profile Card: Only show opponent when sent, only challenger when received */}
          {challengePerspective === "challenger" ? (
            <div className="rounded-xl border border-primary/30 p-4 space-y-2 bg-background/60">
              <span className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
                Challenge Sent To
              </span>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <Avatar className="size-12 border">
                    <AvatarImage src="/soundkit-default-avatar.svg" />
                    <AvatarFallback>NV</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-base">Nova Beats</p>
                      <CheckCircle2 className="size-4 text-primary" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      @novabeats • Rating: 1,790
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">
                  Pending Response
                </Badge>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-destructive/40 p-4 space-y-2 bg-background/60">
              <span className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
                Challenge From
              </span>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <Avatar className="size-12 border">
                    <AvatarImage src="/soundkit-default-avatar.svg" />
                    <AvatarFallback>MK</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-base">Metro K</p>
                      <CheckCircle2 className="size-4 text-primary" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      @metro_k • Rating: 1,840
                    </p>
                  </div>
                </div>
                <Badge variant="destructive" className="text-xs">
                  Awaiting Your Decision
                </Badge>
              </div>
            </div>
          )}

          <div className="rounded-xl border p-4 space-y-3 bg-muted/30 text-xs">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Format</span>
              <span className="font-bold">Best of 5 Rounds</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Genre</span>
              <span className="font-bold">Hip-Hop / Trap</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Scheduled Time</span>
              <span className="font-bold">Instant Arena Go-Live</span>
            </div>
          </div>

          {challengePerspective === "challenged" ? (
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  toast({
                    description:
                      "Matchup confirmed! Entering live battle room.",
                    title: "Challenge Accepted",
                  });
                  onAccept();
                }}
                size="lg"
              >
                <Swords className="mr-2 size-5" />
                Accept Challenge &amp; Enter Arena
              </Button>
              <Button
                className="sm:w-36"
                onClick={() =>
                  toast({
                    description: "Challenge was declined.",
                    title: "Declined",
                  })
                }
                size="lg"
                variant="outline"
              >
                Decline
              </Button>
            </div>
          ) : (
            <div className="flex justify-between items-center rounded-lg border p-4 bg-background/50">
              <span className="text-xs text-muted-foreground">
                Invitation expires in 14 minutes
              </span>
              <Button
                onClick={() =>
                  toast({
                    description: "Challenge invitation was cancelled.",
                    title: "Challenge Cancelled",
                  })
                }
                size="sm"
                variant="outline"
              >
                Cancel Invitation
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
