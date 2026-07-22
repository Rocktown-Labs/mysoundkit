"use client";

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bot,
  CheckCircle2,
  Music2,
  Radio,
  Search,
  ShieldCheck,
  Swords,
  Users,
} from "lucide-react";
import type React from "react";
import { useState } from "react";

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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  battlePhaseTransitions,
  liveExperienceConfigs,
  realtimeKitAlwaysOn,
} from "@/lib/live-experience";
import type { LiveScheduleMode } from "@/lib/live-experience";
import { musicGenres } from "@/lib/music-genres";
import { useCreateBattleChallengeMutation } from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/live/challenge")({
  component: ChallengePage,
  validateSearch: (search) => ({
    opponent: typeof search.opponent === "string" ? search.opponent : "",
  }),
});

const suggestedArtists = [
  {
    available: "Tonight",
    followers: "12.5K",
    genre: "Hip Hop",
    name: "Metro Flow",
    readiness: "Kit ready",
    username: "metro_flow",
  },
  {
    available: "Open this week",
    followers: "8.2K",
    genre: "Electronic",
    name: "Neon Pulse",
    readiness: "Accepts challenges",
    username: "neon_pulse",
  },
  {
    available: "Friday",
    followers: "15.1K",
    genre: "R&B/Soul",
    name: "Luna Eclipse",
    readiness: "Kit ready",
    username: "luna_eclipse",
  },
];

const battleKits = [
  {
    format: "Best of 5",
    readyTracks: 5,
    title: "Club Knockouts",
  },
  {
    format: "Best of 3",
    readyTracks: 3,
    title: "Radio Singles",
  },
];

function ChallengePage() {
  const { opponent } = Route.useSearch();
  const [searchQuery, setSearchQuery] = useState(opponent);
  const [scheduleMode, setScheduleMode] = useState<LiveScheduleMode>("asap");
  const createChallenge = useCreateBattleChallengeMutation();
  const battleConfig = liveExperienceConfigs.battle;

  const submitChallenge = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const opponentUsername =
      searchQuery.trim() || String(form.get("opponentUsername") ?? "").trim();

    if (!opponentUsername) {
      toast({
        description: "Choose an artist or enter a username to challenge.",
        title: "Opponent required",
        variant: "destructive",
      });
      return;
    }

    createChallenge.mutate(
      {
        format: String(form.get("format") ?? "best_of_5") as
          | "best_of_3"
          | "best_of_5"
          | "best_of_7",
        genre: String(form.get("genre") ?? "hip-hop"),
        message: String(form.get("message") ?? ""),
        opponentUsername,
        proposedDate:
          scheduleMode === "scheduled"
            ? String(form.get("proposedDate") ?? "")
            : undefined,
        proposedTimeLabel:
          scheduleMode === "scheduled"
            ? String(form.get("proposedTimeLabel") ?? "")
            : "ASAP",
      },
      {
        onSuccess: () => {
          toast({
            description:
              "BattleBot will notify the artist and prepare the lobby flow.",
            title: "Challenge sent",
          });
          event.currentTarget.reset();
        },
      }
    );
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-3 font-[family-name:var(--font-playfair)] text-3xl font-bold">
            <Swords className="size-7 text-primary" />
            Battle Requests
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Challenge artists, enter matching, and let BattleBot run the room,
            lobby, rounds, votes, and notifications.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/live/battles">Open Public Battles</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard icon={Swords} label="BattleBot" value="Ready" />
        <MetricCard
          icon={Music2}
          label="Ready Kits"
          value={battleKits.length}
        />
        <MetricCard icon={Users} label="Candidate Pool" value="32" />
        <MetricCard icon={Radio} label="Realtime Chat" value="Always on" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <main className="flex flex-col gap-6">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Create Battle</CardTitle>
              <CardDescription>
                Kit first, then opponent or matching, then schedule and lobby.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
              <form className="flex flex-col gap-5" onSubmit={submitChallenge}>
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="opponentUsername">Opponent</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          className="pl-10"
                          id="opponentUsername"
                          name="opponentUsername"
                          onChange={(event) =>
                            setSearchQuery(event.target.value)
                          }
                          placeholder="Search by artist username"
                          value={searchQuery}
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <FieldSelect
                        defaultValue="club-knockouts"
                        label="Battle Kit"
                        name="battleKit"
                        options={battleKits.map((kit) => ({
                          label: `${kit.title} (${kit.readyTracks} tracks)`,
                          value: kit.title.toLowerCase().replaceAll(" ", "-"),
                        }))}
                      />
                      <FieldSelect
                        defaultValue="best_of_5"
                        label="Format"
                        name="format"
                        options={[
                          { label: "Best of 3", value: "best_of_3" },
                          { label: "Best of 5", value: "best_of_5" },
                          { label: "Best of 7", value: "best_of_7" },
                        ]}
                      />
                    </div>

                    <FieldSelect
                      defaultValue="hip-hop"
                      label="Genre"
                      name="genre"
                      options={musicGenres.map((genre) => ({
                        label: genre.label,
                        value: genre.value,
                      }))}
                    />

                    <div className="flex flex-col gap-2">
                      <Label>Start</Label>
                      <RadioGroup
                        className="grid gap-3 sm:grid-cols-2"
                        onValueChange={(value) =>
                          setScheduleMode(value as LiveScheduleMode)
                        }
                        value={scheduleMode}
                      >
                        <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-4">
                          <RadioGroupItem value="asap" />
                          <span>
                            <span className="block font-medium">ASAP</span>
                            <span className="text-muted-foreground text-sm">
                              Open matching now
                            </span>
                          </span>
                        </label>
                        <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-4">
                          <RadioGroupItem value="scheduled" />
                          <span>
                            <span className="block font-medium">Schedule</span>
                            <span className="text-muted-foreground text-sm">
                              Propose a time
                            </span>
                          </span>
                        </label>
                      </RadioGroup>
                    </div>

                    {scheduleMode === "scheduled" && (
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="proposedDate">Proposed date</Label>
                          <Input
                            id="proposedDate"
                            name="proposedDate"
                            type="date"
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="proposedTimeLabel">
                            Proposed time
                          </Label>
                          <Input
                            id="proposedTimeLabel"
                            name="proposedTimeLabel"
                            placeholder="8:00 PM CT"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="message">Challenge message</Label>
                      <Textarea
                        id="message"
                        name="message"
                        placeholder="Tell them what kind of battle you want."
                        rows={4}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    <InfoPanel
                      icon={Bot}
                      title="BattleBot handoff"
                      items={[
                        "Creates the active battle and next-round lobby",
                        "Moves waiting viewers between rounds",
                        "Snapshots eligible voters per round",
                        "Sends artist and fan notification CTAs",
                      ]}
                    />
                    <InfoPanel
                      icon={ShieldCheck}
                      title="Session lock"
                      items={[
                        "Artists cannot hold overlapping live roles",
                        "Battle locks run from matching through completion",
                        "Crashed tabs recover through heartbeat expiry",
                      ]}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <Badge variant="outline">{battleConfig.roomLabel}</Badge>
                  <Button disabled={createChallenge.isPending} type="submit">
                    <Swords className="mr-2 size-4" />
                    {createChallenge.isPending
                      ? "Sending..."
                      : "Send Challenge"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Matching Candidates</CardTitle>
              <CardDescription>
                Artists who are ready for a kit-based battle request.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              {suggestedArtists.map((artist) => (
                <button
                  className="rounded-lg border p-4 text-left transition hover:bg-muted/50"
                  key={artist.username}
                  onClick={() => setSearchQuery(artist.username)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-3">
                    <Music2 className="size-5 text-primary" />
                    <Badge variant="outline">{artist.available}</Badge>
                  </div>
                  <p className="mt-4 font-semibold">{artist.name}</p>
                  <p className="text-muted-foreground text-sm">
                    @{artist.username}
                  </p>
                  <p className="mt-3 text-muted-foreground text-xs">
                    {artist.genre} - {artist.followers} followers
                  </p>
                  <p className="mt-2 text-primary text-xs">
                    {artist.readiness}
                  </p>
                </button>
              ))}
            </CardContent>
          </Card>
        </main>

        <aside className="flex flex-col gap-4">
          <RealtimeConstantsPanel />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Battle Phases</CardTitle>
              <CardDescription>
                Explicit states keep votes, joining, and notifications lean.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {Object.entries(battlePhaseTransitions).map(([phase, next]) => (
                <div className="rounded-lg border p-3 text-sm" key={phase}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">
                      {phase.replaceAll("_", " ")}
                    </span>
                    <Badge variant="outline">{next.length}</Badge>
                  </div>
                  <p className="mt-1 text-muted-foreground text-xs">
                    {next.length > 0
                      ? `Next: ${next.join(", ").replaceAll("_", " ")}`
                      : "Terminal state"}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function FieldSelect({
  defaultValue,
  label,
  name,
  options,
}: {
  defaultValue: string;
  label: string;
  name: string;
  options: { label: string; value: string }[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Select defaultValue={defaultValue} name={name}>
        <SelectTrigger id={name}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function InfoPanel({
  icon: Icon,
  items,
  title,
}: {
  icon: typeof Bot;
  items: string[];
  title: string;
}) {
  return (
    <Card className="bg-muted/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {items.map((item) => (
          <div className="flex items-start gap-2 text-sm" key={item}>
            <CheckCircle2 className="mt-0.5 size-4 text-primary" />
            <span className="text-muted-foreground">{item}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function RealtimeConstantsPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">RealtimeKit Defaults</CardTitle>
        <CardDescription>
          These are platform constants for every battle.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {Object.entries(realtimeKitAlwaysOn).map(([key]) => (
          <div
            className="flex items-center justify-between rounded-lg border p-3"
            key={key}
          >
            <span className="capitalize">{formatRealtimeLabel(key)}</span>
            <Badge>On</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function formatRealtimeLabel(value: string) {
  return value
    .replaceAll(/(?<capitalLetter>[A-Z])/gu, " $<capitalLetter>")
    .trim();
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Swords;
  label: string;
  value: number | string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-5" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-3xl font-bold">{value}</CardContent>
    </Card>
  );
}
