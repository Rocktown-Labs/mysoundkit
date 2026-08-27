"use client";

import {
  AlertTriangle,
  Check,
  Flag,
  Hand,
  LogOut,
  ShieldAlert,
  Swords,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LiveRoomArtist } from "@/lib/live-room";

type BattleCancellationReason =
  | "artist_unavailable"
  | "ducked"
  | "moderation"
  | "other"
  | "schedule_conflict"
  | "technical_issue";
type BattleOutcomeKind = "canceled" | "ducked" | "forfeited";

const reasonOptions: { label: string; value: BattleCancellationReason }[] = [
    { label: "Ducked / opponent no-show", value: "ducked" },
    { label: "Artist unavailable", value: "artist_unavailable" },
    { label: "Technical issue", value: "technical_issue" },
    { label: "Schedule conflict", value: "schedule_conflict" },
    { label: "Moderation or safety", value: "moderation" },
    { label: "Other", value: "other" },
  ],
  preStartPhases = new Set(["scheduled", "waiting_room"]),
  turnPhases = new Set([
    "artist_a_turn",
    "artist_b_turn",
    "pre_vote",
    "round_result",
    "turn_transition",
    "tiebreaker_a",
    "tiebreaker_b",
    "tiebreaker_transition",
    "voting",
    "tiebreaker_voting",
  ]);

type Disposition = {
  affectedUserId?: string | null;
  kind: BattleOutcomeKind;
  reason: BattleCancellationReason;
};

export function BattleLifecycleControls({
  artists,
  isAdmin,
  isArtist,
  isReady,
  onDisposition,
  onReady,
  pending,
  phase,
  readyArtistUserIds,
}: {
  artists: [LiveRoomArtist, LiveRoomArtist];
  isAdmin: boolean;
  isArtist: boolean;
  isReady: boolean;
  onDisposition: (disposition: Disposition) => Promise<void>;
  onReady: (ready: boolean) => Promise<void>;
  pending: boolean;
  phase: string;
  readyArtistUserIds: string[];
}) {
  const [dialogOpen, setDialogOpen] = useState(false),
    [kind, setKind] = useState<BattleOutcomeKind>("canceled"),
    [reason, setReason] = useState<BattleCancellationReason>("technical_issue"),
    [affectedUserId, setAffectedUserId] = useState<string | null>(
      artists[1]?.id ?? null
    ),
    [actionError, setActionError] = useState<string | null>(null),
    isPreStart = preStartPhases.has(phase),
    isInProgress = turnPhases.has(phase),
    isActionable = phase !== "ended",
    canCancel = isActionable && (isAdmin || (isArtist && isPreStart)),
    canForfeit = isArtist && isInProgress,
    openDisposition = (
      nextKind: BattleOutcomeKind,
      nextReason: BattleCancellationReason
    ) => {
      setKind(nextKind);
      setReason(nextReason);
      setActionError(null);
      setDialogOpen(true);
    },
    submitDisposition = async () => {
      if (kind === "ducked" && !affectedUserId) {
        setActionError("Choose the artist who no-showed.");
        return;
      }
      setActionError(null);
      try {
        await onDisposition({
          affectedUserId: kind === "canceled" ? null : affectedUserId,
          kind,
          reason,
        });
        setDialogOpen(false);
      } catch (error) {
        setActionError(
          error instanceof Error ? error.message : "Battle action failed."
        );
      }
    };

  if (!(isActionable && (isArtist || isAdmin))) {
    return null;
  }

  return (
    <>
      <Card className="border-primary/30 bg-card/80 shadow-sm">
        <CardHeader className="gap-2 pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 rounded-md bg-primary/15 p-2 text-primary">
                <Swords className="size-4" />
              </div>
              <div>
                <CardTitle className="text-sm">
                  {isPreStart ? "Battle readiness" : "Battle controls"}
                </CardTitle>
                <CardDescription className="mt-1 text-xs">
                  {isPreStart
                    ? "Both artists must be ready before BattleBot starts the first turn."
                    : "BattleBot controls the stage; use these controls only when you need to leave the match."}
                </CardDescription>
              </div>
            </div>
            {isPreStart && (
              <span className="rounded-full border border-border/70 bg-muted/50 px-2.5 py-1 font-mono text-[10px] text-muted-foreground">
                {readyArtistUserIds.length}/2 ready
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {isPreStart && (
            <div className="grid gap-2 sm:grid-cols-2">
              {artists.map((artist) => {
                const ready = readyArtistUserIds.includes(artist.id);
                return (
                  <div
                    className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/40 p-2.5"
                    key={artist.id}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-xs">
                        {artist.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {ready ? "Ready to battle" : "Preparing"}
                      </p>
                    </div>
                    {ready ? (
                      <Check className="size-4 shrink-0 text-emerald-400" />
                    ) : (
                      <span className="size-2 shrink-0 rounded-full bg-muted-foreground/50" />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {isArtist && isPreStart && (
              <Button
                className="gap-1.5"
                disabled={pending}
                onClick={() => void onReady(!isReady)}
                size="sm"
                type="button"
                variant={isReady ? "secondary" : "default"}
              >
                <Hand className="size-3.5" />
                {isReady ? "Not ready" : "I’m ready"}
              </Button>
            )}
            {canCancel && (
              <Button
                className="gap-1.5"
                disabled={pending}
                onClick={() => openDisposition("canceled", "technical_issue")}
                size="sm"
                type="button"
                variant="outline"
              >
                <LogOut className="size-3.5" />
                Cancel battle
              </Button>
            )}
            {canCancel && isPreStart && (
              <Button
                className="gap-1.5"
                disabled={pending}
                onClick={() => openDisposition("ducked", "ducked")}
                size="sm"
                type="button"
                variant="outline"
              >
                <Flag className="size-3.5" />
                Mark ducked
              </Button>
            )}
            {canForfeit && (
              <Button
                className="gap-1.5"
                disabled={pending}
                onClick={() =>
                  openDisposition("forfeited", "artist_unavailable")
                }
                size="sm"
                type="button"
                variant="destructive"
              >
                <ShieldAlert className="size-3.5" />
                Forfeit battle
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog onOpenChange={setDialogOpen} open={dialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {kind === "ducked"
                ? "Record a duck"
                : kind === "forfeited"
                  ? "Forfeit this battle?"
                  : "Cancel this battle?"}
            </DialogTitle>
            <DialogDescription>
              {kind === "ducked"
                ? "This ends the waiting room without changing either artist’s rating."
                : kind === "forfeited"
                  ? "This ends the active match and records the selected artist as the forfeiting participant."
                  : "This closes the battle before a rated result is recorded."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {kind === "ducked" && (
              <div className="space-y-2">
                <label
                  className="font-semibold text-xs"
                  htmlFor="ducked-artist"
                >
                  No-showing artist
                </label>
                <Select
                  onValueChange={setAffectedUserId}
                  value={affectedUserId ?? undefined}
                >
                  <SelectTrigger id="ducked-artist">
                    <SelectValue placeholder="Choose an artist" />
                  </SelectTrigger>
                  <SelectContent className="[&_[data-highlighted]]:bg-muted [&_[data-highlighted]]:text-foreground">
                    {artists.map((artist) => (
                      <SelectItem key={artist.id} value={artist.id}>
                        {artist.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <label
                className="font-semibold text-xs"
                htmlFor="battle-action-reason"
              >
                Reason
              </label>
              <Select
                onValueChange={(value) =>
                  setReason(value as BattleCancellationReason)
                }
                value={reason}
              >
                <SelectTrigger id="battle-action-reason">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="[&_[data-highlighted]]:bg-muted [&_[data-highlighted]]:text-foreground">
                  {reasonOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {actionError && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                {actionError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              disabled={pending}
              onClick={() => setDialogOpen(false)}
              type="button"
              variant="outline"
            >
              Keep battle open
            </Button>
            <Button
              disabled={pending}
              onClick={() => void submitDisposition()}
              type="button"
              variant={kind === "forfeited" ? "destructive" : "default"}
            >
              {pending ? "Saving..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
