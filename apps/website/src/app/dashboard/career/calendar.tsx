/* eslint-disable complexity, no-negated-condition, no-nested-ternary, one-var, sort-vars, unicorn/no-negated-condition, unicorn/no-nested-ternary */
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarDays,
  Check,
  Clock3,
  Film,
  ListVideo,
  Music2,
  PartyPopper,
  Radio,
  Sparkles,
  Swords,
} from "lucide-react";
import { useMemo } from "react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isReleasedTrack } from "@/lib/release-momentum";
import type {
  BattleKit,
  BattleSummary,
  ListeningPartySummary,
  ProjectSummary,
  TrackSummary,
  VideoSummary,
} from "@/lib/soundkit-api-hooks";
import {
  useBattleKitsQuery,
  useBattlesQuery,
  useListeningPartiesQuery,
  useMyLiveExperiencesQuery,
  useProjectsQuery,
  useTracksQuery,
  useVideosQuery,
} from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/career/calendar")({
  component: ReleaseMomentumPage,
});

const formatDate = (value: string | null | undefined) =>
    value
      ? new Date(value).toLocaleDateString(undefined, {
          day: "numeric",
          month: "short",
        })
      : null,
  formatDateTime = (value: string | null | undefined) =>
    value
      ? new Date(value).toLocaleString(undefined, {
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          month: "short",
        })
      : "Date to be announced";

function ReleaseMomentumPage() {
  const tracksQuery = useTracksQuery(),
    projectsQuery = useProjectsQuery(),
    partiesQuery = useListeningPartiesQuery(),
    battlesQuery = useBattlesQuery(),
    experiencesQuery = useMyLiveExperiencesQuery(),
    videosQuery = useVideosQuery(),
    kitsQuery = useBattleKitsQuery(),
    tracks = useMemo(
      () => (tracksQuery.data ?? []).filter(isReleasedTrack),
      [tracksQuery.data]
    ),
    projects = useMemo(
      () =>
        (projectsQuery.data ?? []).filter(
          (project) => project.status === "released"
        ),
      [projectsQuery.data]
    ),
    upcoming = useMemo(
      () =>
        buildUpcomingEvents({
          battles: battlesQuery.data ?? [],
          experiences: experiencesQuery.data ?? [],
          parties: partiesQuery.data ?? [],
          projects: projectsQuery.data ?? [],
          tracks: tracksQuery.data ?? [],
          videos: videosQuery.data ?? [],
        }),
      [
        battlesQuery.data,
        experiencesQuery.data,
        partiesQuery.data,
        projectsQuery.data,
        tracksQuery.data,
        videosQuery.data,
      ]
    ),
    isLoading =
      tracksQuery.isLoading || projectsQuery.isLoading || kitsQuery.isLoading,
    hasError = tracksQuery.error || projectsQuery.error || kitsQuery.error;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-bold tracking-tight">
            Release Momentum
          </h1>
          <p className="mt-1 text-muted-foreground">
            Keep your releases moving across SoundKit.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/dashboard/live/streams">
              <Radio data-icon="inline-start" />
              Schedule Stream
            </Link>
          </Button>
          <Button asChild>
            <Link to="/dashboard/projects/new">
              <Sparkles data-icon="inline-start" />
              Plan a Release
            </Link>
          </Button>
        </div>
      </header>

      <UpcomingSection events={upcoming} />

      {isLoading && (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Loading your release momentum...
          </CardContent>
        </Card>
      )}

      {hasError && (
        <Card className="border-destructive/40">
          <CardContent className="p-8 text-center text-sm text-destructive">
            We could not load your release activity. Refresh and try again.
          </CardContent>
        </Card>
      )}

      {!isLoading &&
        !hasError &&
        tracks.length === 0 &&
        projects.length === 0 && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
              <Music2 className="size-10 text-primary" />
              <h2 className="text-xl font-semibold">
                Release some music to start building momentum.
              </h2>
              <p className="max-w-lg text-sm text-muted-foreground">
                Once a track or project is live on SoundKit, it will appear here
                automatically with the next useful action.
              </p>
              <Button asChild>
                <Link to="/dashboard/tracks/new">Upload Music</Link>
              </Button>
            </CardContent>
          </Card>
        )}

      {!isLoading &&
        !hasError &&
        (tracks.length > 0 || projects.length > 0) && (
          <section
            className="flex flex-col gap-4"
            aria-labelledby="momentum-heading"
          >
            <div>
              <h2 className="text-2xl font-semibold" id="momentum-heading">
                Your Momentum
              </h2>
              <p className="text-sm text-muted-foreground">
                Real releases, real product actions — no promo tasks to
                maintain.
              </p>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              {tracks.map((track) => (
                <TrackMomentumCard
                  key={track.id}
                  kits={kitsQuery.data ?? []}
                  releasedTrackCount={tracks.length}
                  track={track}
                  videos={videosQuery.data ?? []}
                  experiences={experiencesQuery.data ?? []}
                />
              ))}
              {projects.map((project) => (
                <ProjectMomentumCard
                  key={project.id}
                  parties={partiesQuery.data ?? []}
                  project={project}
                />
              ))}
            </div>
          </section>
        )}
    </div>
  );
}

function UpcomingSection({ events }: { events: UpcomingEvent[] }) {
  return (
    <Card className="border-border/60 bg-card/60">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="size-5 text-primary" /> Upcoming
          </CardTitle>
          <CardDescription>
            Scheduled SoundKit activity, gathered automatically.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to="/dashboard/live">
              <Swords data-icon="inline-start" /> Find Battle
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/dashboard/live/parties">
              <PartyPopper data-icon="inline-start" /> Listening Party
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nothing scheduled yet.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-border/60">
            {events.map((event) => (
              <div
                className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                key={event.id}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    {event.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{event.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {event.type}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground sm:shrink-0">
                  <Clock3 className="size-4" />
                  {formatDateTime(event.startsAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TrackMomentumCard({
  experiences,
  kits,
  releasedTrackCount,
  track,
  videos,
}: {
  experiences: LiveExperienceSummary[];
  kits: BattleKit[];
  releasedTrackCount: number;
  track: TrackSummary;
  videos: VideoSummary[];
}) {
  const containingKits = kits.filter((kit) =>
      kit.tracks.some((entry) => entry.trackId === track.id)
    ),
    readyKit = containingKits.find((kit) => kit.isBattleReady),
    incompleteKit = containingKits.find((kit) => !kit.isBattleReady),
    video = videos.find((entry) => entry.sourceTrackId === track.id),
    scheduledStream = experiences.find(
      (experience) =>
        experience.kind === "stream" && experience.status === "scheduled"
    ),
    lyricsState = lyricsStateForTrack(track),
    recommendation =
      track.lyricsStatus !== "approved"
        ? {
            href: "/dashboard/tracks/$id" as const,
            label: lyricsState.label,
            text: "Complete the lyrics workspace for this release.",
          }
        : readyKit
          ? {
              href: "/dashboard/live" as const,
              label: "Find a Battle",
              text: `${readyKit.name} is battle ready.`,
            }
          : incompleteKit
            ? {
                href: "/dashboard/live/my-kit" as const,
                label: "Finish Battle Kit",
                text: `${incompleteKit.name} — ${incompleteKit.totalUniqueTracks}/${incompleteKit.totalRequiredTracks} ready.`,
              }
            : releasedTrackCount < 4
              ? {
                  href: "/dashboard/live/my-kit" as const,
                  label: "Build Battle Kit",
                  text: `You need ${4 - releasedTrackCount} more released track${4 - releasedTrackCount === 1 ? "" : "s"} for a BO3 kit.`,
                }
              : {
                  href: "/dashboard/live/streams" as const,
                  label: "Schedule Stream",
                  text: "Feature this release in a live stream.",
                };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="size-16 shrink-0 overflow-hidden rounded-lg border bg-muted">
            {track.coverArtUrl ? (
              <img
                alt={`${track.title} cover`}
                className="size-full object-cover"
                src={track.coverArtUrl}
              />
            ) : (
              <Music2 className="m-5 size-6 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <CardTitle className="truncate">{track.title}</CardTitle>
            <CardDescription>
              {track.genre} · {track.duration}
            </CardDescription>
          </div>
        </div>
        <Badge variant="default">
          <Check data-icon="inline-start" /> Released
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <MomentumMilestone
            icon={<ListVideo />}
            label="Lyrics"
            value={lyricsState.label}
            href="/dashboard/tracks/$id"
            trackId={track.id}
          />
          <MomentumMilestone
            icon={<Swords />}
            label="Battle"
            value={
              readyKit
                ? `${readyKit.name} · Battle Ready`
                : incompleteKit
                  ? `${incompleteKit.name} · ${incompleteKit.totalUniqueTracks}/${incompleteKit.totalRequiredTracks}`
                  : "Not in a kit yet"
            }
            href={readyKit ? "/dashboard/live" : "/dashboard/live/my-kit"}
          />
          <MomentumMilestone
            icon={<Radio />}
            label="Live Stream"
            value={
              scheduledStream
                ? `Stream scheduled ${formatDate(scheduledStream.startsAt)}`
                : "No stream scheduled"
            }
            href="/dashboard/live/streams"
          />
          <MomentumMilestone
            icon={<Film />}
            label="Music Video"
            value={video ? "Music video ready" : "Add music video"}
            href={video ? "/dashboard/videos" : "/dashboard/videos/new"}
          />
        </div>
        <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Recommended next action
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {recommendation.text}
            </p>
          </div>
          <Button asChild size="sm">
            {recommendation.href === "/dashboard/tracks/$id" ? (
              <Link params={{ id: track.id }} to={recommendation.href}>
                {recommendation.label}
              </Link>
            ) : (
              <Link to={recommendation.href}>{recommendation.label}</Link>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ProjectMomentumCard({
  parties,
  project,
}: {
  parties: ListeningPartySummary[];
  project: ProjectSummary;
}) {
  const party = parties.find((entry) => entry.projectId === project.id);
  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
            {project.coverArtUrl ? (
              <img
                alt={`${project.title} cover`}
                className="size-full object-cover"
                src={project.coverArtUrl}
              />
            ) : (
              <Music2 className="size-6 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <CardTitle className="truncate">{project.title}</CardTitle>
            <CardDescription>
              {project.projectType.toUpperCase()} · {project.trackCount} tracks
            </CardDescription>
          </div>
        </div>
        <Badge>
          <Check data-icon="inline-start" /> Released
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <MomentumMilestone
          icon={<PartyPopper />}
          label="Listening Party"
          value={
            party
              ? `Listening Party · ${formatDate(party.scheduledStartAt)}`
              : "Host Listening Party"
          }
          href="/dashboard/live/parties"
        />
        <MomentumMilestone
          icon={<Film />}
          label="Music Video"
          value="Add a project video"
          href="/dashboard/videos/new"
        />
        <Button asChild className="w-full" variant="outline">
          <Link params={{ id: project.id }} to="/dashboard/projects/$id">
            Open project
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function MomentumMilestone({
  icon,
  label,
  value,
  href,
  trackId,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  href:
    | "/dashboard/live"
    | "/dashboard/live/my-kit"
    | "/dashboard/live/parties"
    | "/dashboard/live/streams"
    | "/dashboard/tracks/$id"
    | "/dashboard/videos"
    | "/dashboard/videos/new";
  trackId?: string;
}) {
  const content = (
    <>
      <span className="text-primary">{icon}</span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="block truncate text-sm font-medium">{value}</span>
      </span>
    </>
  );

  if (trackId) {
    return (
      <Link
        className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:border-primary/50 hover:bg-muted/30"
        params={{ id: trackId }}
        to="/dashboard/tracks/$id"
      >
        {content}
      </Link>
    );
  }

  return (
    <Link
      className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:border-primary/50 hover:bg-muted/30"
      to={href}
    >
      {content}
    </Link>
  );
}

function lyricsStateForTrack(track: TrackSummary) {
  if (track.lyricsStatus === "approved") {
    return { label: "Lyrics ready" };
  }
  if (track.lyricsStatus === "generating") {
    return { label: "Lyrics processing" };
  }
  if (
    track.lyricsStatus === "pending_review" ||
    track.lyricsStatus === "failed"
  ) {
    return { label: "Review lyrics" };
  }
  return { label: "Add lyrics" };
}

interface LiveExperienceSummary {
  id: string;
  kind: "battle" | "party" | "stream";
  startsAt: string;
  status: "scheduled" | "live" | "ended";
  title: string;
}

interface UpcomingEvent {
  icon: string;
  id: string;
  startsAt: string;
  title: string;
  type: string;
}

function buildUpcomingEvents({
  battles,
  experiences,
  parties,
  projects,
  tracks,
  videos,
}: {
  battles: BattleSummary[];
  experiences: LiveExperienceSummary[];
  parties: ListeningPartySummary[];
  projects: ProjectSummary[];
  tracks: TrackSummary[];
  videos: VideoSummary[];
}) {
  const now = Date.now(),
    events: UpcomingEvent[] = [];
  for (const track of tracks) {
    if (
      track.releaseStrategy === "scheduled" &&
      track.releaseAt &&
      new Date(track.releaseAt).getTime() > now
    ) {
      events.push({
        icon: "♪",
        id: `track-${track.id}`,
        startsAt: track.releaseAt,
        title: track.title,
        type: "Scheduled release",
      });
    }
  }
  for (const project of projects) {
    if (
      project.status === "scheduled" &&
      project.releaseDate &&
      new Date(project.releaseDate).getTime() > now
    ) {
      events.push({
        icon: "◈",
        id: `project-${project.id}`,
        startsAt: project.releaseDate,
        title: project.title,
        type: "Scheduled project release",
      });
    }
  }
  for (const party of parties) {
    if (
      party.status === "scheduled" &&
      new Date(party.scheduledStartAt).getTime() > now
    ) {
      events.push({
        icon: "◉",
        id: `party-${party.id}`,
        startsAt: party.scheduledStartAt,
        title: party.title,
        type: "Listening Party",
      });
    }
  }
  for (const battle of battles) {
    if (
      battle.status === "scheduled" &&
      battle.startsAt &&
      new Date(battle.startsAt).getTime() > now
    ) {
      events.push({
        icon: "⚔",
        id: `battle-${battle.id}`,
        startsAt: battle.startsAt,
        title: battle.title,
        type: "Battle",
      });
    }
  }
  for (const experience of experiences) {
    if (
      experience.status === "scheduled" &&
      new Date(experience.startsAt).getTime() > now &&
      experience.kind === "stream"
    ) {
      events.push({
        icon: "●",
        id: `experience-${experience.id}`,
        startsAt: experience.startsAt,
        title: experience.title,
        type: "Live Stream",
      });
    }
  }
  for (const video of videos) {
    if (video.releaseAt && new Date(video.releaseAt).getTime() > now) {
      events.push({
        icon: "▶",
        id: `video-${video.id}`,
        startsAt: video.releaseAt,
        title: video.title,
        type: "Music Video Premiere",
      });
    }
  }
  return events
    .toSorted(
      (first, second) =>
        new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime()
    )
    .slice(0, 8);
}
