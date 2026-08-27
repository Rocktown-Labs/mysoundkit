"use client";

import {
  AlertTriangle,
  Check,
  Flag,
  Hand,
  HelpCircle,
  LogOut,
  ShieldAlert,
  Swords,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  | "platform_issue"
  | "schedule_conflict"
  | "technical_issue";
type BattleOutcomeKind = "canceled" | "ducked" | "forfeited" | "quit";

const reasonOptions: { label: string; value: BattleCancellationReason }[] = [
    { label: "Ducked / opponent no-show", value: "ducked" },
    { label: "Artist unavailable", value: "artist_unavailable" },
    { label: "Platform issue (SoundKit)", value: "platform_issue" },
    { label: "Technical issue", value: "technical_issue" },
    { label: "Schedule conflict", value: "schedule_conflict" },
    { label: "Moderation or safety", value: "moderation" },
    { label: "Other", value: "other" },
  ],
  preStartPhases = new Set(["scheduled", "waiting_room"]),
  turnPhases = new Set([
    "artist_a_turn",
    "artist_b_turn",
    "between_rounds",
    "pre_vote",
    "round_result",
    "turn_transition",
    "tiebreaker_a",
    "tiebreaker_b",
    "tiebreaker_transition",
    "voting",
    "tiebreaker_voting",
  ]);

interface Disposition {
  affectedUserId?: string | null;
  kind: BattleOutcomeKind;
  reason: BattleCancellationReason;
}

export function BattleLifecycleControls({
  artists,
  compact = false,
  currentUserId,
  hasSelectedKit,
  isAdmin,
  isArtist,
  isReady,
  onDisposition,
  onReady,
  pending,
  phase,
  readyArtistUserIds,
  roundNumber,
}: {
  artists: [LiveRoomArtist, LiveRoomArtist];
  compact?: boolean;
  currentUserId?: string;
  hasSelectedKit: boolean;
  isAdmin: boolean;
  isArtist: boolean;
  isReady: boolean;
  onDisposition: (disposition: Disposition) => Promise<void>;
  onReady: (ready: boolean) => Promise<void>;
  pending: boolean;
  phase: string;
  readyArtistUserIds: string[];
  roundNumber?: number;
}) {
  const [dialogOpen, setDialogOpen] = useState(false),
    [kind, setKind] = useState<BattleOutcomeKind>("canceled"),
    [reason, setReason] = useState<BattleCancellationReason>("technical_issue"),
    [affectedUserId, setAffectedUserId] = useState<string | null>(() =>
      isAdmin
        ? null
        : (artists.find((artist) => artist.id !== currentUserId)?.id ?? null)
    ),
    [actionError, setActionError] = useState<string | null>(null),
    isPreStart = preStartPhases.has(phase),
    isReadinessPhase = isPreStart || phase === "between_rounds",
    isInProgress = turnPhases.has(phase),
    isActionable = phase !== "ended",
    canCancel = isActionable && (isAdmin || (isArtist && isPreStart)),
    canForfeit = (isArtist || isAdmin) && isInProgress,
    canQuit = isArtist && isInProgress,
    isDuckedReport =
      kind === "ducked" || (kind === "canceled" && reason === "ducked"),
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
      if (
        (isDuckedReport || (kind === "forfeited" && isAdmin)) &&
        !affectedUserId
      ) {
        setActionError(
          kind === "forfeited"
            ? "Choose the artist who forfeited."
            : "Choose the artist who no-showed."
        );
        return;
      }
      setActionError(null);
      try {
        await onDisposition({
          affectedUserId: isDuckedReport
            ? affectedUserId
            : (kind === "canceled"
              ? null
              : affectedUserId),
          kind: isDuckedReport ? "ducked" : kind,
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
        <CardContent
          className={
            compact
              ? "flex items-center justify-between gap-3 p-3"
              : "flex flex-wrap items-center gap-3 p-3"
          }
        >
          {compact ? (
            <>
              <div className="flex min-w-0 items-center gap-2">
                <div className="rounded-md bg-primary/15 p-2 text-primary">
                  <HelpCircle className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm">Need help?</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    BattleBot starts the match when both artists are ready. Use
                    Help if you need to leave or report a no-show.
                  </p>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="shrink-0 gap-1.5" size="sm" type="button">
                    <HelpCircle className="size-3.5" />
                    Help
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  {canCancel && (
                    <DropdownMenuItem
                      onSelect={() =>
                        openDisposition("canceled", "technical_issue")
                      }
                    >
                      <LogOut className="size-3.5" />
                      Cancel battle
                    </DropdownMenuItem>
                  )}
                  {canCancel && isPreStart && (
                    <DropdownMenuItem
                      onSelect={() => openDisposition("ducked", "ducked")}
                    >
                      <Flag className="size-3.5" />
                      Mark ducked
                    </DropdownMenuItem>
                  )}
                  {canQuit && (
                    <DropdownMenuItem
                      onSelect={() =>
                        openDisposition("quit", "artist_unavailable")
                      }
                    >
                      <LogOut className="size-3.5" />
                      Quit battle
                    </DropdownMenuItem>
                  )}
                  {canForfeit && (
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={() =>
                        openDisposition("forfeited", "artist_unavailable")
                      }
                    >
                      <ShieldAlert className="size-3.5" />
                      {isAdmin ? "Record forfeit" : "Forfeit battle"}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <div className="flex min-w-0 items-center gap-2">
                <div className="rounded-md bg-primary/15 p-2 text-primary">
                  <Swords className="size-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-sm">
                      {isReadinessPhase
                        ? (phase === "between_rounds" && roundNumber
                          ? `Round ${roundNumber} readiness`
                          : "Battle readiness")
                        : "Battle controls"}
                    </p>
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {isReadinessPhase
                      ? "Both artists can ready up, or the timer will start the next round."
                      : "BattleBot controls the stage; use these controls only when you need to leave."}
                  </p>
                </div>
              </div>

              {isReadinessPhase && (
                <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                  {artists.map((artist) => {
                    const ready = readyArtistUserIds.includes(artist.id);
                    return (
                      <div
                        className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-border/60 bg-background/40 px-2.5 py-1"
                        key={artist.id}
                      >
                        {ready ? (
                          <Check className="size-3.5 shrink-0 text-emerald-400" />
                        ) : (
                          <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                        )}
                        <span className="max-w-32 truncate font-semibold text-[11px]">
                          {artist.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {ready ? "Ready" : "Preparing"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex flex-wrap gap-2 sm:ml-auto">
                {isArtist && isReadinessPhase && (
                  <Button
                    className="gap-1.5"
                    disabled={pending || (!hasSelectedKit && !isReady)}
                    onClick={() => void onReady(!isReady)}
                    size="sm"
                    type="button"
                    variant={isReady ? "secondary" : "default"}
                  >
                    <Hand className="size-3.5" />
                    {isReady
                      ? "Not ready"
                      : (hasSelectedKit
                        ? "I’m ready"
                        : "Select kit first")}
                  </Button>
                )}
                {canCancel && (
                  <Button
                    className="gap-1.5"
                    disabled={pending}
                    onClick={() =>
                      openDisposition("canceled", "technical_issue")
                    }
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
                {canQuit && (
                  <Button
                    className="gap-1.5"
                    disabled={pending}
                    onClick={() =>
                      openDisposition("quit", "artist_unavailable")
                    }
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <LogOut className="size-3.5" />
                    Quit battle
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
                    {isAdmin ? "Record forfeit" : "Forfeit battle"}
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog onOpenChange={setDialogOpen} open={dialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isDuckedReport
                ? "Record a duck"
                : kind === "forfeited"
                  ? "Forfeit this battle?"
                  : kind === "quit"
                    ? "Quit this battle?"
                    : "Cancel this battle?"}
            </DialogTitle>
            <DialogDescription>
              {isDuckedReport
                ? "This ends the waiting room without changing either artist’s rating."
                : kind === "forfeited"
                  ? "This ends the active match and records the selected artist as the forfeiting participant."
                  : kind === "quit"
                    ? "This ends your battle participation and records you as having quit."
                    : "This closes the battle before a rated result is recorded."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {(isDuckedReport || (kind === "forfeited" && isAdmin)) && (
              <div className="space-y-2">
                <label
                  className="font-semibold text-xs"
                  htmlFor="affected-artist"
                >
                  {kind === "forfeited"
                    ? "Forfeiting artist"
                    : "No-showing artist"}
                </label>
                <Select
                  disabled={!isAdmin}
                  onValueChange={setAffectedUserId}
                  value={affectedUserId ?? undefined}
                >
                  <SelectTrigger id="affected-artist">
                    <SelectValue placeholder="Choose an artist" />
                  </SelectTrigger>
                  <SelectContent className="[&_[data-highlighted]]:bg-muted [&_[data-highlighted]]:text-foreground">
                    {artists
                      .filter(
                        (artist) => isAdmin || artist.id !== currentUserId
                      )
                      .map((artist) => (
                        <SelectItem key={artist.id} value={artist.id}>
                          {artist.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {!isAdmin && (
                  <p className="text-[11px] text-muted-foreground">
                    Only the other artist can be reported as a no-show.
                  </p>
                )}
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
              variant={
                kind === "forfeited" || kind === "quit"
                  ? "destructive"
                  : "default"
              }
            >
              {pending
                ? "Saving..."
                : isDuckedReport
                  ? "Record duck"
                  : kind === "quit"
                    ? "Quit battle"
                    : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
