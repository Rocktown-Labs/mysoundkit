import { Link } from "@tanstack/react-router";
import {
  Play,
  Clock,
  CheckCircle2,
  Bookmark,
  BookmarkCheck,
} from "lucide-react";

import { AppImage } from "@/components/ui/app-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface BattleTrackCardProps {
  track: {
    id: string;
    title: string;
    artist: string;
    artistSlug: string;
    cover: string;
    duration: string;
    votes: number;
  };
  trackNumber: 1 | 2;
  isWinner?: boolean;
  isVotedFor?: boolean;
  percentage?: number;
  showVoting?: boolean;
  votingDisabled?: boolean;
  isSaved?: boolean;
  onVote?: () => void;
  onToggleSave?: () => void;
  showStats?: boolean;
}

export function BattleTrackCard({
  track,
  trackNumber,
  isWinner,
  isVotedFor,
  percentage,
  showVoting = true,
  votingDisabled = false,
  isSaved = false,
  onVote,
  onToggleSave,
  showStats = true,
}: BattleTrackCardProps) {
  return (
    <Card
      className={`overflow-hidden transition-all ${isVotedFor ? "ring-2 ring-primary" : ""} ${
        isWinner ? "ring-2 ring-green-500" : ""
      }`}
    >
      <CardContent className="p-0">
        <div className="flex gap-3 p-3">
          {/* Small cover art */}
          <div className="relative size-16 shrink-0 rounded overflow-hidden group">
            <AppImage
              src={track.cover || "/placeholder.svg"}
              alt={track.title}
              width={64}
              height={64}
              layout="fixed"
              className="w-full h-full object-cover"
            />
            <button className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <div className="size-8 rounded-full bg-primary flex items-center justify-center">
                <Play className="size-4 fill-primary-foreground text-primary-foreground ml-0.5" />
              </div>
            </button>
            {isWinner && (
              <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="size-6 text-green-500" />
              </div>
            )}
          </div>

          {/* Track info */}
          <div className="flex-1 min-w-0 space-y-2">
            <div>
              <h3 className="font-semibold text-base leading-tight truncate">
                {track.title}
              </h3>
              <Link
                to="/artist/$username"
                params={{ username: track.artistSlug }}
                className="text-sm text-muted-foreground hover:text-primary truncate block"
              >
                {track.artist}
              </Link>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                <Clock className="size-3" />
                <span>{track.duration}</span>
                {isWinner && (
                  <Badge className="bg-green-500 text-white border-none text-xs h-5">
                    Winner
                  </Badge>
                )}
              </div>
            </div>

            {showStats && percentage !== undefined && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-primary">
                    {percentage.toFixed(1)}%
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {track.votes.toLocaleString()} votes
                  </span>
                </div>
                <Progress value={percentage} className="h-1.5" />
              </div>
            )}

            {showVoting && (
              <div className="flex gap-2">
                <Button
                  className="flex-1 h-8 text-sm"
                  size="sm"
                  onClick={onVote}
                  variant={isVotedFor ? "default" : "outline"}
                  disabled={votingDisabled}
                >
                  {isVotedFor ? (
                    <>
                      <CheckCircle2 className="size-3 mr-1.5" />
                      Voted
                    </>
                  ) : (
                    "Vote"
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onToggleSave}
                  className="h-8 px-3 bg-transparent"
                >
                  {isSaved ? (
                    <BookmarkCheck className="size-3.5" />
                  ) : (
                    <Bookmark className="size-3.5" />
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
