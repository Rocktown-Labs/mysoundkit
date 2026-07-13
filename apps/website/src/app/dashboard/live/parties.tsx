import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, Headphones, Plus, Users } from "lucide-react";
import type React from "react";

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
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateListeningPartyMutation,
  useListeningPartiesQuery,
  useProjectsQuery,
} from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/live/parties")({
  component: DashboardLivePartiesPage,
});

function DashboardLivePartiesPage() {
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

  const submitParty = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const scheduledStartAt = String(form.get("scheduledStartAt") ?? "");

    createParty.mutate({
      description: String(form.get("description") ?? ""),
      playbackMode: String(form.get("playbackMode") ?? "artist_hosted") as
        | "artist_hosted"
        | "programmed_release",
      projectId: String(form.get("projectId") ?? ""),
      scheduledStartAt: new Date(scheduledStartAt).toISOString(),
      title: String(form.get("title") ?? ""),
    });
    event.currentTarget.reset();
  };

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-bold">
            Live Parties
          </h1>
          <p className="mt-2 text-muted-foreground">
            Create playlist chat rooms for albums, EPs, mixtapes, and release
            listening sessions.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/live/parties">Open Public Parties</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
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
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Rooms</CardTitle>
            <CardDescription>
              Parties created from your real projects.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {partiesQuery.isLoading && (
              <p className="text-sm text-muted-foreground">
                Loading listening parties...
              </p>
            )}
            {!partiesQuery.isLoading && parties.length === 0 && (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="font-semibold">No listening parties yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create a room from a project to let fans listen and chat
                  together.
                </p>
              </div>
            )}
            <div className="space-y-3">
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
                    <p className="text-sm text-muted-foreground">
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
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Create Party</CardTitle>
            <CardDescription>
              A party opens a shared playlist room with chat below the songs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={submitParty}>
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  name="title"
                  placeholder="Midnight Dreams release party"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="projectId">Project</Label>
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
              <div className="space-y-2">
                <Label htmlFor="scheduledStartAt">Starts</Label>
                <Input
                  id="scheduledStartAt"
                  name="scheduledStartAt"
                  type="datetime-local"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="playbackMode">Mode</Label>
                <Select defaultValue="artist_hosted" name="playbackMode">
                  <SelectTrigger id="playbackMode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="artist_hosted">Artist hosted</SelectItem>
                    <SelectItem value="programmed_release">
                      Auto-created release room
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Invite fans into the story behind the release."
                  rows={3}
                />
              </div>
              <Button
                className="w-full"
                disabled={createParty.isPending || projects.length === 0}
              >
                <Plus className="mr-2 size-4" />
                {createParty.isPending ? "Creating..." : "Create Live Party"}
              </Button>
              {projects.length === 0 && (
                <p className="text-center text-muted-foreground text-sm">
                  Create an album, EP, or mixtape project before scheduling a
                  party.
                </p>
              )}
              {createParty.isSuccess && (
                <p className="text-center text-muted-foreground text-sm">
                  Party created.
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Headphones;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-5" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-3xl font-bold">
        {value.toLocaleString()}
      </CardContent>
    </Card>
  );
}
