"use client";

import { createFileRoute } from "@tanstack/react-router";
import { Film, Grid3x3, LayoutGrid, LoaderCircle, Music } from "lucide-react";

import { ProfileShell } from "@/components/dashboard/profile/profile-shell";
import { TrackCard } from "@/components/explore/track-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useArtistQuery,
  useMeQuery,
  useTracksQuery,
} from "@/lib/soundkit-api-hooks";
import type { ArtistSummary } from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/_explore/artist/$username")({
  component: ArtistProfilePage,
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
};

const formatJoinedDate = (joinedAt?: string) => {
  if (!joinedAt) {
    return "SoundKit";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    year: "numeric",
  }).format(new Date(joinedAt));
};

const artistToProfileUser = (
  artist: ArtistSummary,
  trackCountOverride?: number
) => ({
  avatar: artist.avatarUrl ?? "/diverse-user-avatars.png",
  battleRank: artist.battleCount ? `#${artist.battleCount}` : "#NR",
  battleRecord: artist.battleCount ? `${artist.battleCount}-0` : "0-0",
  bio:
    artist.bio ??
    `${artist.genre} artist${artist.location ? ` from ${artist.location}` : ""}.`,
  coverImage: artist.coverImageUrl ?? "/hip-hop-battle-stage.jpg",
  followers: formatCount(artist.followers),
  following: "0",
  genre: artist.genre,
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
  monthlyListeners: formatCount(artist.weeklyPlays),
  name: artist.name,
  tracks: trackCountOverride ?? artist.trackCount ?? 0,
  username: artist.username,
  verified: artist.verified,
});

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

function ArtistProfilePage() {
  const { username } = Route.useParams();
  const artistQuery = useArtistQuery(username);
  const meQuery = useMeQuery();

  const currentUser = meQuery.data?.user;
  const artist = artistQuery.data;

  const isOwner = Boolean(
    artist &&
    currentUser &&
    (currentUser.username?.toLowerCase() === artist.username.toLowerCase() ||
      currentUser.id === artist.id)
  );

  const tracksQuery = useTracksQuery(undefined, {
    scope: isOwner ? "dashboard" : "public",
  });

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

  const allTracks = tracksQuery.data ?? [];
  const artistTracks = allTracks.filter(
    (t) =>
      t.artistUsername?.toLowerCase() === artist.username.toLowerCase() ||
      t.artistName?.toLowerCase() === artist.name.toLowerCase() ||
      isOwner
  );

  return (
    <ProfileShell
      isOwner={isOwner}
      targetIsArtist={true}
      user={artistToProfileUser(artist, artistTracks.length)}
      viewerAccountType={meQuery.data?.user.accountType ?? null}
    >
      <Tabs defaultValue="all" className="w-full">
        <div className="flex items-center justify-center border-border/10 border-t">
          <TabsList className="h-14 gap-8 bg-transparent md:gap-16">
            <TabsTrigger
              value="all"
              className="h-full gap-2 rounded-none border-transparent border-t-2 px-0 font-bold text-[10px] uppercase tracking-widest data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none md:text-xs"
            >
              <Grid3x3 className="size-4" />
              <span className="hidden sm:inline">Feed</span>
            </TabsTrigger>
            <TabsTrigger
              value="tracks"
              className="h-full gap-2 rounded-none border-transparent border-t-2 px-0 font-bold text-[10px] uppercase tracking-widest data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none md:text-xs"
            >
              <Music className="size-4" />
              <span className="hidden sm:inline">Tracks</span>
            </TabsTrigger>
            <TabsTrigger
              value="projects"
              className="h-full gap-2 rounded-none border-transparent border-t-2 px-0 font-bold text-[10px] uppercase tracking-widest data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none md:text-xs"
            >
              <LayoutGrid className="size-4" />
              <span className="hidden sm:inline">Projects</span>
            </TabsTrigger>
            <TabsTrigger
              value="videos"
              className="h-full gap-2 rounded-none border-transparent border-t-2 px-0 font-bold text-[10px] uppercase tracking-widest data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none md:text-xs"
            >
              <Film className="size-4" />
              <span className="hidden sm:inline">Videos</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="all" className="mt-6">
          {artistTracks.length > 0 ? (
            <div className="flex flex-wrap gap-4">
              {artistTracks.map((t) => (
                <TrackCard
                  key={t.id}
                  id={t.id}
                  title={t.title}
                  artist={t.artistName}
                  artistSlug={t.artistUsername ?? artist.username}
                  cover={t.coverArtUrl ?? "/placeholder.svg"}
                  plays={t.plays ? t.plays.toLocaleString() : "0"}
                  duration={t.duration ?? "3:20"}
                />
              ))}
            </div>
          ) : (
            <EmptyArtistTab label="public posts" username={artist.username} />
          )}
        </TabsContent>
        <TabsContent value="tracks" className="mt-6">
          {artistTracks.length > 0 ? (
            <div className="flex flex-wrap gap-4">
              {artistTracks.map((t) => (
                <TrackCard
                  key={t.id}
                  id={t.id}
                  title={t.title}
                  artist={t.artistName}
                  artistSlug={t.artistUsername ?? artist.username}
                  cover={t.coverArtUrl ?? "/placeholder.svg"}
                  plays={t.plays ? t.plays.toLocaleString() : "0"}
                  duration={t.duration ?? "3:20"}
                />
              ))}
            </div>
          ) : (
            <EmptyArtistTab label="tracks" username={artist.username} />
          )}
        </TabsContent>
        <TabsContent value="projects" className="mt-6">
          <EmptyArtistTab label="projects" username={artist.username} />
        </TabsContent>
        <TabsContent value="videos" className="mt-6">
          <EmptyArtistTab label="videos" username={artist.username} />
        </TabsContent>
      </Tabs>
    </ProfileShell>
  );
}
