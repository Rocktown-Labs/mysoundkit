"use client";

import { createFileRoute, Link } from "@tanstack/react-router";
import { Bot, Search, Swords, X } from "lucide-react";
import type React from "react";
import { useState } from "react";

import { LiveExperienceAuthGuard } from "@/components/dashboard/live-experience-auth-guard";
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
import { liveExperienceConfigs } from "@/lib/live-experience";
import type { LiveScheduleMode } from "@/lib/live-experience";
import {
  useCreateBattleChallengeMutation,
  useGenresQuery,
} from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/live/challenge")({
  component: ChallengePage,
  validateSearch: (search) => ({
    opponent: typeof search.opponent === "string" ? search.opponent : "",
  }),
});

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
  const { opponent } = Route.useSearch(),
   [searchQuery, setSearchQuery] = useState(opponent),
   [scheduleMode, setScheduleMode] = useState<LiveScheduleMode>("asap"),
   createChallenge = useCreateBattleChallengeMutation(),
   genresQuery = useGenresQuery(),
   battleConfig = liveExperienceConfigs.battle,

   genres =
    genresQuery.data && genresQuery.data.length > 0
      ? genresQuery.data.map((genre) => ({
          label: genre.name,
          value: genre.slug,
        }))
      : [
          { label: "Hip-Hop", value: "hip-hop" },
          { label: "R&B", value: "r-and-b" },
          { label: "Electronic", value: "electronic" },
          { label: "Pop", value: "pop" },
          { label: "Trap", value: "trap" },
          { label: "Afrobeats", value: "afrobeats" },
        ],

   submitChallenge = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget),
     opponentUsername =
      searchQuery.trim() || String(form.get("opponentUsername") ?? "").trim();

    if (!opponentUsername) {
      toast({
        description: "Choose an artist or enter a username to challenge.",
        title: "Opponent required",
        variant: "destructive",
      });
      return;
    }

    const proposedDateValue = String(form.get("proposedDate") ?? ""),
     proposedTimeValue = String(form.get("proposedTime") ?? ""),
     proposedDateTime =
      scheduleMode === "scheduled" && proposedDateValue && proposedTimeValue
        ? new Date(`${proposedDateValue}T${proposedTimeValue}`)
        : null;

    createChallenge.mutate(
      {
        format: String(form.get("format") ?? "best_of_5") as
          | "best_of_3"
          | "best_of_5"
          | "best_of_7",
        genre: String(form.get("genre") ?? "hip-hop"),
        message: String(form.get("message") ?? ""),
        opponentUsername,
        proposedDate: proposedDateTime?.toISOString(),
        proposedTimeLabel: proposedDateTime
          ? proposedDateTime.toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })
          : "ASAP",
      },
      {
        onSuccess: () => {
          toast({
            description:
              "Notification sent to artist to prepare for the live battle.",
            title: "Challenge sent",
          });
          event.currentTarget.reset();
        },
      }
    );
  };

  return (
    <LiveExperienceAuthGuard
      actionLabel="issue battle challenges"
      featureTitle="Live Battle Challenges"
      requiredEntitlement="canCreateLiveBattles"
    >
      <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-5xl mx-auto">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="flex items-center gap-3 font-[family-name:var(--font-playfair)] text-3xl font-bold">
              <Swords className="size-7 text-primary" />
              Issue Battle Challenge
            </h1>
            <h2 className="sr-only">Battle Requests</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
              Send a direct live battle invitation to any artist on SoundKit.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link
              search={{
                genre: undefined,
                region: undefined,
                regionType: "north-america",
                sort: undefined,
              }}
              to="/live/battles"
            >
              Open Public Battles
            </Link>
          </Button>
        </div>

        <Card className="border-primary/20 shadow-lg">
          <CardHeader className="border-b">
            <CardTitle>Challenge Details</CardTitle>
            <CardDescription>
              Select opponent, format, genre, and schedule mode.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-6">
            <form className="flex flex-col gap-6" onSubmit={submitChallenge}>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="opponentUsername">Opponent Username</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="pl-10 pr-10"
                        id="opponentUsername"
                        name="opponentUsername"
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Search or enter @username"
                        value={searchQuery}
                      />
                      {searchQuery ? (
                        <button
                          type="button"
                          onClick={() => setSearchQuery("")}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          <X className="size-4" />
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
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
                    defaultValue={genres[0]?.value ?? "hip-hop"}
                    label="Genre"
                    name="genre"
                    options={genres.map((g) => ({
                      label: g.label,
                      value: g.value,
                    }))}
                  />
                </div>

                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label>Start Time</Label>
                    <RadioGroup
                      className="grid gap-3 sm:grid-cols-2"
                      onValueChange={(value) =>
                        setScheduleMode(value as LiveScheduleMode)
                      }
                      value={scheduleMode}
                    >
                      <label
                        htmlFor="battle-start-asap"
                        className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-muted/40 transition"
                      >
                        <RadioGroupItem id="battle-start-asap" value="asap" />
                        <div>
                          <span className="block font-medium text-sm">
                            ASAP
                          </span>
                          <span className="text-muted-foreground text-xs">
                            Start when accepted
                          </span>
                        </div>
                      </label>
                      <label
                        htmlFor="battle-start-scheduled"
                        className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-muted/40 transition"
                      >
                        <RadioGroupItem
                          id="battle-start-scheduled"
                          value="scheduled"
                        />
                        <div>
                          <span className="block font-medium text-sm">
                            Schedule
                          </span>
                          <span className="text-muted-foreground text-xs">
                            Propose a date &amp; time
                          </span>
                        </div>
                      </label>
                    </RadioGroup>
                  </div>

                  {scheduleMode === "scheduled" && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="proposedDate">Proposed date</Label>
                        <Input
                          id="proposedDate"
                          name="proposedDate"
                          required
                          type="date"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="proposedTime">Proposed time</Label>
                        <Input
                          id="proposedTime"
                          name="proposedTime"
                          required
                          type="time"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="message">Challenge message</Label>
                    <Textarea
                      id="message"
                      name="message"
                      placeholder="Add a message for your opponent..."
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t pt-4">
                <Badge variant="outline">{battleConfig.roomLabel}</Badge>
                <Button
                  disabled={createChallenge.isPending}
                  type="submit"
                  size="lg"
                  className="px-8"
                >
                  <Swords className="mr-2 size-4" />
                  {createChallenge.isPending
                    ? "Sending..."
                    : "Send Battle Challenge"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="border-border bg-muted/20">
          <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-lg bg-zinc-900 border flex items-center justify-center text-emerald-400 shrink-0">
                <Bot className="size-4" />
              </div>
              <div className="text-xs">
                <span className="font-bold text-foreground">
                  BattleBot handoff:{" "}
                </span>
                <span className="text-muted-foreground">
                  Automated round switching, 2-minute voting polls, and timer
                  enforcement.
                </span>
              </div>
            </div>
            <Badge variant="outline" className="text-xs shrink-0">
              Next-round lobby enabled
            </Badge>
          </CardContent>
        </Card>
      </div>
    </LiveExperienceAuthGuard>
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
