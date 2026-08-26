"use client";
/* eslint-disable one-var, sort-vars, complexity, no-nested-ternary, unicorn/no-nested-ternary, unicorn/no-negated-condition, react/set-state-in-effect */

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  FileBadge2,
  Film,
  Grid3x3,
  LayoutGrid,
  LoaderCircle,
  Music,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { ProfileShell } from "@/components/dashboard/profile/profile-shell";
import { ProjectCard } from "@/components/explore/project-card";
import { TrackCard } from "@/components/explore/track-card";
import { VideoCard } from "@/components/explore/video-card";
import type { ExploreVideoCardData } from "@/components/explore/video-card";
import { AppImage } from "@/components/ui/app-image";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { absoluteSiteUrl, createShareMeta, seoDescription } from "@/lib/seo";
import { loadPublicArtistSeo } from "@/lib/seo-data";
import type { ArtistSeoData } from "@/lib/seo-data";
import {
  useArtistMediaQuery,
  useArtistQuery,
  useMeQuery,
} from "@/lib/soundkit-api-hooks";
import type {
  ArtistProfileCredit,
  ArtistSummary,
  PublicProjectSummary,
  TrackSummary,
  VideoSummary,
} from "@/lib/soundkit-api-hooks";

const artistProfileTabs = [
  "all",
  "tracks",
  "projects",
  "videos",
  "credits",
] as const;
type ArtistProfileTab = (typeof artistProfileTabs)[number];

const isArtistProfileTab = (value: unknown): value is ArtistProfileTab =>
  typeof value === "string" &&
  artistProfileTabs.includes(value as ArtistProfileTab);

export const Route = createFileRoute("/_explore/artist/$username")({
  component: ArtistProfilePage,
  head: ({ loaderData, params }) => {
    const artist = loaderData as unknown as ArtistSeoData | null,
      artistName = artist?.name ?? `@${params.username}`,
      canonicalPath = `/artist/${artist?.username ?? params.username}`,
      title = `Check out ${artistName} on SoundKit`,
      description = seoDescription(
        artist?.bio,
        `Listen to tracks, watch videos, and follow ${artistName} on SoundKit.`
      ),
      head = createShareMeta({
        canonicalPath,
        description,
        imageUrl: artist?.coverImageUrl ?? artist?.avatarUrl,
        title,
        type: "profile",
      });

    return {
      ...head,
      scripts: artist
        ? [
            {
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "MusicGroup",
                genre: artist.genre,
                image: absoluteSiteUrl(
                  artist.coverImageUrl ?? artist.avatarUrl ?? "/placeholder.svg"
                ),
                name: artistName,
                url: absoluteSiteUrl(canonicalPath),
              }),
              type: "application/ld+json",
            },
          ]
        : [],
    };
  },
  loader: async ({ params }) => {
    try {
      return await loadPublicArtistSeo(params.username);
    } catch {
      return null;
    }
  },
});

const formatCount = (value?: number) => {
    if (!value) {
      return "0";
    }

    if (value >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1)}M`;
    }

    if (value >= 1000) {
      return `${Math.round(value / 1000)}K`;
    }

    return value.toLocaleString();
  },
  formatJoinedDate = (joinedAt?: string) => {
    if (!joinedAt) {
      return "SoundKit";
    }

    return new Intl.DateTimeFormat("en", {
      month: "short",
      year: "numeric",
    }).format(new Date(joinedAt));
  },
  artistToProfileUser = (
    artist: ArtistSummary,
    trackCountOverride?: number,
    totalPlaysOverride?: number
  ) => ({
    avatar: artist.avatarUrl ?? "/soundkit-default-avatar.svg",
    battleRank: artist.battleCount ? `#${artist.battleCount}` : "#NR",
    battleRecord: artist.battleCount ? `${artist.battleCount}-0` : "0-0",
    bio:
      artist.bio ??
      `${artist.genre} artist${artist.location ? ` from ${artist.location}` : ""}.`,
    coverImage: artist.coverImageUrl ?? "/soundkit-default-banner.svg",
    followerCount: artist.followers,
    followers: formatCount(artist.followers),
    following: "0",
    genre: artist.genre,
    isFollowing: artist.isFollowing ?? false,
    joinedDate: formatJoinedDate(artist.joinedAt),
    links: {
      appleMusic: artist.links?.apple,
      instagram: artist.links?.instagram,
      personalSite: artist.links?.personalSite,
      soundcloud: artist.links?.soundcloud,
      spotify: artist.links?.spotify,
      tiktok: artist.links?.tiktok,
      twitter: artist.links?.twitter,
      youtube: artist.links?.youtube,
    },
    location: artist.location || artist.state || "SoundKit",
    monthlyListeners: formatCount(
      totalPlaysOverride ?? artist.weeklyPlays ?? 0
    ),
    name: artist.name,
    tracks: trackCountOverride ?? artist.trackCount ?? 0,
    username: artist.username,
    verified: artist.verified,
  }),
  videoCardData = (
    video: VideoSummary,
    fallbackArtist: ArtistSummary
  ): ExploreVideoCardData => ({
    creator: {
      avatarUrl: video.creatorAvatarUrl ?? fallbackArtist.avatarUrl,
      name: video.creatorName ?? fallbackArtist.name,
      slug: video.creatorUsername ?? fallbackArtist.username,
    },
    duration: video.duration ?? "0:00",
    id: video.id,
    playbackPolicy: video.playbackPolicy,
    regionSlug: video.regionSlug,
    slug: video.slug,
    status: video.status,
    thumbnail: video.thumbnailUrl ?? "/placeholder.svg",
    title: video.title,
    verifiedOnPlatform: video.verifiedOnPlatform,
    videoKind: video.videoKind,
    viewCount: video.viewCount ?? "0",
  }),
  creditRoleLabel = (role: ArtistProfileCredit["role"]) => {
    if (role === "songwriter") {
      return "Songwriter";
    }

    if (role === "producer") {
      return "Producer";
    }

    return "Engineer";
  };

function EmptyArtistTab({
  label,
  username,
}: {
  label: string;
  username: string;
}) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center">
      <h2 className="font-semibold text-lg">No {label} yet</h2>
      <p className="mx-auto mt-2 max-w-md text-muted-foreground text-sm">
        @{username} has not published public {label.toLowerCase()} on SoundKit
        yet.
      </p>
    </div>
  );
}

function MediaLoading() {
  return (
    <div className="flex min-h-48 items-center justify-center">
      <LoaderCircle
        aria-label="Loading artist media"
        className="size-6 animate-spin text-primary"
      />
    </div>
  );
}

function ProfileSection({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description?: string;
  title: string;
}) {
  const headingId = `profile-${title.toLowerCase().replaceAll(" ", "-")}`;

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <div>
        <h2 className="font-bold text-xl tracking-tight" id={headingId}>
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-muted-foreground text-sm">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function TrackGrid({ tracks }: { tracks: TrackSummary[] }) {
  return (
    <div className="flex flex-wrap gap-4">
      {tracks.map((track) => (
        <TrackCard
          artist={track.artistName}
          artistSlug={track.artistUsername ?? "artist"}
          cover={track.coverArtUrl ?? "/placeholder.svg"}
          duration={track.duration ?? "0:00"}
          id={track.id}
          key={track.id}
          plays={track.plays ? track.plays.toLocaleString() : "0"}
          regionSlug={track.regionSlug}
          slug={track.slug}
          title={track.title}
        />
      ))}
    </div>
  );
}

function ProjectGrid({ projects }: { projects: PublicProjectSummary[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}

function VideoGrid({
  artist,
  videos,
}: {
  artist: ArtistSummary;
  videos: VideoSummary[];
}) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {videos.map((video) => (
        <VideoCard key={video.id} video={videoCardData(video, artist)} />
      ))}
    </div>
  );
}

function CreditGroupSection({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="space-y-4">
      <h3 className="font-semibold text-sm uppercase tracking-widest text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

function CreditList({ credits }: { credits: ArtistProfileCredit[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {credits.map((credit) => {
        const link =
          credit.contentType === "track"
            ? {
                params: { id: credit.contentId },
                to: "/tracks/$id" as const,
              }
            : {
                params: { id: credit.contentId },
                to: "/projects/$id" as const,
              };

        return (
          <Link
            {...link}
            className="group flex gap-4 rounded-xl border border-border/50 bg-card/60 p-3 transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            key={`${credit.contentType}-${credit.contentId}-${credit.role}`}
          >
            <AppImage
              alt={`${credit.title} artwork`}
              className="size-20 shrink-0 rounded-lg object-cover"
              height={160}
              src={credit.coverArtUrl ?? "/placeholder.svg"}
              width={160}
            />
            <div className="min-w-0 flex-1 py-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold group-hover:text-primary">
                    {credit.title}
                  </h3>
                  <p className="truncate text-muted-foreground text-sm">
                    {credit.ownerName}
                  </p>
                </div>
                <Badge variant="secondary">
                  {creditRoleLabel(credit.role)}
                </Badge>
              </div>
              <p className="mt-3 text-muted-foreground text-xs uppercase tracking-wide">
                {credit.contentType === "track"
                  ? "Track credit"
                  : `${credit.projectType ?? "Project"} credit`}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function FeaturedMedia({
  projects,
  tracks,
}: {
  projects: PublicProjectSummary[];
  tracks: TrackSummary[];
}) {
  return (
    <ProfileSection
      description="Public releases by other artists that include this artist as a performer."
      title="Also Featured On"
    >
      <div className="space-y-6">
        {tracks.length > 0 ? <TrackGrid tracks={tracks} /> : null}
        {projects.length > 0 ? <ProjectGrid projects={projects} /> : null}
      </div>
    </ProfileSection>
  );
}

function ArtistProfilePage() {
  const { username } = Route.useParams(),
    artistQuery = useArtistQuery(username),
    mediaQuery = useArtistMediaQuery(username),
    meQuery = useMeQuery(),
    [activeTab, setActiveTab] = useState<ArtistProfileTab>("all");

  useEffect(() => {
    const hashTab = window.location.hash.replace("#", "");

    if (isArtistProfileTab(hashTab)) {
      setActiveTab(hashTab);
    }
  }, []);

  const currentUser = meQuery.data?.user,
    artist = artistQuery.data,
    media = mediaQuery.data,
    isOwner = Boolean(
      artist &&
      currentUser &&
      (currentUser.username?.toLowerCase() === artist.username.toLowerCase() ||
        currentUser.id === artist.id)
    ),
    artistTracks = media?.tracks ?? [],
    totalArtistPlays = artistTracks.reduce(
      (sum, track) => sum + (track.plays || 0),
      0
    );

  if (artistQuery.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoaderCircle className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="px-4 py-10 text-center">
        <h1 className="font-bold text-2xl">Artist not found</h1>
        <p className="mt-2 text-muted-foreground">
          This profile is not public yet.
        </p>
      </div>
    );
  }

  const projects = media?.projects ?? [],
    videos = media?.videos ?? [],
    featuredTracks = media?.featuredTracks ?? [],
    featuredProjects = media?.featuredProjects ?? [],
    credits = media?.credits ?? [],
    songwritingCredits = credits.filter(
      (credit) => credit.role === "songwriter"
    ),
    productionCredits = credits.filter(
      (credit) => credit.role === "producer" || credit.role === "engineer"
    ),
    hasCreditsContent =
      credits.length > 0 ||
      featuredTracks.length > 0 ||
      featuredProjects.length > 0,
    hasFeedContent =
      artistTracks.length > 0 ||
      projects.length > 0 ||
      videos.length > 0 ||
      featuredTracks.length > 0 ||
      featuredProjects.length > 0;

  return (
    <ProfileShell
      isOwner={isOwner}
      targetIsArtist={true}
      user={artistToProfileUser(
        artist,
        artistTracks.length,
        totalArtistPlays > 0 ? totalArtistPlays : (artist.weeklyPlays ?? 0)
      )}
      viewerAccountType={meQuery.data?.user.accountType ?? null}
    >
      <Tabs
        className="w-full"
        onValueChange={(tab) => {
          if (!isArtistProfileTab(tab)) {
            return;
          }

          setActiveTab(tab);
          window.history.replaceState(null, "", `#${tab}`);
        }}
        value={activeTab}
      >
        <div className="border-border/10 border-t">
          <TabsList className="flex h-14 w-full justify-start gap-6 overflow-x-auto bg-transparent px-1 md:justify-center md:gap-12">
            <TabsTrigger
              className="h-full shrink-0 gap-2 rounded-none border-transparent border-t-2 px-0 font-bold text-[10px] uppercase tracking-widest data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none md:text-xs"
              value="all"
            >
              <Grid3x3 className="size-4" />
              <span>Feed</span>
            </TabsTrigger>
            <TabsTrigger
              className="h-full shrink-0 gap-2 rounded-none border-transparent border-t-2 px-0 font-bold text-[10px] uppercase tracking-widest data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none md:text-xs"
              value="tracks"
            >
              <Music className="size-4" />
              <span>Tracks</span>
            </TabsTrigger>
            <TabsTrigger
              className="h-full shrink-0 gap-2 rounded-none border-transparent border-t-2 px-0 font-bold text-[10px] uppercase tracking-widest data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none md:text-xs"
              value="projects"
            >
              <LayoutGrid className="size-4" />
              <span>Projects</span>
            </TabsTrigger>
            <TabsTrigger
              className="h-full shrink-0 gap-2 rounded-none border-transparent border-t-2 px-0 font-bold text-[10px] uppercase tracking-widest data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none md:text-xs"
              value="videos"
            >
              <Film className="size-4" />
              <span>Videos</span>
            </TabsTrigger>
            <TabsTrigger
              className="h-full shrink-0 gap-2 rounded-none border-transparent border-t-2 px-0 font-bold text-[10px] uppercase tracking-widest data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none md:text-xs"
              value="credits"
            >
              <FileBadge2 className="size-4" />
              <span>Credits</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent className="mt-6" value="all">
          {mediaQuery.isLoading ? <MediaLoading /> : null}
          {!mediaQuery.isLoading && hasFeedContent ? (
            <div className="space-y-10">
              {artistTracks.length > 0 ? (
                <ProfileSection title="Tracks">
                  <TrackGrid tracks={artistTracks.slice(0, 8)} />
                </ProfileSection>
              ) : null}
              {projects.length > 0 ? (
                <ProfileSection title="Projects">
                  <ProjectGrid projects={projects.slice(0, 4)} />
                </ProfileSection>
              ) : null}
              {videos.length > 0 ? (
                <ProfileSection title="Videos">
                  <VideoGrid artist={artist} videos={videos.slice(0, 4)} />
                </ProfileSection>
              ) : null}
              {featuredTracks.length > 0 || featuredProjects.length > 0 ? (
                <FeaturedMedia
                  projects={featuredProjects.slice(0, 4)}
                  tracks={featuredTracks.slice(0, 8)}
                />
              ) : null}
            </div>
          ) : null}
          {!mediaQuery.isLoading && !hasFeedContent ? (
            <EmptyArtistTab label="public posts" username={artist.username} />
          ) : null}
        </TabsContent>

        <TabsContent className="mt-6" value="tracks">
          {mediaQuery.isLoading ? <MediaLoading /> : null}
          {mediaQuery.isLoading ? null : (
            <div className="space-y-10">
              {artistTracks.length > 0 ? (
                <ProfileSection title="Tracks">
                  <TrackGrid tracks={artistTracks} />
                </ProfileSection>
              ) : (
                <EmptyArtistTab label="tracks" username={artist.username} />
              )}
              {featuredTracks.length > 0 ? (
                <FeaturedMedia projects={[]} tracks={featuredTracks} />
              ) : null}
            </div>
          )}
        </TabsContent>

        <TabsContent className="mt-6" value="projects">
          {mediaQuery.isLoading ? <MediaLoading /> : null}
          {mediaQuery.isLoading ? null : (
            <div className="space-y-10">
              {projects.length > 0 ? (
                <ProfileSection title="Projects">
                  <ProjectGrid projects={projects} />
                </ProfileSection>
              ) : (
                <EmptyArtistTab label="projects" username={artist.username} />
              )}
              {featuredProjects.length > 0 ? (
                <FeaturedMedia projects={featuredProjects} tracks={[]} />
              ) : null}
            </div>
          )}
        </TabsContent>

        <TabsContent className="mt-6" value="videos">
          {mediaQuery.isLoading ? <MediaLoading /> : null}
          {!mediaQuery.isLoading && videos.length > 0 ? (
            <VideoGrid artist={artist} videos={videos} />
          ) : null}
          {!mediaQuery.isLoading && videos.length === 0 ? (
            <EmptyArtistTab label="videos" username={artist.username} />
          ) : null}
        </TabsContent>

        <TabsContent className="mt-6" value="credits">
          {mediaQuery.isLoading ? <MediaLoading /> : null}
          {!mediaQuery.isLoading && hasCreditsContent ? (
            <ProfileSection
              description={`How @${artist.username} appears across SoundKit releases.`}
              title="Credits"
            >
              <div className="space-y-10">
                {featuredTracks.length > 0 || featuredProjects.length > 0 ? (
                  <CreditGroupSection title="Performance">
                    {featuredTracks.length > 0 ? (
                      <TrackGrid tracks={featuredTracks} />
                    ) : null}
                    {featuredProjects.length > 0 ? (
                      <ProjectGrid projects={featuredProjects} />
                    ) : null}
                  </CreditGroupSection>
                ) : null}
                {songwritingCredits.length > 0 ? (
                  <CreditGroupSection title="Songwriting">
                    <CreditList credits={songwritingCredits} />
                  </CreditGroupSection>
                ) : null}
                {productionCredits.length > 0 ? (
                  <CreditGroupSection title="Production">
                    <CreditList credits={productionCredits} />
                  </CreditGroupSection>
                ) : null}
              </div>
            </ProfileSection>
          ) : null}
          {!mediaQuery.isLoading && !hasCreditsContent ? (
            <EmptyArtistTab label="credits" username={artist.username} />
          ) : null}
        </TabsContent>
      </Tabs>
    </ProfileShell>
  );
}
