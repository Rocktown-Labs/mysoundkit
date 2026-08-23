/* eslint-disable one-var, sort-vars, complexity, no-nested-ternary, unicorn/no-nested-ternary */
import { Link } from "@tanstack/react-router";
import { Clock, Lock, TrendingUp, Users } from "lucide-react";
import { useEffect, useState } from "react";

import { AppImage } from "@/components/ui/app-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
  genre: string;
  id: string;
  isLive?: boolean;
  isPremiumUser?: boolean;
  isVoting?: boolean;
  joinMode?: "waiting_room" | "watch_now";
  live?: boolean;
  phaseEndsAt?: string | null;
  queueSize?: number;
  startsIn?: string;
  title: string;
  totalRounds?: number;
  track1: BattleTrack;
  track2: BattleTrack;
  views?: string;
}

function BattleTrackSummary({
  percentage,
  track,
}: {
  percentage: number;
  track: BattleTrack;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-md bg-muted/40 p-2">
      <AppImage
        alt={`${track.title} cover artwork`}
        className="size-9 shrink-0 rounded object-cover"
        height={36}
        layout="fixed"
        loading="lazy"
        src={track.cover || "/placeholder.svg"}
        width={36}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-xs">{track.title}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {track.artist}
        </p>
      </div>
      <span className="shrink-0 font-semibold text-xs tabular-nums">
        {percentage.toFixed(0)}%
      </span>
    </div>
  );
}

export function BattleCard({
  currentRound = 1,
  endsIn,
  genre,
  id,
  isLive = false,
  isPremiumUser = false,
  isVoting = false,
  joinMode = "watch_now",
  live = false,
  phaseEndsAt = null,
  queueSize = 0,
  startsIn,
  title,
  totalRounds = 3,
  track1,
  track2,
  views,
}: BattleCardProps) {
  const battleIsLive = isLive || live,
    canJoinNow = battleIsLive && joinMode === "watch_now",
    timeLabel = endsIn ?? startsIn ?? views ?? "",
    totalVotes = track1.votes + track2.votes,
    track1Percentage = totalVotes > 0 ? (track1.votes / totalVotes) * 100 : 0,
    track2Percentage = totalVotes > 0 ? (track2.votes / totalVotes) * 100 : 0,
    [roundProgress, setRoundProgress] = useState(0),
    [timeRemaining, setTimeRemaining] = useState(0);

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

      const remainingSeconds = Math.max(
          0,
          Math.ceil((new Date(phaseEndsAt).getTime() - Date.now()) / 1000)
        ),
        phaseDuration = isVoting ? 60 : 180;
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
    <Card className="group w-full overflow-hidden border-border/50 bg-card/60 transition-colors hover:border-primary/60">
      <Link
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        params={{ id }}
        to="/live/battles/$id"
      >
        <div className="relative aspect-video w-full overflow-hidden bg-muted">
          <div className="grid size-full grid-cols-2">
            {[track1, track2].map((track) => (
              <AppImage
                alt={`${track.title} battle artwork`}
                className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                height={720}
                key={`${track.artist}-${track.title}`}
                layout="constrained"
                loading="lazy"
                src={track.cover || "/placeholder.svg"}
                width={640}
              />
            ))}
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/40" />

          <div className="absolute top-2 left-2 flex items-center gap-1.5">
            <Badge variant={battleIsLive ? "destructive" : "secondary"}>
              {battleIsLive ? "Live Battle" : genre}
            </Badge>
            {battleIsLive ? <Badge variant="secondary">{genre}</Badge> : null}
          </div>

          <span className="absolute top-1/2 left-1/2 flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/70 font-black text-sm text-white shadow-lg">
            VS
          </span>

          <div className="absolute right-2 bottom-2 left-2 flex items-end justify-between gap-2 text-white">
            <h3 className="line-clamp-2 min-w-0 font-semibold text-sm leading-snug">
              {title}
            </h3>
            <span className="flex shrink-0 items-center gap-1 rounded bg-black/75 px-1.5 py-0.5 text-[11px] tabular-nums">
              <Clock aria-hidden="true" className="size-3" />
              {battleIsLive ? liveTimeLabel : timeLabel || "Upcoming"}
            </span>
          </div>
        </div>
      </Link>

      <CardContent className="flex flex-col gap-3 p-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <BattleTrackSummary percentage={track1Percentage} track={track1} />
          <BattleTrackSummary percentage={track2Percentage} track={track2} />
        </div>

        <Progress className="h-1.5" value={track1Percentage} />

        {battleIsLive ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span>
                {isVoting
                  ? "Voting Open"
                  : `Round ${currentRound}/${totalRounds}`}
              </span>
              <span className="tabular-nums">{liveTimeLabel}</span>
            </div>
            <Progress
              className={cn("h-1", isVoting && "[&>div]:bg-green-600")}
              value={roundProgress}
            />
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <TrendingUp aria-hidden="true" />
            <span>{totalVotes.toLocaleString()} total votes</span>
          </div>
        )}

        {battleIsLive ? (
          isPremiumUser ? (
            canJoinNow ? (
              <Button asChild size="sm">
                <Link params={{ id }} to="/live/battles/$id">
                  Watch Live
                </Link>
              </Button>
            ) : (
              <Button asChild size="sm" variant="outline">
                <Link params={{ id }} to="/live/battles/$id">
                  <Users aria-hidden="true" data-icon="inline-start" />
                  {joinMode === "waiting_room"
                    ? `Join Waiting Room (${queueSize})`
                    : `Join Queue (${queueSize})`}
                </Link>
              </Button>
            )
          ) : (
            <Button asChild size="sm" variant="secondary">
              <Link to="/pricing">
                <Lock aria-hidden="true" data-icon="inline-start" />
                Upgrade to Watch
              </Link>
            </Button>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}
