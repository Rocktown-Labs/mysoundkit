"use client";

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  CalendarDays,
  Captions,
  Headphones,
  ListMusic,
  MessageSquare,
  Plus,
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
import { Checkbox } from "@/components/ui/checkbox";
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
  liveExperienceConfigs,
  realtimeKitAlwaysOn,
} from "@/lib/live-experience";
import type { LiveScheduleMode } from "@/lib/live-experience";
import {
  useCreateListeningPartyMutation,
  useListeningPartiesQuery,
  useProjectsQuery,
} from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/live/parties")({
  component: DashboardLivePartiesPage,
});

function DashboardLivePartiesPage() {
  const [scheduleMode, setScheduleMode] = useState<LiveScheduleMode>("asap");
  const [hostMode, setHostMode] = useState<"chat" | "video">("chat");
  const partiesQuery = useListeningPartiesQuery();
  const projectsQuery = useProjectsQuery();
  const createParty = useCreateListeningPartyMutation();
  const parties = partiesQuery.data ?? [];
  const projects = (projectsQuery.data ?? []).filter(
    (project) => project.projectType !== "single"
  );
  const liveParties = parties.filter((party) => party.status === "live");
  const scheduledParties = parties.filter(
    (party) => party.status === "scheduled"
  );
  const partyConfig = liveExperienceConfigs.party;

  const submitParty = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const scheduledStartAt =
      scheduleMode === "asap"
        ? new Date().toISOString()
        : new Date(String(form.get("scheduledStartAt") ?? "")).toISOString();
    const projectId = String(form.get("projectId") ?? "");

    if (!projectId) {
      toast({
        description: "Choose an album, EP, mixtape, or playlist first.",
        title: "Playlist required",
        variant: "destructive",
      });
      return;
    }

    createParty.mutate(
      {
        description: String(form.get("description") ?? ""),
        playbackMode: String(form.get("playbackMode") ?? "artist_hosted") as
          | "artist_hosted"
          | "programmed_release",
        projectId,
        scheduledStartAt,
        title: String(form.get("title") ?? ""),
      },
      {
        onSuccess: () => {
          toast({
            description:
              "The listening room is ready with chat, lyrics, and playlist playback.",
            title: "Party created",
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
          <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-bold">
            Live Parties
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Create release rooms where listeners play the tracklist together,
            chat with hosts, and follow synced lyrics.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/live/parties">Open Public Parties</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          icon={Headphones}
          label="Active Parties"
          value={liveParties.length}
        />
        <MetricCard
          icon={CalendarDays}
          label="Scheduled"
          value={scheduledParties.length}
        />
        <MetricCard icon={Users} label="Total Parties" value={parties.length} />
        <MetricCard
          icon={MessageSquare}
          label="Realtime Chat"
          value="Always on"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <main className="flex flex-col gap-6">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Create Listening Party</CardTitle>
              <CardDescription>
                Pick the release or playlist, decide when it opens, then send
                fans into the room.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
              <form className="flex flex-col gap-5" onSubmit={submitParty}>
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="title">Title</Label>
                      <Input
                        id="title"
                        name="title"
                        placeholder="Midnight Dreams release party"
                        required
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="projectId">Playlist or release</Label>
                      <Select name="projectId" required>
                        <SelectTrigger id="projectId">
                          <SelectValue placeholder="Choose an album, EP, or mixtape" />
                        </SelectTrigger>
                        <SelectContent>
                          {projects.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="flex flex-col gap-2">
                        <Label>Start</Label>
                        <RadioGroup
                          className="grid gap-3"
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
                                Open the room now
                              </span>
                            </span>
                          </label>
                          <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-4">
                            <RadioGroupItem value="scheduled" />
                            <span>
                              <span className="block font-medium">
                                Schedule
                              </span>
                              <span className="text-muted-foreground text-sm">
                                Premiere later
                              </span>
                            </span>
                          </label>
                        </RadioGroup>
                      </div>

                      <div className="flex flex-col gap-2">
                        <Label>Host presence</Label>
                        <RadioGroup
                          className="grid gap-3"
                          onValueChange={(value) =>
                            setHostMode(value as "chat" | "video")
                          }
                          value={hostMode}
                        >
                          <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-4">
                            <RadioGroupItem value="chat" />
                            <span>
                              <span className="block font-medium">
                                Chat host
                              </span>
                              <span className="text-muted-foreground text-sm">
                                Badge the artist in chat
                              </span>
                            </span>
                          </label>
                          <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-4">
                            <RadioGroupItem value="video" />
                            <span>
                              <span className="block font-medium">
                                Video host
                              </span>
                              <span className="text-muted-foreground text-sm">
                                Add RealtimeKit stage
                              </span>
                            </span>
                          </label>
                        </RadioGroup>
                      </div>
                    </div>

                    {scheduleMode === "scheduled" && (
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="scheduledStartAt">Starts</Label>
                        <Input
                          id="scheduledStartAt"
                          name="scheduledStartAt"
                          required
                          type="datetime-local"
                        />
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="playbackMode">Room type</Label>
                      <Select defaultValue="artist_hosted" name="playbackMode">
                        <SelectTrigger id="playbackMode">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="artist_hosted">
                            Artist hosted
                          </SelectItem>
                          <SelectItem value="programmed_release">
                            Auto-created release room
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        name="description"
                        placeholder="Invite fans into the story behind the release."
                        rows={3}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    <ChecklistCard
                      icon={ListMusic}
                      items={partyConfig.checklist}
                      title="Party checklist"
                    />
                    <Card className="bg-muted/20">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Captions className="size-5 text-primary" />
                          Lyrics and moments
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-muted-foreground text-sm">
                        Party chat can reference timestamps like @1:27, while
                        the room keeps lyrics and the active track in view.
                      </CardContent>
                    </Card>
                    <label className="flex items-start gap-3 rounded-lg border p-4 text-sm">
                      <Checkbox defaultChecked />
                      <span>
                        <span className="block font-medium">
                          Auto-create for scheduled releases
                        </span>
                        <span className="text-muted-foreground">
                          New albums and EPs can open a premiere room
                          automatically.
                        </span>
                      </span>
                    </label>
                  </div>
                </div>

                <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <Badge variant="outline">
                    {hostMode === "video"
                      ? "Video host ready"
                      : "Chat host ready"}
                  </Badge>
                  <Button
                    disabled={createParty.isPending || projects.length === 0}
                  >
                    <Plus className="mr-2 size-4" />
                    {createParty.isPending ? "Creating..." : "Create Party"}
                  </Button>
                </div>

                {projects.length === 0 && (
                  <p className="text-center text-muted-foreground text-sm">
                    Create an album, EP, or mixtape project before scheduling a
                    party.
                  </p>
                )}
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upcoming Rooms</CardTitle>
              <CardDescription>
                Parties created from your real projects.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {partiesQuery.isLoading && (
                <p className="text-sm text-muted-foreground">
                  Loading listening parties...
                </p>
              )}
              {!partiesQuery.isLoading && parties.length === 0 && (
                <div className="rounded-lg border border-dashed p-8 text-center">
                  <p className="font-semibold">No listening parties yet</p>
                  <p className="mt-1 text-muted-foreground text-sm">
                    Create a room from a project to let fans listen and chat
                    together.
                  </p>
                </div>
              )}
              {parties.map((party) => (
                <div
                  className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                  key={party.id}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{party.title}</p>
                      <Badge variant="outline">{party.status}</Badge>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {new Date(party.scheduledStartAt).toLocaleString()} -{" "}
                      {party.playbackMode.replaceAll("_", " ")}
                    </p>
                  </div>
                  <Button asChild className="w-full sm:w-auto">
                    <Link
                      params={{ id: party.liveRoomId ?? party.id }}
                      to="/live/parties/$id"
                    >
                      Open Room
                    </Link>
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </main>

        <aside className="flex flex-col gap-4">
          <RealtimeConstantsPanel />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Host Badges</CardTitle>
              <CardDescription>
                Fans can tell when the artist or invited host is in the room.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {["Artist", "Producer", "Moderator"].map((role) => (
                <div
                  className="flex items-center justify-between rounded-lg border p-3"
                  key={role}
                >
                  <span className="flex items-center gap-2">
                    <BadgeCheck className="size-4 text-primary" />
                    {role}
                  </span>
                  <Badge variant="outline">Highlighted</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function ChecklistCard({
  icon: Icon,
  items,
  title,
}: {
  icon: typeof ListMusic;
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
            <BadgeCheck className="mt-0.5 size-4 text-primary" />
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
          Party rooms keep chat and presence available for everyone.
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
  icon: typeof Headphones;
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
