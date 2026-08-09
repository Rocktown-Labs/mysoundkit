import { Link } from "@tanstack/react-router";
import { Clock, TrendingUp, Users, Lock } from "lucide-react";
import { useState, useEffect } from "react";

import { AppImage } from "@/components/ui/app-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface BattleCardProps {
  id: string;
  title: string;
  track1: {
    title: string;
    artist: string;
    votes: number;
    cover: string;
  };
  track2: {
    title: string;
    artist: string;
    votes: number;
    cover: string;
  };
  endsIn?: string;
  genre: string;
  isLive?: boolean;
  live?: boolean;
  startsIn?: string;
  views?: string;
  currentRound?: number;
  totalRounds?: number;
  isVoting?: boolean;
  queueSize?: number;
  joinMode?: "waiting_room" | "watch_now";
  phaseEndsAt?: string | null;
  isPremiumUser?: boolean;
}

export function BattleCard({
  id,
  title,
  track1,
  track2,
  endsIn,
  genre,
  isLive = false,
  live = false,
  startsIn,
  views,
  currentRound = 1,
  totalRounds = 3,
  isVoting = false,
  queueSize = 0,
  joinMode = "watch_now",
  phaseEndsAt = null,
  isPremiumUser = false,
}: BattleCardProps) {
  const battleIsLive = isLive || live;
  const timeLabel = endsIn ?? startsIn ?? views ?? "";
  const totalVotes = track1.votes + track2.votes;
  const track1Percentage =
    totalVotes > 0 ? (track1.votes / totalVotes) * 100 : 0;
  const track2Percentage =
    totalVotes > 0 ? (track2.votes / totalVotes) * 100 : 0;

  const [roundProgress, setRoundProgress] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);

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
      );
      const phaseDuration = isVoting ? 60 : 180;
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

  const canJoinNow = battleIsLive && joinMode === "watch_now";
  const liveTimeLabel =
    timeRemaining > 0
      ? `${Math.floor(timeRemaining / 60)}:${(timeRemaining % 60)
          .toString()
          .padStart(2, "0")}`
      : "Live";

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow group min-w-[280px] md:min-w-0 w-[280px] md:w-auto">
      <CardContent className="p-3 md:p-4">
        <div className="flex items-center justify-between mb-3">
          <Badge variant="secondary" className="text-[10px] md:text-xs">
            {genre}
          </Badge>
          {battleIsLive ? (
            <div className="flex flex-col items-end gap-1 flex-1 ml-2">
              <Badge
                variant={isVoting ? "default" : "secondary"}
                className={`text-[10px] md:text-xs ${isVoting ? "bg-green-600" : "bg-primary"}`}
              >
                {isVoting ? "Voting" : `Round ${currentRound}/${totalRounds}`}
              </Badge>
              <div className="w-full max-w-[120px]">
                <Progress
                  value={roundProgress}
                  className={`h-1.5 ${isVoting ? "[&>div]:bg-green-600" : ""}`}
                />
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {liveTimeLabel}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="size-3" />
              <span className="text-[10px] md:text-xs">{timeLabel}</span>
            </div>
          )}
        </div>

        <h3 className="font-semibold text-sm md:text-base mb-3 md:mb-4 group-hover:text-primary transition-colors line-clamp-1">
          {title}
        </h3>

        {/* Track 1 */}
        <div className="flex items-center gap-2 md:gap-3 mb-2">
          <div className="relative size-10 md:size-12 rounded-md overflow-hidden shrink-0">
            <AppImage
              src={track1.cover || "/placeholder.svg"}
              alt={track1.title}
              width={48}
              height={48}
              layout="fixed"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-xs md:text-sm truncate">
              {track1.title}
            </p>
            <p className="text-[10px] md:text-xs text-muted-foreground truncate">
              {track1.artist}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs md:text-sm font-semibold">
              {track1Percentage.toFixed(0)}%
            </p>
            <p className="text-[9px] md:text-xs text-muted-foreground">
              {track1.votes.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 my-2">
          <Progress value={track1Percentage} className="flex-1 h-1" />
        </div>

        {/* Track 2 */}
        <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
          <div className="relative size-10 md:size-12 rounded-md overflow-hidden shrink-0">
            <AppImage
              src={track2.cover || "/placeholder.svg"}
              alt={track2.title}
              width={48}
              height={48}
              layout="fixed"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-xs md:text-sm truncate">
              {track2.title}
            </p>
            <p className="text-[10px] md:text-xs text-muted-foreground truncate">
              {track2.artist}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs md:text-sm font-semibold">
              {track2Percentage.toFixed(0)}%
            </p>
            <p className="text-[9px] md:text-xs text-muted-foreground">
              {track2.votes.toLocaleString()}
            </p>
          </div>
        </div>

        {battleIsLive ? (
          <div className="space-y-2">
            {isPremiumUser ? (
              canJoinNow ? (
                <Link to="/live/battles/$id" params={{ id }} className="block">
                  <Button className="w-full" size="sm">
                    Watch Live
                  </Button>
                </Link>
              ) : (
                <Button
                  className="w-full bg-transparent"
                  size="sm"
                  variant="outline"
                  asChild
                >
                  <Link to="/live/battles/$id" params={{ id }}>
                    <Users className="size-3 mr-1" />
                    {joinMode === "waiting_room"
                      ? `Join Waiting Room (${queueSize})`
                      : `Join Queue (${queueSize})`}
                  </Link>
                </Button>
              )
            ) : (
              <Link to="/pricing" className="block">
                <Button className="w-full" size="sm" variant="secondary">
                  <Lock className="size-3 mr-2" />
                  Upgrade to Watch
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <Link to="/live/battles/$id" params={{ id }}>
            <div className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors">
              <TrendingUp className="size-3" />
              <span className="text-[10px] md:text-xs">
                {totalVotes.toLocaleString()} total votes
              </span>
            </div>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
