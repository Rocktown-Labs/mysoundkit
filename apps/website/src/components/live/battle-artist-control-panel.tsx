import { Check, Minus, Music2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LiveRoomState } from "@/lib/live-room";

type ArtistTrackStatus =
  | "available"
  | "lost"
  | "played"
  | "playing"
  | "queued"
  | "tie"
  | "won";

const trackStatusCopy: Record<
    ArtistTrackStatus,
    { label: string; tone: string }
  > = {
    available: {
      label: "Available",
      tone: "text-muted-foreground",
    },
    lost: {
      label: "Lost",
      tone: "text-red-400",
    },
    played: {
      label: "Played",
      tone: "text-muted-foreground",
    },
    playing: {
      label: "Playing",
      tone: "text-primary",
    },
    queued: {
      label: "Next",
      tone: "text-amber-300",
    },
    tie: {
      label: "Tie",
      tone: "text-amber-300",
    },
    won: {
      label: "Won",
      tone: "text-emerald-400",
    },
  },
  trackStatusIcon = (status: ArtistTrackStatus) => {
    if (status === "won") {
      return <Check className="size-3.5" />;
    }

    if (status === "lost") {
      return <X className="size-3.5" />;
    }

    if (status === "tie") {
      return <Minus className="size-3.5" />;
    }

    return null;
  };

export function BattleArtistControlPanel({
  artistId,
  battle,
  currentTrackId,
  onSelectTrack,
  pending,
}: {
  artistId: string;
  battle: NonNullable<LiveRoomState["battle"]>;
  currentTrackId?: string | null;
  onSelectTrack: (trackId: string) => void;
  pending?: boolean;
}) {
  const controls = battle.artistControls;
  if (!controls) {
    return null;
  }

  const tracksById = new Map(
      battle.rounds.flatMap((round) => [
        [round.artistATrack.id, { round, track: round.artistATrack }],
        [round.artistBTrack.id, { round, track: round.artistBTrack }],
      ])
    ),
    roundForTrack = (trackId: string) => tracksById.get(trackId),
    statusForTrack = (trackId: string): ArtistTrackStatus => {
      const entry = roundForTrack(trackId);
      if (entry?.round.winnerArtistId) {
        const won = entry.round.winnerArtistId === artistId;
        return won ? "won" : "lost";
      }

      if (entry?.round.status === "complete") {
        return "tie";
      }

      if (controls.currentTrackId === trackId || currentTrackId === trackId) {
        return "playing";
      }

      if (controls.selectedNextTrackId === trackId) {
        return "queued";
      }

      if (battle.currentRoundId === entry?.round.id) {
        return "queued";
      }

      if (controls.usedTrackIds.includes(trackId)) {
        return "played";
      }

      return "available";
    };

  return (
    <Card className="border-primary/30 bg-card/80">
      <CardHeader className="gap-1 pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
          <Music2 className="size-4 text-primary" />
          Your Battle Kit
          <Badge className="ml-auto text-[10px]" variant="outline">
            {controls.selectedKitId ? "Kit locked" : "Lineup loading"}
          </Badge>
        </CardTitle>
        <p className="text-[11px] text-muted-foreground">
          Choose an unused song for your next turn. Your result stays private to
          your artist room.
        </p>
      </CardHeader>
      <CardContent className="space-y-1.5 pt-0">
        {controls.availableTrackIds.map((trackId) => {
          const status = statusForTrack(trackId),
            statusCopy = trackStatusCopy[status],
            entry = roundForTrack(trackId),
            trackLabel = entry
              ? `${entry.round.isTiebreaker ? "TB" : `R${entry.round.number}`} · ${entry.track.title}`
              : trackId,
            canChoose = status === "available";
          return (
            <div
              className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-2.5 py-2"
              key={trackId}
            >
              <span
                className={`flex min-w-0 flex-1 items-center gap-1.5 text-xs ${statusCopy.tone} ${status === "won" || status === "lost" ? "line-through decoration-2" : ""}`}
                title={trackLabel}
              >
                {trackStatusIcon(status)}
                <span className="truncate font-medium">{trackLabel}</span>
              </span>
              <span
                aria-label={`${trackLabel}: ${statusCopy.label}`}
                className={`shrink-0 text-[10px] ${statusCopy.tone}`}
              >
                {statusCopy.label}
              </span>
              {canChoose && (
                <Button
                  disabled={pending}
                  onClick={() => onSelectTrack(trackId)}
                  size="sm"
                  variant="outline"
                >
                  Choose next
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
