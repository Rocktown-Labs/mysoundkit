"use client";

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarDays,
  Headphones,
  ListMusic,
  MessageSquare,
  Plus,
  Users,
} from "lucide-react";
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
import type { LiveScheduleMode } from "@/lib/live-experience";
import {
  useCreateLiveExperienceMutation,
  useCreateListeningPartyMutation,
  useListeningPartiesQuery,
  useProjectsQuery,
} from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/live/parties")({
  component: DashboardLivePartiesPage,
});

type PartyCreationType = "release_auto" | "artist_manual";

const buildPartyTitle = ({
  creationType,
  projectTitle,
}: {
  creationType: PartyCreationType;
  projectTitle?: string;
}) => {
  if (!projectTitle) {
    return "SoundKit Live Party";
  }

  return creationType === "release_auto"
    ? `${projectTitle} Premiere`
    : `${projectTitle} Live Party`;
};

const resolveScheduledStartAt = ({
  creationType,
  fallbackValue,
  releaseDate,
  scheduleMode,
}: {
  creationType: PartyCreationType;
  fallbackValue: FormDataEntryValue | null;
  releaseDate?: null | string;
  scheduleMode: LiveScheduleMode;
}) => {
  if (creationType === "release_auto" && releaseDate) {
    return new Date(releaseDate).toISOString();
  }

  if (scheduleMode === "asap") {
    return new Date().toISOString();
  }

  return new Date(String(fallbackValue ?? Date.now())).toISOString();
};

function DashboardLivePartiesPage() {
  const [creationType, setCreationType] =
    useState<PartyCreationType>("artist_manual");
  const [scheduleMode, setScheduleMode] = useState<LiveScheduleMode>("asap");
  const [hostPresence, setHostPresence] = useState<"video" | "chat">("chat");
  const [selectedProjectId, setSelectedProjectId] = useState("no-project");

  const partiesQuery = useListeningPartiesQuery();
  const projectsQuery = useProjectsQuery();
  const createParty = useCreateListeningPartyMutation();
  const createLiveExperience = useCreateLiveExperienceMutation();

  const parties = partiesQuery.data ?? [];
  const projects = projectsQuery.data ?? [];
  const selectedProject = projects.find(
    (project) => project.id === selectedProjectId
  );
  const suggestedTitle = buildPartyTitle({
    creationType,
    projectTitle: selectedProject?.title,
  });
  const liveParties = parties.filter((party) => party.status === "live");
  const scheduledParties = parties.filter(
    (party) => party.status === "scheduled"
  );

  const submitParty = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    const title = String(form.get("title") ?? "").trim();
    const projectId =
      selectedProjectId === "no-project" ? "" : selectedProjectId;
    const description = String(form.get("description") ?? "");

    const scheduledStartAt = resolveScheduledStartAt({
      creationType,
      fallbackValue: form.get("scheduledStartAt"),
      releaseDate: selectedProject?.releaseDate,
      scheduleMode,
    });

    const effectivePlaybackMode =
      creationType === "release_auto" ? "programmed_release" : "artist_hosted";

    const partyTitle = title || suggestedTitle;

    if (!projectId) {
      createLiveExperience.mutate(
        {
          description,
          kind: "party",
          scheduleMode,
          scheduledStartAt,
          source: "playlist",
          title: partyTitle,
          visibility: "public",
        },
        {
          onSuccess: () => {
            toast({
              description:
                "Projectless live party room created. You can share the room once it opens.",
              title: "Party Room Created",
            });
            event.currentTarget.reset();
            setSelectedProjectId("no-project");
          },
        }
      );
      return;
    }

    createParty.mutate(
      {
        description,
        playbackMode: effectivePlaybackMode,
        projectId,
        scheduledStartAt,
        title: partyTitle,
      },
      {
        onSuccess: () => {
          toast({
            description:
              "Listening party created! Fans can join to listen together and chat.",
            title: "Party Created",
          });
          event.currentTarget.reset();
          setSelectedProjectId("no-project");
        },
      }
    );
  };

  return (
    <LiveExperienceAuthGuard
      actionLabel="create live listening parties or premiere release rooms"
      featureTitle="Live Listening Parties"
      requiredEntitlement="canHostLiveStreams"
    >
      <div className="space-y-6 p-4 md:p-6 lg:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-bold">
              Live Parties
            </h1>
            <p className="mt-1 text-muted-foreground">
              Create release rooms where listeners play project tracklists
              together with synchronized audio and chat.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/live/parties">Open Public Parties</Link>
          </Button>
        </div>

        {/* Metrics Grid */}
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <MetricCard
            icon={Headphones}
            label="Active Parties"
            value={liveParties.length}
          />
          <MetricCard
            icon={CalendarDays}
            label="Scheduled Premieres"
            value={scheduledParties.length}
          />
          <MetricCard
            icon={Users}
            label="Total Parties"
            value={parties.length}
          />
          <MetricCard
            icon={MessageSquare}
            label="Realtime Chat"
            value="Always On"
          />
        </div>

        {/* Simplified Single/Dual Column Layout without heavy right sidebars */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
          <main className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Create Listening Party</CardTitle>
                <CardDescription>
                  Select party mode, pick an EP, album, or playlist, and launch
                  or schedule the room.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <RadioGroup
                  className="grid gap-3 sm:grid-cols-2"
                  onValueChange={(value) =>
                    setCreationType(value as PartyCreationType)
                  }
                  value={creationType}
                >
                  <label
                    className="flex cursor-pointer items-center gap-3 rounded-lg border p-3"
                    htmlFor="party-mode-artist-manual"
                  >
                    <RadioGroupItem
                      id="party-mode-artist-manual"
                      value="artist_manual"
                    />
                    <span className="text-sm">
                      <span className="block font-medium">Host a party</span>
                      <span className="text-muted-foreground">
                        Start now or schedule a listening room.
                      </span>
                    </span>
                  </label>
                  <label
                    className="flex cursor-pointer items-center gap-3 rounded-lg border p-3"
                    htmlFor="party-mode-release-auto"
                  >
                    <RadioGroupItem
                      id="party-mode-release-auto"
                      value="release_auto"
                    />
                    <span className="text-sm">
                      <span className="block font-medium">Release party</span>
                      <span className="text-muted-foreground">
                        Use the selected release date when available.
                      </span>
                    </span>
                  </label>
                </RadioGroup>

                <form className="space-y-4" onSubmit={submitParty}>
                  <div className="space-y-2">
                    <Label htmlFor="title">Custom title (optional)</Label>
                    <Input
                      id="title"
                      name="title"
                      placeholder={suggestedTitle}
                    />
                    <p className="text-muted-foreground text-xs">
                      Default: {suggestedTitle}
                    </p>
                  </div>

                  {/* Project / Playlist Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="projectId">Project or Release</Label>
                    <Select
                      onValueChange={setSelectedProjectId}
                      value={selectedProjectId}
                    >
                      <SelectTrigger id="projectId">
                        <SelectValue placeholder="Choose a project or go projectless" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no-project">
                          No project, just open a room
                        </SelectItem>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.title} ({project.projectType.toUpperCase()}
                            )
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {creationType === "release_auto" &&
                      selectedProject &&
                      !selectedProject.releaseDate && (
                        <p className="mt-1 text-amber-500 text-xs">
                          This project has no release date yet, so choose a date
                          below.
                        </p>
                      )}
                  </div>

                  {/* Host Presence Option (Disabled for Fan Party) */}
                  <div className="space-y-2">
                    <p className="font-medium text-sm">Host Presence</p>
                    <RadioGroup
                      className="grid grid-cols-2 gap-3"
                      onValueChange={(val) =>
                        setHostPresence(val as "video" | "chat")
                      }
                      value={hostPresence}
                    >
                      <label
                        className="flex cursor-pointer items-center gap-3 rounded-lg border p-3"
                        htmlFor="party-host-presence-chat"
                      >
                        <RadioGroupItem
                          id="party-host-presence-chat"
                          value="chat"
                        />
                        <span className="text-xs">
                          <span className="block font-medium">Chat Host</span>
                          <span className="text-muted-foreground">
                            Join the room chat
                          </span>
                        </span>
                      </label>
                      <label
                        className="flex cursor-pointer items-center gap-3 rounded-lg border p-3"
                        htmlFor="party-host-presence-video"
                      >
                        <RadioGroupItem
                          id="party-host-presence-video"
                          value="video"
                        />
                        <span className="text-xs">
                          <span className="block font-medium">Video Host</span>
                          <span className="text-muted-foreground">
                            Join with camera
                          </span>
                        </span>
                      </label>
                    </RadioGroup>
                  </div>

                  {/* Start Timing */}
                  {creationType === "release_auto" ? null : (
                    <div className="space-y-2">
                      <p className="font-medium text-sm">Start Timing</p>
                      <RadioGroup
                        className="grid grid-cols-2 gap-3"
                        onValueChange={(val) =>
                          setScheduleMode(val as LiveScheduleMode)
                        }
                        value={scheduleMode}
                      >
                        <label
                          className="flex cursor-pointer items-center gap-3 rounded-lg border p-3"
                          htmlFor="party-start-asap"
                        >
                          <RadioGroupItem id="party-start-asap" value="asap" />
                          <span className="text-xs">
                            <span className="block font-medium">Start Now</span>
                            <span className="text-muted-foreground">
                              Open room immediately
                            </span>
                          </span>
                        </label>
                        <label
                          className="flex cursor-pointer items-center gap-3 rounded-lg border p-3"
                          htmlFor="party-start-scheduled"
                        >
                          <RadioGroupItem
                            id="party-start-scheduled"
                            value="scheduled"
                          />
                          <span className="text-xs">
                            <span className="block font-medium">
                              Schedule Later
                            </span>
                            <span className="text-muted-foreground">
                              Set premiere date/time
                            </span>
                          </span>
                        </label>
                      </RadioGroup>
                    </div>
                  )}

                  {(scheduleMode === "scheduled" ||
                    (creationType === "release_auto" &&
                      !selectedProject?.releaseDate)) && (
                    <div className="space-y-2">
                      <Label htmlFor="scheduledStartAt">Date and Time</Label>
                      <Input
                        id="scheduledStartAt"
                        name="scheduledStartAt"
                        type="datetime-local"
                        required
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Textarea
                      id="description"
                      name="description"
                      placeholder="Share what this project means or invite fans into the process."
                      rows={3}
                    />
                  </div>

                  <Button
                    className="w-full"
                    disabled={
                      createParty.isPending || createLiveExperience.isPending
                    }
                  >
                    <Plus className="mr-2 size-4" />
                    {createParty.isPending || createLiveExperience.isPending
                      ? "Creating Room..."
                      : "Create Listening Party"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </main>

          {/* Active and Upcoming Listening Rooms */}
          <aside className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ListMusic className="size-5 text-primary" />
                  Active &amp; Scheduled Rooms
                </CardTitle>
                <CardDescription>
                  Your upcoming release listening parties.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {partiesQuery.isLoading && (
                  <p className="text-sm text-muted-foreground">
                    Loading parties...
                  </p>
                )}

                {!partiesQuery.isLoading && parties.length === 0 && (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No active listening parties scheduled. Create one above!
                  </div>
                )}

                {parties.map((party) => (
                  <div
                    key={party.id}
                    className="rounded-lg border p-4 space-y-2 bg-background/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm">{party.title}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(party.scheduledStartAt).toLocaleString()}
                        </p>
                      </div>
                      <Badge
                        variant={
                          party.status === "live" ? "destructive" : "outline"
                        }
                      >
                        {party.status}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                      <span className="capitalize">
                        {party.playbackMode.replaceAll("_", " ")}
                      </span>
                      <Button asChild size="sm">
                        <Link
                          params={{
                            id: party.liveRoomId ?? party.id,
                          }}
                          to="/live/parties/$id"
                        >
                          Open Room
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  RealtimeKit Defaults
                </CardTitle>
                <CardDescription>
                  Realtime chat, presence, and timestamp syncing for listening
                  parties.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span>Party chat can reference timestamps</span>
                  <Badge variant="outline">On</Badge>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span>Synced tracklist queue</span>
                  <Badge variant="outline">On</Badge>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </LiveExperienceAuthGuard>
  );
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
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 font-medium text-muted-foreground text-sm">
          <Icon className="size-4 text-primary" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-3xl font-bold">{value}</CardContent>
    </Card>
  );
}
