import { createFileRoute, Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  Eye,
  FolderOpen,
  Radio,
  Trophy,
  Video,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useBattlesQuery, useListeningPartiesQuery, useProjectsQuery, useTracksQuery, useVideosQuery } from '@/lib/soundkit-api-hooks';
import type { TrackSummary } from '@/lib/soundkit-api-hooks';

export const Route = createFileRoute("/dashboard/career/analytics")({
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const tracksQuery = useTracksQuery();
  const projectsQuery = useProjectsQuery();
  const videosQuery = useVideosQuery();
  const partiesQuery = useListeningPartiesQuery();
  const battlesQuery = useBattlesQuery();
  const tracks = tracksQuery.data ?? [];
  const projects = projectsQuery.data ?? [];
  const videos = videosQuery.data ?? [];
  const parties = partiesQuery.data ?? [];
  const battles = battlesQuery.data ?? [];
  const totalPlays = tracks.reduce((total, track) => total + track.plays, 0);
  const publicTracks = tracks.filter((track) => track.isPublic).length;
  const scheduledProjects = projects.filter(
    (project) => project.releaseDate && project.status !== "released"
  );
  const liveEvents = [
    ...parties.filter((party) => party.status === "live"),
    ...battles.filter((battle) => battle.status === "live"),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-bold">
            Analytics
          </h1>
          <p className="text-muted-foreground">
            Real catalog and live-event performance from your SoundKit data.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/dashboard/tracks">Manage Tracks</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          description={`${publicTracks} public tracks`}
          icon={Eye}
          label="Total Plays"
          value={totalPlays.toLocaleString()}
        />
        <MetricCard
          description={`${projects.length} total projects`}
          icon={FolderOpen}
          label="Scheduled Releases"
          value={scheduledProjects.length.toLocaleString()}
        />
        <MetricCard
          description={`${videos.length} uploaded or linked videos`}
          icon={Video}
          label="Videos"
          value={videos.length.toLocaleString()}
        />
        <MetricCard
          description={`${parties.length + battles.length} total live items`}
          icon={Radio}
          label="Live Now"
          value={liveEvents.length.toLocaleString()}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Top Tracks</CardTitle>
            <CardDescription>
              Ranked by the play counts saved on your tracks.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tracks.length === 0 ? (
              <EmptyAnalyticsCopy
                actionHref="/dashboard/tracks/new"
                actionLabel="Create Track"
                text="Upload music to begin collecting play analytics."
              />
            ) : (
              <div className="space-y-3">
                {[...tracks]
                  .toSorted(
                    (left: TrackSummary, right: TrackSummary) =>
                      right.plays - left.plays
                  )
                  .slice(0, 8)
                  .map((track, index) => (
                    <Link
                      className="flex items-center justify-between gap-4 rounded-lg border p-3 transition-colors hover:border-primary/50"
                      key={track.id}
                      to="/dashboard/tracks"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {track.title}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {track.genre}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary">
                        {track.plays.toLocaleString()} plays
                      </Badge>
                    </Link>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="size-5 text-primary" />
                Upcoming
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {scheduledProjects.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No scheduled project releases yet.
                </p>
              ) : (
                scheduledProjects.slice(0, 5).map((project) => (
                  <Link
                    className="block rounded-lg border p-3 hover:border-primary/50"
                    key={project.id}
                    params={{ id: project.id }}
                    to="/dashboard/projects/$id"
                  >
                    <p className="font-semibold">{project.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {project.releaseDate
                        ? new Date(project.releaseDate).toLocaleDateString()
                        : "Unscheduled"}
                    </p>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="size-5 text-primary" />
                Battle Feed
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {battles.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No live battles are available yet.
                </p>
              ) : (
                battles.slice(0, 4).map((battle) => (
                  <Link
                    className="block rounded-lg border p-3 hover:border-primary/50"
                    key={battle.id}
                    params={{ id: battle.id }}
                    to="/live/battles/$id"
                  >
                    <p className="font-semibold">{battle.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {battle.genre} - {battle.viewerCount} viewers
                    </p>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  description,
  icon: Icon,
  label,
  value,
}: {
  description: string;
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="font-medium text-sm">{label}</CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-muted-foreground text-xs">{description}</p>
      </CardContent>
    </Card>
  );
}

function EmptyAnalyticsCopy({
  actionHref,
  actionLabel,
  text,
}: {
  actionHref: string;
  actionLabel: string;
  text: string;
}) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center">
      <p className="text-muted-foreground text-sm">{text}</p>
      <Button asChild className="mt-4">
        <Link to={actionHref}>{actionLabel}</Link>
      </Button>
    </div>
  );
}
