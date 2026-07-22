"use client";

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  MapPin,
  Music,
  Plus,
  Search,
  Swords,
  Trophy,
  UserCheck,
  UserX,
} from "lucide-react";
import type React from "react";
import { useState } from "react";

import { LiveExperienceAuthGuard } from "@/components/dashboard/live-experience-auth-guard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  useBattlesQuery,
  useCreateBattleChallengeMutation,
  useMeQuery,
  useTracksQuery,
} from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/live/")({
  component: BattleHubPage,
});

interface BattleRequestItem {
  format: string;
  genre: string;
  id: string;
  message: string;
  opponentUsername: string;
  proposedDate?: string;
  proposedTimeLabel?: string;
  senderUsername: string;
  status: "pending" | "confirmed" | "denied";
}

const initialIncomingRequests: BattleRequestItem[] = [
  {
    format: "Best of 5",
    genre: "Hip-Hop",
    id: "req_in_1",
    message: "Let's bring our best 5 tracks to the main stage tonight!",
    opponentUsername: "you",
    proposedDate: "2026-07-25",
    proposedTimeLabel: "9:00 PM ET",
    senderUsername: "metro_flow",
    status: "pending",
  },
  {
    format: "Best of 3",
    genre: "R&B/Soul",
    id: "req_in_2",
    message: "Quick 3-round soul clash this Friday.",
    opponentUsername: "you",
    proposedDate: "2026-07-26",
    proposedTimeLabel: "8:00 PM ET",
    senderUsername: "luna_eclipse",
    status: "pending",
  },
];

const candidateArtists = [
  {
    genre: "Hip-Hop",
    name: "Metro Flow",
    status: "Open to Battle",
    username: "metro_flow",
  },
  {
    genre: "Electronic",
    name: "Neon Pulse",
    status: "Open to Battle",
    username: "neon_pulse",
  },
  {
    genre: "R&B/Soul",
    name: "Luna Eclipse",
    status: "Kit Ready",
    username: "luna_eclipse",
  },
  {
    genre: "Pop",
    name: "Starlet Beat",
    status: "Open to Battle",
    username: "starlet_beat",
  },
];

function BattleHubPage() {
  const meQuery = useMeQuery();
  const tracksQuery = useTracksQuery();
  const battlesQuery = useBattlesQuery();
  const createChallenge = useCreateBattleChallengeMutation();

  const userOnboardingGenre = meQuery.data?.user.onboardingGenre || "hip-hop";
  const userTracks = tracksQuery.data ?? [];
  const hasNoTracksOrKits = userTracks.length === 0;

  const [selectedGenre, setSelectedGenre] =
    useState<string>(userOnboardingGenre);
  const [selectedFormat, setSelectedFormat] = useState<string>("best_of_5");
  const [targetUsername, setTargetUsername] = useState<string>("");
  const [incomingRequests, setIncomingRequests] = useState<BattleRequestItem[]>(
    initialIncomingRequests
  );
  const [outgoingRequests, setOutgoingRequests] = useState<BattleRequestItem[]>(
    []
  );
  const [opponentMode, setOpponentMode] = useState<"direct" | "match">(
    "direct"
  );

  const battles = battlesQuery.data ?? [];
  const liveBattles = battles.filter((battle) => battle.status === "live");
  const scheduledBattles = battles.filter(
    (battle) => battle.status === "scheduled"
  );

  const handleConfirmRequest = (id: string) => {
    setIncomingRequests((current) =>
      current.map((req) =>
        req.id === id ? { ...req, status: "confirmed" } : req
      )
    );
    toast({
      description:
        "Battle confirmed! Matchup scheduled and notifications fanned out to followers.",
      title: "Challenge Confirmed",
    });
  };

  const handleDenyRequest = (id: string) => {
    setIncomingRequests((current) =>
      current.map((req) => (req.id === id ? { ...req, status: "denied" } : req))
    );
    toast({
      description: "Battle challenge request declined.",
      title: "Challenge Denied",
    });
  };

  const submitChallenge = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const opponent =
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

    const proposedDate = String(form.get("proposedDate") ?? "");
    const proposedTimeLabel = String(form.get("proposedTimeLabel") ?? "");
    const message = String(form.get("message") ?? "");

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
          const newReq: BattleRequestItem = {
            format: selectedFormat,
            genre: selectedGenre,
            id: `req_out_${Date.now()}`,
            message,
            opponentUsername: opponent,
            proposedDate,
            proposedTimeLabel,
            senderUsername: meQuery.data?.user.username || "me",
            status: "pending",
          };
          setOutgoingRequests((current) => [newReq, ...current]);
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
              incomingRequests.filter((r) => r.status === "pending").length
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
                        incomingRequests.filter((r) => r.status === "pending")
                          .length
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
                                @{req.senderUsername}
                              </p>
                              <Badge
                                variant={
                                  req.status === "confirmed"
                                    ? "default"
                                    : (req.status === "denied"
                                      ? "destructive"
                                      : "outline")
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
                                size="sm"
                                onClick={() => handleConfirmRequest(req.id)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                              >
                                <UserCheck className="mr-1.5 size-4" /> Confirm
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDenyRequest(req.id)}
                              >
                                <UserX className="mr-1.5 size-4" /> Deny
                              </Button>
                            </div>
                          ) : (
                            <Button asChild size="sm" variant="outline">
                              <Link to="/live/battles">View Details</Link>
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
                          className="flex items-center justify-between gap-4 rounded-lg border p-4"
                        >
                          <div>
                            <p className="font-semibold">
                              To: @{req.opponentUsername}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {req.genre} &bull;{" "}
                              {req.format.replaceAll("_", " ")}
                            </p>
                          </div>
                          <Badge variant="outline">{req.status}</Badge>
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
                  {battles.map((battle) => (
                    <div
                      className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                      key={battle.id}
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{battle.title}</p>
                          <Badge
                            variant={
                              battle.status === "live"
                                ? "destructive"
                                : "outline"
                            }
                          >
                            {battle.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {battle.genre} &bull;{" "}
                          {battle.format.replaceAll("_", " ")} &bull;{" "}
                          {battle.viewerCount.toLocaleString()} viewers
                        </p>
                      </div>
                      <Button asChild className="w-full sm:w-auto">
                        <Link params={{ id: battle.id }} to="/live/battles/$id">
                          {battle.status === "live"
                            ? "Join Battle"
                            : "View Room"}
                        </Link>
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
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
                        {musicGenres.map((g) => (
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

                  {/* Opponent Selection Mode */}
                  <div className="space-y-2 pt-2">
                    <Label>Opponent Selection</Label>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={
                          opponentMode === "direct" ? "default" : "outline"
                        }
                        onClick={() => setOpponentMode("direct")}
                      >
                        By Username
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={
                          opponentMode === "match" ? "default" : "outline"
                        }
                        onClick={() => setOpponentMode("match")}
                      >
                        Open Artists
                      </Button>
                    </div>

                    {opponentMode === "direct" ? (
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="opponentUsername"
                          name="opponentUsername"
                          className="pl-9"
                          placeholder="Search @username"
                          value={targetUsername}
                          onChange={(e) => setTargetUsername(e.target.value)}
                        />
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto rounded-md border p-2 bg-muted/20">
                        {candidateArtists.map((artist) => (
                          <div
                            key={artist.username}
                            onClick={() => setTargetUsername(artist.username)}
                            className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors text-xs ${
                              targetUsername === artist.username
                                ? "bg-primary/20 border border-primary/40 font-medium"
                                : "hover:bg-accent"
                            }`}
                          >
                            <div>
                              <p className="font-semibold">{artist.name}</p>
                              <p className="text-muted-foreground">
                                @{artist.username} &bull; {artist.genre}
                              </p>
                            </div>
                            <Badge variant="outline">{artist.status}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="proposedDate">Date</Label>
                      <Input
                        id="proposedDate"
                        name="proposedDate"
                        type="date"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="proposedTimeLabel">Time</Label>
                      <Input
                        id="proposedTimeLabel"
                        name="proposedTimeLabel"
                        placeholder="8:00 PM ET"
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

            <QuickLink
              description="Preset your strongest tracks for live formats."
              icon={Music}
              label="My Kits"
              to="/dashboard/live/my-kit"
            />
            <QuickLink
              description="Wins, losses, and track battle analytics."
              icon={BarChart3}
              label="My Stats"
              to="/dashboard/live/my-stats"
            />
            <QuickLink
              description="Explore public battle arenas."
              icon={MapPin}
              label="Explore Public Battles"
              to="/live/battles"
            />
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

function QuickLink({
  description,
  icon: Icon,
  label,
  to,
}: {
  description: string;
  icon: typeof Music;
  label: string;
  to: "/dashboard/live/my-kit" | "/dashboard/live/my-stats" | "/live/battles";
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Icon className="size-5 text-primary" />
          <CardTitle className="text-base">{label}</CardTitle>
        </div>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <Button asChild className="w-full" variant="outline" size="sm">
          <Link to={to}>Open</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
