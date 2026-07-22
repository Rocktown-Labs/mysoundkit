"use client";

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Calendar,
  CalendarDays,
  Headphones,
  Info,
  ListMusic,
  MessageSquare,
  Plus,
  Radio,
  Sparkles,
  Users,
  Video,
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import type { LiveScheduleMode } from "@/lib/live-experience";
import {
  useCreateListeningPartyMutation,
  useListeningPartiesQuery,
  useProjectsQuery,
} from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/live/parties")({
  component: DashboardLivePartiesPage,
});

type PartyCreationType = "release_auto" | "artist_manual" | "fan_community";

function DashboardLivePartiesPage() {
  const [creationType, setCreationType] =
    useState<PartyCreationType>("artist_manual");
  const [scheduleMode, setScheduleMode] = useState<LiveScheduleMode>("asap");
  const [hostPresence, setHostPresence] = useState<"video" | "chat">("chat");

  const partiesQuery = useListeningPartiesQuery();
  const projectsQuery = useProjectsQuery();
  const createParty = useCreateListeningPartyMutation();

  const parties = partiesQuery.data ?? [];
  // Exclude single-track projects so listening parties always use album, EP, or mixtape playlists
  const multiTrackProjects = (projectsQuery.data ?? []).filter(
    (project) => project.projectType !== "single"
  );
  const liveParties = parties.filter((party) => party.status === "live");
  const scheduledParties = parties.filter(
    (party) => party.status === "scheduled"
  );

  const submitParty = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    const title = String(form.get("title") ?? "").trim();
    const projectId = String(form.get("projectId") ?? "");
    const description = String(form.get("description") ?? "");

    if (!projectId) {
      toast({
        description:
          "Select an album, EP, mixtape, or playlist to continue. Listening parties cannot be held for a single track.",
        title: "Tracklist project required",
        variant: "destructive",
      });
      return;
    }

    const scheduledStartAt =
      scheduleMode === "asap" && creationType !== "release_auto"
        ? new Date().toISOString()
        : new Date(
            String(form.get("scheduledStartAt") ?? Date.now())
          ).toISOString();

    const effectivePlaybackMode =
      creationType === "release_auto" ? "programmed_release" : "artist_hosted";

    createParty.mutate(
      {
        description,
        playbackMode: effectivePlaybackMode as
          | "artist_hosted"
          | "programmed_release",
        projectId,
        scheduledStartAt,
        title: title || "Listening Party",
      },
      {
        onSuccess: (res) => {
          const roomId = res.party.liveRoomId || res.party.id;
          toast({
            description:
              "Listening party created! Fans can join to listen together and chat.",
            title: "Party Created",
          });
          event.currentTarget.reset();
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
                {/* 3 Party Creation Modes */}
                <Tabs
                  value={creationType}
                  onValueChange={(val) =>
                    setCreationType(val as PartyCreationType)
                  }
                >
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="release_auto">
                      <Sparkles className="mr-1.5 size-4" /> Release Premiere
                    </TabsTrigger>
                    <TabsTrigger value="artist_manual">
                      <Radio className="mr-1.5 size-4" /> Artist Hosted
                    </TabsTrigger>
                    <TabsTrigger value="fan_community">
                      <Users className="mr-1.5 size-4" /> Fan Party
                    </TabsTrigger>
                  </TabsList>

                  <div className="mt-4 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground flex items-center gap-2">
                    <Info className="size-4 shrink-0 text-primary" />
                    <span>
                      {creationType === "release_auto" &&
                        "Auto-schedules a premiere party on the release date of an upcoming EP or album project. Artist can join via camera or chat."}
                      {creationType === "artist_manual" &&
                        "Manual artist-led listening party for a project or playlist. Choose video stage or chat-only presence."}
                      {creationType === "fan_community" &&
                        "Fan/Community created listening room. Starts without video stage (audio tracklist + synced chat)."}
                    </span>
                  </div>
                </Tabs>

                <form className="space-y-4" onSubmit={submitParty}>
                  <div className="space-y-2">
                    <Label htmlFor="title">Party Title</Label>
                    <Input
                      id="title"
                      name="title"
                      placeholder={
                        creationType === "release_auto"
                          ? "Midnight Dreams Release Premiere"
                          : "Project Listening Room"
                      }
                      required
                    />
                  </div>

                  {/* Project / Playlist Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="projectId">
                      Album, EP, Mixtape, or Playlist
                    </Label>
                    <Select name="projectId" required>
                      <SelectTrigger id="projectId">
                        <SelectValue placeholder="Choose a multi-track project or playlist" />
                      </SelectTrigger>
                      <SelectContent>
                        {multiTrackProjects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.title} ({project.projectType.toUpperCase()}
                            )
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {multiTrackProjects.length === 0 && (
                      <p className="text-xs text-amber-500 mt-1">
                        No albums or EPs found. Create a multi-track project
                        first in Projects.
                      </p>
                    )}
                  </div>

                  {/* Host Presence Option (Disabled for Fan Party) */}
                  {creationType !== "fan_community" && (
                    <div className="space-y-2">
                      <Label>Host Presence</Label>
                      <RadioGroup
                        className="grid grid-cols-2 gap-3"
                        onValueChange={(val) =>
                          setHostPresence(val as "video" | "chat")
                        }
                        value={hostPresence}
                      >
                        <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3">
                          <RadioGroupItem value="chat" />
                          <span className="text-xs">
                            <span className="block font-medium">Chat Host</span>
                            <span className="text-muted-foreground">
                              Badge artist in chat
                            </span>
                          </span>
                        </label>
                        <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3">
                          <RadioGroupItem value="video" />
                          <span className="text-xs">
                            <span className="block font-medium">
                              Video Host
                            </span>
                            <span className="text-muted-foreground">
                              Join with camera video
                            </span>
                          </span>
                        </label>
                      </RadioGroup>
                    </div>
                  )}

                  {/* Start Timing */}
                  {creationType === "release_auto" ? null : (
                    <div className="space-y-2">
                      <Label>Start Timing</Label>
                      <RadioGroup
                        className="grid grid-cols-2 gap-3"
                        onValueChange={(val) =>
                          setScheduleMode(val as LiveScheduleMode)
                        }
                        value={scheduleMode}
                      >
                        <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3">
                          <RadioGroupItem value="asap" />
                          <span className="text-xs">
                            <span className="block font-medium">Start Now</span>
                            <span className="text-muted-foreground">
                              Open room immediately
                            </span>
                          </span>
                        </label>
                        <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3">
                          <RadioGroupItem value="scheduled" />
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
                    creationType === "release_auto") && (
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
                      createParty.isPending || multiTrackProjects.length === 0
                    }
                  >
                    <Plus className="mr-2 size-4" />
                    {createParty.isPending
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
                        <p className="font-semibold text-sm">{party.title}</p>
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
                          params={{ id: party.liveRoomId ?? party.id }}
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
