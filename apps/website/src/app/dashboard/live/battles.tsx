"use client";

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertCircle,
  Flag,
  Music,
  Plus,
  Search,
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
import { musicGenres } from "@/lib/music-genres";
import {
  useBattleChallengesQuery,
  useBattleOpponentsQuery,
  useBattlesQuery,
  useCreateBattleChallengeMutation,
  useDeleteLiveExperienceMutation,
  useGenresQuery,
  useMeQuery,
  useTracksQuery,
  useUpdateBattleChallengeMutation,
} from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/live/battles")({
  component: BattleHubPage,
});

function BattleHubPage() {
  const meQuery = useMeQuery(),
    tracksQuery = useTracksQuery(),
    battlesQuery = useBattlesQuery(),
    battleChallengesQuery = useBattleChallengesQuery(),
    genresQuery = useGenresQuery(),
    createChallenge = useCreateBattleChallengeMutation(),
    updateChallenge = useUpdateBattleChallengeMutation(),
    deleteExperience = useDeleteLiveExperienceMutation(),
    [cancellingBattleId, setCancellingBattleId] = useState<string | null>(null),
    [confirmText, setConfirmText] = useState(""),
    battles = battlesQuery.data ?? [],
    targetBattle = battles.find((b) => b.id === cancellingBattleId),
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
      try {
        await deleteExperience.mutateAsync(id);
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
    };

  useEffect(() => {
    setSelectedGenre((current) => current || defaultGenre);
  }, [defaultGenre]);

  const incomingRequests = battleChallengesQuery.data?.incoming ?? [],
    outgoingRequests = battleChallengesQuery.data?.outgoing ?? [],
    candidateArtists = artistsQuery.data ?? [],
    liveBattles = battles.filter((battle) => battle.status === "live"),
    scheduledBattles = battles.filter(
      (battle) => battle.status === "scheduled"
    ),
    handleConfirmRequest = (id: string) => {
      updateChallenge.mutate(
        { challengeId: id, status: "accepted" },
        {
          onSuccess: () => {
            toast({
              description: "Battle challenge accepted.",
              title: "Challenge Accepted",
            });
          },
        }
      );
    },
    handleDenyRequest = (id: string) => {
      updateChallenge.mutate(
        { challengeId: id, status: "declined" },
        {
          onSuccess: () => {
            toast({
              description: "Battle challenge request declined.",
              title: "Challenge Declined",
            });
          },
        }
      );
    },
    handleCancelRequest = (id: string) => {
      updateChallenge.mutate(
        { challengeId: id, status: "canceled" },
        {
          onError: () => {
            toast({
              description:
                "The request could not be canceled. Please try again.",
              title: "Cancellation failed",
              variant: "destructive",
            });
          },
          onSuccess: () => {
            toast({
              description: "The outgoing battle request was canceled.",
              title: "Request Canceled",
            });
          },
        }
      );
    },
    submitChallenge = (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget),
        opponent =
          targetUsername.trim() ||
          String(form.get("opponentUsername") ?? "").trim();

      if (!opponent) {
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
        message = String(form.get("message") ?? "");

      createChallenge.mutate(
        {
          format: selectedFormat as "best_of_3" | "best_of_5" | "best_of_7",
          genre: selectedGenre,
          message,
          opponentUsername: opponent,
          proposedDate,
          proposedTimeLabel,
        },
        {
          onSuccess: () => {
            toast({
              description: `Battle challenge request sent to @${opponent}.`,
              title: "Challenge Sent",
            });
            setTargetUsername("");
            event.currentTarget.reset();
          },
        }
      );
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
                                disabled={updateChallenge.isPending}
                                size="sm"
                                onClick={() => handleConfirmRequest(req.id)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                              >
                                <UserCheck className="mr-1.5 size-4" /> Confirm
                              </Button>
                              <Button
                                disabled={updateChallenge.isPending}
                                size="sm"
                                variant="outline"
                                onClick={() => handleDenyRequest(req.id)}
                              >
                                <UserX className="mr-1.5 size-4" /> Deny
                              </Button>
                            </div>
                          ) : (
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
                              disabled={updateChallenge.isPending}
                              onClick={() => handleCancelRequest(req.id)}
                              size="sm"
                              variant="outline"
                            >
                              <Trash2 className="mr-1.5 size-4" />
                              Cancel Request
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
                {battlesQuery.isLoading && (
                  <p className="text-sm text-muted-foreground">
                    Loading battles...
                  </p>
                )}

                {!battlesQuery.isLoading && battles.length === 0 && (
                  <div className="rounded-lg border border-dashed p-8 text-center">
                    <p className="font-semibold">No battles yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Create a challenge to start your first matchup.
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  {battles.map((battle) => {
                    const isLive = battle.status === "live";
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
                            <Link
                              params={{ id: battle.id }}
                              to="/live/battles/$id"
                            >
                              {isLive ? "Join Battle" : "View Room"}
                            </Link>
                          </Button>
                          <Button
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            disabled={deleteExperience.isPending}
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
                          : "CANCEL") || deleteExperience.isPending
                    }
                    onClick={() => {
                      if (cancellingBattleId) {
                        void handleCancelBattle(cancellingBattleId);
                        setCancellingBattleId(null);
                        setConfirmText("");
                      }
                    }}
                  >
                    {deleteExperience.isPending
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
                      onValueChange={setSelectedFormat}
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

                  <Button
                    className="w-full"
                    disabled={createChallenge.isPending}
                  >
                    <Trophy className="mr-2 size-4" />
                    {createChallenge.isPending
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
