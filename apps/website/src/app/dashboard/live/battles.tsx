"use client";

import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  AlertCircle,
  Flag,
  MoreHorizontal,
  Music,
  Plus,
  Search,
  Share2,
  Swords,
  Trash2,
  Trophy,
  UserCheck,
  UserX,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";

import { LiveExperienceAuthGuard } from "@/components/dashboard/live-experience-auth-guard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  clearBattleKitSelection,
  readBattleKitSelection,
  rememberBattleKitSelection,
} from "@/lib/battle-kit-selection";
import {
  useDbBattleActions,
  useDbBattleChallenges,
  useDbBattles,
} from "@/lib/data-db";
import { musicGenres } from "@/lib/music-genres";
import { absoluteSiteUrl } from "@/lib/seo";
import { shareLink } from "@/lib/share";
import type { BattleSummary } from "@/lib/soundkit-api-hooks";
import {
  useBattleKitsQuery,
  useBattleOpponentsQuery,
  useDeleteLiveExperienceMutation,
  useGenresQuery,
  useMeQuery,
  useTracksQuery,
} from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/live/battles")({
  component: BattleRoutePage,
});

function BattleRoutePage() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return pathname.includes("/join/") ? <Outlet /> : <BattleHubPage />;
}

function BattleHubPage() {
  const meQuery = useMeQuery(),
    tracksQuery = useTracksQuery(),
    battlesDb = useDbBattles(),
    battleChallengesDb = useDbBattleChallenges(),
    battleKitsQuery = useBattleKitsQuery(),
    genresQuery = useGenresQuery(),
    deleteExperience = useDeleteLiveExperienceMutation(),
    { clearChallenge, createChallenge, deleteBattle, updateChallenge } =
      useDbBattleActions(),
    [cancellingBattleId, setCancellingBattleId] = useState<string | null>(null),
    [confirmText, setConfirmText] = useState(""),
    [deletingBattleId, setDeletingBattleId] = useState<string | null>(null),
    [pendingChallengeId, setPendingChallengeId] = useState<string | null>(null),
    [creatingChallenge, setCreatingChallenge] = useState(false),
    [selectedBattleKitId, setSelectedBattleKitId] = useState<string | null>(
      () => readBattleKitSelection()?.kitId ?? null
    ),
    battles = battlesDb.data,
    selectedBattleKit = battleKitsQuery.data?.find(
      (kit) => kit.id === selectedBattleKitId
    ),
    targetBattle = battles.find((battle) => battle.id === cancellingBattleId),
    availableGenres =
      genresQuery.data && genresQuery.data.length > 0
        ? genresQuery.data.map((g) => ({ label: g.name, value: g.slug }))
        : musicGenres,
    defaultGenre = availableGenres[0]?.value ?? "hip-hop",
    userTracks = tracksQuery.data ?? [],
    hasNoTracksOrKits = userTracks.length === 0,
    [selectedGenre, setSelectedGenre] = useState<string>(defaultGenre),
    [selectedFormat, setSelectedFormat] = useState<string>("best_of_5"),
    [targetUsername, setTargetUsername] = useState<string>(""),
    artistsQuery = useBattleOpponentsQuery({
      genre: selectedGenre,
      q: targetUsername,
    }),
    handleCancelBattle = async (id: string) => {
      const battle = battles.find((candidate) => candidate.id === id);
      if (!battle) {
        return;
      }

      setDeletingBattleId(id);
      try {
        if (battle.status === "live") {
          await deleteExperience.mutateAsync(id);
        } else {
          await deleteBattle(id).isPersisted.promise;
        }
        toast({
          description: "Battle matchup has been removed.",
          title: "Battle cancelled",
        });
      } catch {
        toast({
          description: "Failed to forfeit/cancel battle. Please try again.",
          title: "Action failed",
          variant: "destructive",
        });
      }
      setDeletingBattleId(null);
    },
    handleShareBattle = async (battle: BattleSummary) => {
      const senderUsername = meQuery.data?.user.username;
      if (!senderUsername) {
        toast({
          description: "Your artist profile is still being set up.",
          title: "Unable to share battle",
          variant: "destructive",
        });
        return;
      }

      const shareUrl = absoluteSiteUrl(
          `/live/battles/${battle.id}?ref=${encodeURIComponent(senderUsername)}`
        ),
        participantNames = battle.participants
          .map((participant) => participant.name)
          .join(" vs "),
        shareText = participantNames
          ? `${participantNames} are battling on SoundKit. Join the waiting room.`
          : `${battle.title} is coming up on SoundKit. Join the waiting room.`,
        outcome = await shareLink({
          text: shareText,
          title: `${battle.title} is coming up on SoundKit`,
          url: shareUrl,
        });

      if (outcome === "unsupported") {
        toast({
          description: "Sharing is not supported on this device.",
          title: "Unable to share battle",
          variant: "destructive",
        });
        return;
      }

      toast({
        description:
          outcome === "copied"
            ? "Battle invite link copied to your clipboard."
            : "Battle invite ready to share.",
        title: "Battle shared",
      });
    };

  useEffect(() => {
    setSelectedGenre((current) => current || defaultGenre);
  }, [defaultGenre]);

  const incomingRequests = battleChallengesDb.data.filter(
      (challenge) =>
        challenge.direction === "incoming" && challenge.status !== "accepted"
    ),
    outgoingRequests = battleChallengesDb.data.filter(
      (challenge) =>
        challenge.direction === "outgoing" && challenge.status !== "accepted"
    ),
    candidateArtists = artistsQuery.data ?? [],
    liveBattles = battles.filter((battle) => battle.status === "live"),
    scheduledBattles = battles.filter(
      (battle) => battle.status === "scheduled"
    ),
    runChallengeUpdate = async ({
      challengeId,
      description,
      status,
      title,
    }: {
      challengeId: string;
      description: string;
      status: "accepted" | "canceled" | "declined";
      title: string;
    }) => {
      setPendingChallengeId(challengeId);
      try {
        await updateChallenge({ challengeId, status }).isPersisted.promise;
        toast({ description, title });
      } catch {
        toast({
          description: "The request could not be updated. Please try again.",
          title: "Request update failed",
          variant: "destructive",
        });
      }
      setPendingChallengeId(null);
    },
    handleConfirmRequest = (id: string) => {
      void runChallengeUpdate({
        challengeId: id,
        description: "Battle challenge accepted.",
        status: "accepted",
        title: "Challenge Accepted",
      });
    },
    handleDenyRequest = (id: string) => {
      void runChallengeUpdate({
        challengeId: id,
        description: "Battle challenge request declined.",
        status: "declined",
        title: "Challenge Declined",
      });
    },
    handleCancelRequest = (id: string) => {
      void runChallengeUpdate({
        challengeId: id,
        description: "The outgoing battle request was canceled.",
        status: "canceled",
        title: "Request Canceled",
      });
    },
    handleClearRequest = async (id: string) => {
      setPendingChallengeId(id);
      try {
        await clearChallenge(id).isPersisted.promise;
        toast({
          description: "The old battle request was cleared.",
          title: "Request Cleared",
        });
      } catch {
        toast({
          description: "The request could not be cleared. Please try again.",
          title: "Clear failed",
          variant: "destructive",
        });
      }
      setPendingChallengeId(null);
    },
    submitChallenge = (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formElement = event.currentTarget,
        form = new FormData(formElement),
        opponent =
          targetUsername.trim() ||
          String(form.get("opponentUsername") ?? "").trim(),
        normalizedOpponent = opponent.replace(/^@+/u, "");

      if (!normalizedOpponent) {
        toast({
          description: "Choose or search for an artist to challenge.",
          title: "Opponent Required",
          variant: "destructive",
        });
        return;
      }

      const proposedDateValue = String(form.get("proposedDate") ?? ""),
        proposedTimeValue = String(form.get("proposedTime") ?? ""),
        proposedDateTime =
          proposedDateValue && proposedTimeValue
            ? new Date(`${proposedDateValue}T${proposedTimeValue}`)
            : null,
        proposedDate =
          proposedDateTime && !Number.isNaN(proposedDateTime.getTime())
            ? proposedDateTime.toISOString()
            : "",
        proposedTimeLabel = proposedDateTime
          ? proposedDateTime.toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })
          : "",
        message = String(form.get("message") ?? ""),
        format = selectedFormat as "best_of_3" | "best_of_5" | "best_of_7",
        createdAt = new Date().toISOString(),
        optimistic = {
          challengerUsername: meQuery.data?.user.username ?? null,
          createdAt,
          direction: "outgoing" as const,
          expiresAt: new Date(
            Date.parse(createdAt) + 7 * 24 * 60 * 60 * 1000
          ).toISOString(),
          format,
          genre: selectedGenre,
          id: crypto.randomUUID(),
          message: message || null,
          opponentUsername: normalizedOpponent,
          proposedDate: proposedDate || null,
          proposedTimeLabel: proposedTimeLabel || null,
          status: "pending" as const,
        };

      if (selectedBattleKitId) {
        rememberBattleKitSelection({
          kitId: selectedBattleKitId,
          opponentUsername: normalizedOpponent.toLowerCase(),
        });
      }

      void (async () => {
        setCreatingChallenge(true);
        try {
          await createChallenge({
            body: {
              format,
              genre: selectedGenre,
              message,
              opponentUsername: normalizedOpponent,
              proposedDate,
              proposedTimeLabel,
            },
            optimistic,
          }).isPersisted.promise;
          toast({
            description: `Battle challenge request sent to @${normalizedOpponent}.`,
            title: "Challenge Sent",
          });
          setTargetUsername("");
          formElement.reset();
        } catch {
          toast({
            description: "The challenge could not be sent. Please try again.",
            title: "Challenge failed",
            variant: "destructive",
          });
        }
        setCreatingChallenge(false);
      })();
    };

  return (
    <LiveExperienceAuthGuard
      actionLabel="create battle requests, start challenges, or compete in live battles"
      featureTitle="Live Battles Studio"
      requiredEntitlement="canCreateLiveBattles"
    >
      <div className="space-y-6 p-4 md:p-6 lg:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-[family-name:var(--font-playfair)] text-4xl font-bold">
              Battles
            </h1>
            <p className="text-muted-foreground mt-1">
              Start challenges, join live battles, and manage your battle kits.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/dashboard/live/my-kit">
                <Music className="mr-2 size-4" />
                My Kits
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/dashboard/live/parties">Parties</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/dashboard/live/streams">Streams</Link>
            </Button>
          </div>
        </div>

        {/* Warn if user has no tracks or kits */}
        {hasNoTracksOrKits && (
          <Alert
            variant="destructive"
            className="border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200"
          >
            <AlertCircle className="size-5 text-amber-500" />
            <AlertTitle className="font-semibold">
              No Battle Kits or Tracks Found
            </AlertTitle>
            <AlertDescription className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>
                You currently have no tracks uploaded or battle kits created. In
                the battle phase you must select a ready kit to compete.
              </span>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="shrink-0 border-amber-500/50"
              >
                <Link to="/dashboard/live/my-kit">
                  <Plus className="mr-2 size-4" /> Build My Kit
                </Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Total Battles" value={battles.length} />
          <MetricCard label="Live Now" value={liveBattles.length} />
          <MetricCard label="Scheduled" value={scheduledBattles.length} />
          <MetricCard
            label="Pending Requests"
            value={
              incomingRequests.filter((request) => request.status === "pending")
                .length
            }
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <main className="space-y-6">
            {/* Incoming & Outgoing Requests */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Swords className="size-5 text-primary" />
                  Battle Requests & Challenges
                </CardTitle>
                <CardDescription>
                  Review incoming challenge requests or check status of sent
                  requests.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="incoming">
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="incoming">
                      Incoming (
                      {
                        incomingRequests.filter(
                          (request) => request.status === "pending"
                        ).length
                      }
                      )
                    </TabsTrigger>
                    <TabsTrigger value="outgoing">
                      Outgoing ({outgoingRequests.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="incoming" className="space-y-3">
                    {incomingRequests.length === 0 ? (
                      <p className="text-center py-6 text-sm text-muted-foreground">
                        No incoming battle requests at this time.
                      </p>
                    ) : (
                      incomingRequests.map((req) => (
                        <div
                          key={req.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border p-4"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-base">
                                @{req.challengerUsername ?? "artist"}
                              </p>
                              <Badge
                                variant={
                                  req.status === "accepted"
                                    ? "default"
                                    : req.status === "declined"
                                      ? "destructive"
                                      : "outline"
                                }
                              >
                                {req.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {req.genre} &bull;{" "}
                              {req.format.replaceAll("_", " ")}{" "}
                              {req.proposedTimeLabel
                                ? `&bull; ${req.proposedTimeLabel}`
                                : ""}
                            </p>
                            {req.message && (
                              <p className="text-xs text-muted-foreground italic mt-1">
                                &ldquo;{req.message}&rdquo;
                              </p>
                            )}
                          </div>
                          {req.status === "pending" ? (
                            <div className="flex gap-2">
                              <Button
                                disabled={pendingChallengeId === req.id}
                                size="sm"
                                onClick={() => handleConfirmRequest(req.id)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                              >
                                <UserCheck className="mr-1.5 size-4" /> Confirm
                              </Button>
                              <Button
                                disabled={pendingChallengeId === req.id}
                                size="sm"
                                variant="outline"
                                onClick={() => handleDenyRequest(req.id)}
                              >
                                <UserX className="mr-1.5 size-4" /> Deny
                              </Button>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <Button asChild size="sm" variant="outline">
                                <Link
                                  search={{
                                    genre: undefined,
                                    region: undefined,
                                    regionType: "north-america",
                                    sort: undefined,
                                  }}
                                  to="/live/battles"
                                >
                                  View Details
                                </Link>
                              </Button>
                              {req.status === "accepted" ? null : (
                                <Button
                                  disabled={pendingChallengeId === req.id}
                                  onClick={() => handleClearRequest(req.id)}
                                  size="sm"
                                  variant="outline"
                                >
                                  <Trash2 className="mr-1.5 size-4" />
                                  Clear
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </TabsContent>

                  <TabsContent value="outgoing" className="space-y-3">
                    {outgoingRequests.length === 0 ? (
                      <p className="text-center py-6 text-sm text-muted-foreground">
                        You have not sent any challenge requests yet.
                      </p>
                    ) : (
                      outgoingRequests.map((req) => (
                        <div
                          key={req.id}
                          className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold">
                                To: @{req.opponentUsername ?? "artist"}
                              </p>
                              <Badge variant="outline">{req.status}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {req.genre} &bull;{" "}
                              {req.format.replaceAll("_", " ")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {req.status === "pending"
                                ? `Expires ${new Date(req.expiresAt).toLocaleDateString()}`
                                : `Sent ${new Date(req.createdAt).toLocaleDateString()}`}
                            </p>
                          </div>
                          {req.status === "pending" ? (
                            <Button
                              className="shrink-0"
                              disabled={pendingChallengeId === req.id}
                              onClick={() => handleCancelRequest(req.id)}
                              size="sm"
                              variant="outline"
                            >
                              <Trash2 className="mr-1.5 size-4" />
                              Cancel Request
                            </Button>
                          ) : req.status !== "accepted" ? (
                            <Button
                              className="shrink-0"
                              disabled={pendingChallengeId === req.id}
                              onClick={() => handleClearRequest(req.id)}
                              size="sm"
                              variant="outline"
                            >
                              <Trash2 className="mr-1.5 size-4" />
                              Clear
                            </Button>
                          ) : null}
                        </div>
                      ))
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Battle Feed */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="size-5 text-primary" />
                  Live &amp; Scheduled Battles
                </CardTitle>
                <CardDescription>
                  Explore active matchups from the SoundKit community.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {battlesDb.isLoading && (
                  <p className="text-sm text-muted-foreground">
                    Loading battles...
                  </p>
                )}

                {!battlesDb.isLoading && battles.length === 0 && (
                  <div className="rounded-lg border border-dashed p-8 text-center">
                    <p className="font-semibold">No battles yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Create a challenge to start your first matchup.
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  {battles.map((battle) => {
                    const isLive = battle.status === "live",
                      isParticipant = Boolean(
                        meQuery.data?.user.id &&
                        battle.participants.some(
                          (participant) =>
                            participant.id === meQuery.data?.user.id
                        )
                      );
                    return (
                      <div
                        className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                        key={battle.id}
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold truncate">
                              {battle.title}
                            </p>
                            <Badge variant={isLive ? "destructive" : "outline"}>
                              {battle.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {battle.genre} &bull;{" "}
                            {battle.format.replaceAll("_", " ")} &bull;{" "}
                            {battle.viewerCount.toLocaleString()} viewers
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          <Button
                            asChild
                            className="w-full sm:w-auto"
                            size="sm"
                          >
                            {isParticipant ? (
                              <Link
                                onClick={() => {
                                  if (selectedBattleKitId) {
                                    rememberBattleKitSelection({
                                      battleId: battle.id,
                                      kitId: selectedBattleKitId,
                                    });
                                  }
                                }}
                                params={{ roomId: battle.id }}
                                to="/dashboard/live/battles/join/$roomId/artistview"
                              >
                                Enter Artist Room
                              </Link>
                            ) : (
                              <Link
                                params={{ id: battle.id }}
                                to="/live/battles/$id"
                              >
                                {isLive ? "Watch Live" : "View Room"}
                              </Link>
                            )}
                          </Button>
                          <Button
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            disabled={
                              deletingBattleId === battle.id ||
                              deleteExperience.isPending
                            }
                            onClick={() => {
                              setCancellingBattleId(battle.id);
                              setConfirmText("");
                            }}
                            size="sm"
                            variant="outline"
                          >
                            <Flag className="mr-1 size-3.5" />
                            {isLive ? "Forfeit" : "Cancel"}
                          </Button>
                          {isLive ? null : (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  aria-label={`More actions for ${battle.title}`}
                                  size="icon"
                                  variant="outline"
                                >
                                  <MoreHorizontal />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onSelect={() =>
                                    void handleShareBattle(battle)
                                  }
                                >
                                  <Share2 data-icon="inline-start" />
                                  Share upcoming battle
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Forfeit / Cancel Battle Confirmation Dialog */}
            <AlertDialog
              open={Boolean(cancellingBattleId)}
              onOpenChange={(open) => {
                if (!open) {
                  setCancellingBattleId(null);
                  setConfirmText("");
                }
              }}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {targetBattle?.status === "live"
                      ? "Forfeit Active Battle?"
                      : "Cancel Scheduled Battle?"}
                  </AlertDialogTitle>
                  <AlertDialogDescription className="space-y-2 text-sm">
                    <span>
                      {targetBattle?.status === "live"
                        ? `Forfeiting "${targetBattle?.title}" will immediately conclude the match and award the win to the opponent.`
                        : `Cancelling "${targetBattle?.title}" will delete the scheduled matchup room.`}
                    </span>
                    <span className="block font-medium text-foreground">
                      Type{" "}
                      <span className="font-mono font-bold text-destructive">
                        {targetBattle?.status === "live" ? "FORFEIT" : "CANCEL"}
                      </span>{" "}
                      to confirm:
                    </span>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="my-2">
                  <Input
                    autoFocus
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={`Type ${
                      targetBattle?.status === "live" ? "FORFEIT" : "CANCEL"
                    } to confirm`}
                    value={confirmText}
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Stay in Battle</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={
                      confirmText.trim() !==
                        (targetBattle?.status === "live"
                          ? "FORFEIT"
                          : "CANCEL") ||
                      deletingBattleId !== null ||
                      deleteExperience.isPending
                    }
                    onClick={() => {
                      if (cancellingBattleId) {
                        void handleCancelBattle(cancellingBattleId);
                        setCancellingBattleId(null);
                        setConfirmText("");
                      }
                    }}
                  >
                    {deletingBattleId !== null || deleteExperience.isPending
                      ? "Processing..."
                      : targetBattle?.status === "live"
                        ? "Confirm Forfeit"
                        : "Confirm Cancellation"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </main>

          {/* Wizard Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Start Battle Request</CardTitle>
                <CardDescription>
                  Pick format, genre, and challenge or match an artist.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={submitChallenge}>
                  {/* Genre Dropdown - Default to Onboarding Genre */}
                  <div className="space-y-2">
                    <Label htmlFor="genre">Battle Genre</Label>
                    <Select
                      value={selectedGenre}
                      onValueChange={setSelectedGenre}
                    >
                      <SelectTrigger id="genre">
                        <SelectValue placeholder="Select genre" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableGenres.map((g) => (
                          <SelectItem key={g.value} value={g.value}>
                            {g.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Battle Format */}
                  <div className="space-y-2">
                    <Label htmlFor="format">Battle Format</Label>
                    <Select
                      value={selectedFormat}
                      onValueChange={(value) => {
                        setSelectedFormat(value);
                        if (
                          selectedBattleKit &&
                          selectedBattleKit.format !== value
                        ) {
                          clearBattleKitSelection();
                          setSelectedBattleKitId(null);
                        }
                      }}
                    >
                      <SelectTrigger id="format">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="best_of_3">
                          Best of 3 (3 Tracks)
                        </SelectItem>
                        <SelectItem value="best_of_5">
                          Best of 5 (5 Tracks)
                        </SelectItem>
                        <SelectItem value="best_of_7">
                          Best of 7 (7 Tracks)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="battleKit">Battle Kit</Label>
                    <Select
                      value={selectedBattleKitId ?? "none"}
                      onValueChange={(value) => {
                        if (value === "none") {
                          clearBattleKitSelection();
                          setSelectedBattleKitId(null);
                          return;
                        }

                        const kit = battleKitsQuery.data?.find(
                          (candidate) => candidate.id === value
                        );
                        setSelectedBattleKitId(value);
                        rememberBattleKitSelection({ kitId: value });
                        if (kit) {
                          setSelectedFormat(kit.format);
                        }
                      }}
                    >
                      <SelectTrigger id="battleKit">
                        <SelectValue placeholder="Choose a kit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No kit selected</SelectItem>
                        {battleKitsQuery.data?.map((kit) => (
                          <SelectItem key={kit.id} value={kit.id}>
                            {kit.name} · {kit.format.replaceAll("_", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {selectedBattleKit
                        ? `${selectedBattleKit.name} will be ready when you enter your scheduled battle.`
                        : "Choose a ready kit to load automatically when you enter your scheduled battle."}
                    </p>
                  </div>

                  <div className="space-y-2 pt-2">
                    <Label htmlFor="opponentUsername">Opponent</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        autoComplete="off"
                        className="pl-9"
                        id="opponentUsername"
                        name="opponentUsername"
                        onChange={(event) =>
                          setTargetUsername(event.target.value)
                        }
                        placeholder="Type an artist name or @handle"
                        value={targetUsername}
                      />
                    </div>
                    {targetUsername.trim() ? (
                      <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border bg-muted/20 p-2">
                        {artistsQuery.isLoading ? (
                          <p className="p-2 text-muted-foreground text-xs">
                            Searching Premium artists…
                          </p>
                        ) : null}
                        {candidateArtists.map((artist) => (
                          <button
                            className={`flex w-full items-center justify-between rounded-md p-2 text-left text-xs transition-colors ${
                              targetUsername === artist.username
                                ? "border border-primary/40 bg-primary/20"
                                : "hover:bg-accent"
                            }`}
                            key={artist.username}
                            onClick={() =>
                              setTargetUsername(artist.username ?? "")
                            }
                            type="button"
                          >
                            <span>
                              <span className="block font-semibold">
                                {artist.name}
                              </span>
                              <span className="text-muted-foreground">
                                @{artist.username} · {artist.genre}
                              </span>
                            </span>
                            <Badge variant="outline">Select</Badge>
                          </button>
                        ))}
                        {!artistsQuery.isLoading &&
                        candidateArtists.length === 0 ? (
                          <p className="p-2 text-muted-foreground text-xs">
                            No matching artists found.
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="proposedDate">Date</Label>
                      <Input
                        id="proposedDate"
                        name="proposedDate"
                        required
                        type="date"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="proposedTime">Time</Label>
                      <Input
                        id="proposedTime"
                        name="proposedTime"
                        required
                        type="time"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">Message</Label>
                    <Textarea
                      id="message"
                      name="message"
                      placeholder="Set the tone for the matchup."
                      rows={2}
                    />
                  </div>

                  <Button className="w-full" disabled={creatingChallenge}>
                    <Trophy className="mr-2 size-4" />
                    {creatingChallenge
                      ? "Sending Request..."
                      : "Send Battle Request"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </LiveExperienceAuthGuard>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="font-medium text-muted-foreground text-sm">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-3xl font-bold">
        {value.toLocaleString()}
      </CardContent>
    </Card>
  );
}
