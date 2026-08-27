/* eslint-disable one-var, complexity, no-nested-ternary, unicorn/no-nested-ternary */
import { Link } from "@tanstack/react-router";
import { CalendarClock, Clock, Lock, Users } from "lucide-react";
import { useEffect, useState } from "react";

import {
  PublicCard,
  PublicCardMeta,
  PublicCardThumbnail,
} from "@/components/explore/public-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { BattleParticipant } from "@/lib/soundkit-api-hooks";
import { cn } from "@/lib/utils";

interface BattleTrack {
  artist: string;
  cover: string;
  title: string;
  votes: number;
}

interface BattleCardProps {
  currentRound?: number;
  endsIn?: string;
  format?: "best_of_3" | "best_of_5" | "best_of_7";
  genre: string;
  id: string;
  isLive?: boolean;
  isPremiumUser?: boolean;
  isVoting?: boolean;
  joinMode?: "waiting_room" | "watch_now";
  live?: boolean;
  participants?: BattleParticipant[];
  phaseEndsAt?: string | null;
  queueSize?: number;
  showActions?: boolean;
  startsAt?: string | null;
  startsIn?: string;
  status?: "archived" | "completed" | "live" | "scheduled";
  title: string;
  totalRounds?: number;
  track1?: BattleTrack;
  track2?: BattleTrack;
  views?: string;
}

const emptyParticipants: BattleParticipant[] = [],
  fallbackParticipants: BattleParticipant[] = [
    {
      avatarUrl: null,
      id: "participant-one",
      name: "Artist One",
      username: null,
    },
    {
      avatarUrl: null,
      id: "participant-two",
      name: "Artist Two",
      username: null,
    },
  ],
  formatLabel = (format: BattleCardProps["format"], totalRounds: number) =>
    format ? format.replace("best_of_", "BO") : `BO${totalRounds}`,
  formatScheduledTime = (startsAt: string | null | undefined) => {
    if (!startsAt) {
      return "Upcoming";
    }

    const date = new Date(startsAt);
    return Number.isNaN(date.getTime())
      ? "Upcoming"
      : date.toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        });
  };

function BattleParticipantArtwork({
  participants,
}: {
  participants: BattleParticipant[];
}) {
  const displayedParticipants = [
    participants[0] ?? fallbackParticipants[0],
    participants[1] ?? fallbackParticipants[1],
  ];

  return (
    <div className="relative flex size-full items-center justify-center overflow-hidden bg-gradient-to-br from-primary/25 via-card to-secondary/35">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.2),transparent_58%)]" />
      <div className="relative grid w-full max-w-lg grid-cols-2 items-center gap-2 px-5 sm:gap-4 sm:px-10">
        {displayedParticipants.map((participant) => (
          <div
            className="flex min-w-0 flex-col items-center gap-1.5 text-center"
            key={participant.id}
          >
            <Avatar className="size-16 rounded-md border-2 border-white/50 shadow-lg sm:size-24">
              <AvatarImage
                alt={`${participant.name} profile photo`}
                src={participant.avatarUrl ?? undefined}
              />
              <AvatarFallback className="rounded-md bg-primary/80 text-primary-foreground">
                {participant.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="max-w-full truncate rounded bg-black/65 px-1.5 py-0.5 font-semibold text-[11px] text-white backdrop-blur sm:text-xs">
              {participant.name}
            </span>
          </div>
        ))}
      </div>
      <span className="absolute top-1/2 left-1/2 flex size-10 -translate-1/2 items-center justify-center rounded-full border border-white/30 bg-black/75 font-black text-sm text-white shadow-lg">
        VS
      </span>
    </div>
  );
}

export function BattleCard({
  currentRound = 1,
  endsIn,
  format,
  genre,
  id,
  isLive = false,
  isPremiumUser = false,
  isVoting = false,
  joinMode = "watch_now",
  live = false,
  participants = emptyParticipants,
  phaseEndsAt = null,
  queueSize = 0,
  showActions = true,
  startsAt = null,
  startsIn,
  status,
  title,
  totalRounds = 3,
  views,
}: BattleCardProps) {
  const battleIsLive = isLive || live,
    battleStatus = status ?? (battleIsLive ? "live" : "scheduled"),
    canWatchNow = battleIsLive && joinMode === "watch_now",
    resolvedTotalRounds = format
      ? Number(format.replace("best_of_", ""))
      : totalRounds,
    timeLabel = endsIn ?? startsIn ?? formatScheduledTime(startsAt),
    [roundProgress, setRoundProgress] = useState(0),
    [timeRemaining, setTimeRemaining] = useState(0);
  const resolvedFormat = formatLabel(format, resolvedTotalRounds);
  const displayTitle = `${title.replace(/\s+-\s+BO[357]$/u, "")} - ${resolvedFormat}`;

  useEffect(() => {
    if (!battleIsLive) {
      return;
    }

    const updateTimer = () => {
      if (!phaseEndsAt) {
        setTimeRemaining(0);
        setRoundProgress(0);
        return;
      }

      const phaseDuration = isVoting ? 60 : 180,
        remainingSeconds = Math.max(
          0,
          Math.ceil((new Date(phaseEndsAt).getTime() - Date.now()) / 1000)
        );
      setTimeRemaining(remainingSeconds);
      setRoundProgress(
        Math.min(
          100,
          ((phaseDuration - remainingSeconds) / phaseDuration) * 100
        )
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [battleIsLive, isVoting, phaseEndsAt]);

  const liveTimeLabel =
    timeRemaining > 0
      ? `${Math.floor(timeRemaining / 60)}:${(timeRemaining % 60)
          .toString()
          .padStart(2, "0")}`
      : "Live";

  return (
    <PublicCard framed>
      <Link
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        params={{ id }}
        to="/live/battles/$id"
      >
        <PublicCardThumbnail className="rounded-none">
          <BattleParticipantArtwork participants={participants} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/40" />
          <div className="absolute top-2 left-2 flex flex-wrap items-center gap-1.5">
            <Badge
              variant={
                battleIsLive
                  ? "destructive"
                  : battleStatus === "scheduled"
                    ? "secondary"
                    : "outline"
              }
            >
              {battleIsLive
                ? "Live"
                : battleStatus === "scheduled"
                  ? "Upcoming"
                  : battleStatus}
            </Badge>
            <Badge variant="secondary">{genre}</Badge>
            <Badge variant="outline">{resolvedFormat}</Badge>
          </div>
        </PublicCardThumbnail>
      </Link>

      <PublicCardMeta className="space-y-2.5 p-3">
        <div className="min-w-0">
          <h3 className="line-clamp-1 font-semibold text-sm leading-snug transition-colors group-hover:text-primary">
            {displayTitle}
          </h3>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span>
              {battleIsLive
                ? `Round ${currentRound}/${resolvedTotalRounds}${
                    isVoting ? " · Voting open" : ""
                  }`
                : battleStatus === "scheduled"
                  ? timeLabel
                  : "Battle complete"}
            </span>
            <span className="flex shrink-0 items-center gap-1 tabular-nums">
              {battleIsLive ? (
                <Clock aria-hidden="true" className="size-3" />
              ) : (
                <CalendarClock aria-hidden="true" className="size-3" />
              )}
              {battleIsLive ? liveTimeLabel : (views ?? timeLabel)}
            </span>
          </div>
          <Progress
            className={cn("h-1", isVoting && "[&>div]:bg-green-600")}
            value={battleIsLive ? roundProgress : 0}
          />
        </div>

        {showActions && (battleIsLive || battleStatus === "scheduled") ? (
          isPremiumUser ? (
            <Button asChild className="w-full" size="sm">
              <Link params={{ id }} to="/live/battles/$id">
                {canWatchNow ? (
                  "Watch Live"
                ) : (
                  <>
                    <Users aria-hidden="true" data-icon="inline-start" />
                    {battleStatus === "scheduled" || joinMode === "waiting_room"
                      ? battleStatus === "scheduled"
                        ? "Join Waiting Room"
                        : `Join Waiting Room (${queueSize})`
                      : `Join Queue (${queueSize})`}
                  </>
                )}
              </Link>
            </Button>
          ) : (
            <Button asChild className="w-full" size="sm" variant="secondary">
              <Link to="/pricing">
                <Lock aria-hidden="true" data-icon="inline-start" />
                Upgrade to Watch
              </Link>
            </Button>
          )
        ) : null}
      </PublicCardMeta>
    </PublicCard>
  );
}
