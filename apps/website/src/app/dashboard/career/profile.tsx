import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Calendar,
  ExternalLink,
  FolderOpen,
  MapPin,
  Music2,
  Play,
  Video,
} from "lucide-react";

import { useAudioPlayer } from "@/components/audio-player-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useMeQuery,
  useProjectsQuery,
  useTracksQuery,
  useVideosQuery,
} from "@/lib/soundkit-api-hooks";
import type { TrackSummary } from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/career/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const meQuery = useMeQuery(),
    tracksQuery = useTracksQuery(),
    projectsQuery = useProjectsQuery(),
    videosQuery = useVideosQuery(),
    { setCurrentTrack, setQueue } = useAudioPlayer(),
    user = meQuery.data?.user,
    tracks = tracksQuery.data ?? [],
    projects = projectsQuery.data ?? [],
    videos = videosQuery.data ?? [],
    playableTracks = tracks
      .filter((track) => Boolean(track.playbackUrl))
      .map((track) => ({
        artist: track.artistName,
        artistHref: track.artistUsername
          ? `/artist/${track.artistUsername}`
          : "/dashboard/career/profile",
        cover: track.coverArtUrl ?? "/placeholder.svg",
        id: track.id,
        src: track.playbackUrl ?? "",
        title: track.title,
        trackHref: `/dashboard/tracks/${track.id}`,
      })),
    playTrack = (track: TrackSummary) => {
      const playableTrack = playableTracks.find(
        (entry) => entry.id === track.id
      );

      if (!playableTrack) {
        return;
      }

      setQueue([playableTrack]);
      setCurrentTrack(playableTrack);
    },
    displayName = user?.displayName ?? "Artist",
    initials = displayName
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase(),
    location = [user?.city, user?.state].filter(Boolean).join(", ");

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-border/40 bg-card/50">
        <div
          className="h-36 bg-muted bg-cover bg-center"
          style={{
            backgroundImage: user?.headerUrl
              ? `url(${user.headerUrl})`
              : undefined,
          }}
        />
        <CardContent className="-mt-12 space-y-5 p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <Avatar className="size-28 border-4 border-background">
                <AvatarImage src={user?.avatarUrl ?? undefined} />
                <AvatarFallback>{initials || "SK"}</AvatarFallback>
              </Avatar>
              <div className="space-y-2 pb-1">
                <div>
                  <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-bold">
                    {displayName}
                  </h1>
                  <p className="text-muted-foreground">
                    @{user?.username ?? "set-your-username"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                  {location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="size-4" />
                      {location}
                    </span>
                  )}
                  {user?.onboardingCompletedAt && (
                    <span className="flex items-center gap-1">
                      <Calendar className="size-4" />
                      Joined{" "}
                      {new Date(user.onboardingCompletedAt).toLocaleDateString(
                        undefined,
                        { month: "long", year: "numeric" }
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link to="/dashboard/career/settings">Edit Profile</Link>
              </Button>
              {user?.username && (
                <Button asChild variant="outline">
                  <Link
                    params={{ username: user.username }}
                    to="/artist/$username"
                  >
                    <ExternalLink className="mr-2 size-4" />
                    View Public
                  </Link>
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <ProfileStat label="Tracks" value={tracks.length} />
            <ProfileStat label="Projects" value={projects.length} />
            <ProfileStat label="Videos" value={videos.length} />
          </div>

          {user?.bio ? (
            <p className="max-w-3xl text-sm leading-6">{user.bio}</p>
          ) : (
            <p className="max-w-3xl text-sm text-muted-foreground">
              Add a bio in settings to tell listeners who you are and what you
              make.
            </p>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="tracks">
        <TabsList>
          <TabsTrigger value="tracks">Tracks</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="videos">Videos</TabsTrigger>
        </TabsList>

        <TabsContent value="tracks" className="mt-6">
          {tracks.length === 0 ? (
            <EmptyState
              actionHref="/dashboard/tracks/new"
              actionLabel="Create Track"
              icon={Music2}
              title="No tracks yet"
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {tracks.map((track) => (
                <Card key={track.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                        {track.coverArtUrl ? (
                          <img
                            src={track.coverArtUrl}
                            alt={`${track.title} cover`}
                            className="size-full object-cover"
                          />
                        ) : (
                          <Music2 className="size-8 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link
                          className="font-semibold hover:text-primary"
                          to="/dashboard/tracks"
                        >
                          {track.title}
                        </Link>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {track.genre} - {track.plays.toLocaleString()} plays
                        </p>
                        <div className="mt-3 flex items-center gap-2">
                          <Badge variant="outline">
                            {track.isPublic ? "Public" : "Private"}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => playTrack(track)}
                            disabled={!track.playbackUrl}
                          >
                            <Play className="mr-2 size-4" />
                            Play
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="projects" className="mt-6">
          {projects.length === 0 ? (
            <EmptyState
              actionHref="/dashboard/projects/new"
              actionLabel="Create Project"
              icon={FolderOpen}
              title="No projects yet"
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  params={{ id: project.id }}
                  to="/dashboard/projects/$id"
                >
                  <Card className="transition-colors hover:border-primary/50">
                    <CardContent className="flex gap-4 p-4">
                      <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                        {project.coverArtUrl ? (
                          <img
                            src={project.coverArtUrl}
                            alt={`${project.title} cover`}
                            className="size-full object-cover"
                          />
                        ) : (
                          <FolderOpen className="size-8 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          {project.title}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {project.trackCount} tracks - {project.status}
                        </p>
                        <Badge className="mt-3 capitalize" variant="secondary">
                          {project.projectType}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="videos" className="mt-6">
          {videos.length === 0 ? (
            <EmptyState
              actionHref="/dashboard/videos/new"
              actionLabel="New Video"
              icon={Video}
              title="No videos yet"
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {videos.map((video) => (
                <Card key={video.id}>
                  <CardContent className="p-4">
                    <Video className="mb-4 size-8 text-primary" />
                    <p className="font-semibold">{video.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {video.videoKind.replaceAll("_", " ")} -{" "}
                      {video.sourceProvider}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProfileStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-background/40 p-4">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function EmptyState({
  actionHref,
  actionLabel,
  icon: Icon,
  title,
}: {
  actionHref:
    | "/dashboard/projects/new"
    | "/dashboard/tracks/new"
    | "/dashboard/videos/new";
  actionLabel: string;
  icon: typeof Music2;
  title: string;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="p-8 text-center">
        <Icon className="mx-auto mb-3 size-8 text-muted-foreground" />
        <p className="font-semibold">{title}</p>
        <Button asChild className="mt-4">
          <Link to={actionHref}>{actionLabel}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
