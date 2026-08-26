"use client";
/* eslint-disable complexity, sort-vars, one-var */

import {
  Globe,
  Heart,
  Instagram,
  Music,
  Play,
  Radio,
  Share2,
  ShoppingBag,
  Twitter,
  Video,
  Youtube,
} from "lucide-react";
import { useMemo, useState } from "react";

import { useAudioPlayer } from "@/components/audio-player-provider";
import { AppImage } from "@/components/ui/app-image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import {
  useArtistQuery,
  useTracksQuery,
  useVideosQuery,
} from "@/lib/soundkit-api-hooks";

export interface CreatorProfileData {
  avatarUrl?: string | null;
  bio?: string | null;
  displayName: string;
  followersCount?: number;
  id?: string;
  isVerified?: boolean;
  socials?: {
    instagram?: string;
    soundcloud?: string;
    spotify?: string;
    twitter?: string;
    website?: string;
    youtube?: string;
  };
  username: string;
}

export interface CreatorMusicTrack {
  artistName: string;
  coverArtUrl?: string | null;
  duration?: number;
  genre?: string | null;
  id: string;
  priceCents?: number;
  streamUrl?: string | null;
  title: string;
}

export interface CreatorVideoItem {
  duration?: string;
  id: string;
  publishedAt?: string;
  thumbnailUrl?: string | null;
  title: string;
  views?: number;
}

export interface LiveCreatorPanelProps {
  creator: CreatorProfileData;
  genre?: string | null;
  isLive?: boolean;
  onFollowToggle?: () => void;
  onPlayTrack?: (track: CreatorMusicTrack) => void;
  statusLabel?: string;
  title: string;
  topTracks?: CreatorMusicTrack[];
  videos?: CreatorVideoItem[];
  videoScope?: "dashboard" | "public";
  viewerCount?: number;
}

export function LiveCreatorPanel({
  creator,
  genre,
  isLive = true,
  onFollowToggle,
  onPlayTrack,
  statusLabel,
  title,
  topTracks: explicitTracks,
  videoScope = "dashboard",
  videos: explicitVideos,
  viewerCount = 0,
}: LiveCreatorPanelProps) {
  const [isFollowing, setIsFollowing] = useState(false),
    { setCurrentTrack, setQueue } = useAudioPlayer(),
    artistQuery = useArtistQuery(creator.username),
    tracksQuery = useTracksQuery(undefined, {
      q: creator.username || creator.displayName,
    }),
    videosQuery = useVideosQuery({
      q: creator.username || creator.displayName,
      scope: videoScope,
    }),
    artistData = artistQuery.data,
    resolvedFollowers = artistData?.followers ?? creator.followersCount ?? 0,
    resolvedBio =
      artistData?.bio ||
      creator.bio ||
      `${creator.displayName} is streaming live on SoundKit. Tune in to connect and collaborate.`,
    resolvedAvatar =
      artistData?.avatarUrl ||
      creator.avatarUrl ||
      "/soundkit-default-avatar.svg",
    resolvedSocials = {
      instagram:
        artistData?.links?.instagram || creator.socials?.instagram || undefined,
      personalSite:
        artistData?.links?.personalSite ||
        artistData?.links?.personalSite ||
        creator.socials?.website ||
        undefined,
      spotify:
        artistData?.links?.spotify || creator.socials?.spotify || undefined,
      twitter:
        artistData?.links?.twitter || creator.socials?.twitter || undefined,
      youtube:
        artistData?.links?.youtube || creator.socials?.youtube || undefined,
    },
    loadedTracks = useMemo(() => {
      if (explicitTracks && explicitTracks.length > 0) {
        return explicitTracks;
      }
      if (tracksQuery.data && tracksQuery.data.length > 0) {
        return tracksQuery.data.slice(0, 6).map((t) => ({
          artistName: t.artistName || creator.displayName,
          coverArtUrl: t.coverArtUrl,
          duration: undefined,
          genre: t.genre,
          id: t.id,
          priceCents: t.priceCents ?? undefined,
          streamUrl: t.playbackUrl,
          title: t.title,
        }));
      }
      return [];
    }, [creator.displayName, explicitTracks, tracksQuery.data]),
    loadedVideos = useMemo(() => {
      if (explicitVideos && explicitVideos.length > 0) {
        return explicitVideos;
      }
      if (videosQuery.data && videosQuery.data.length > 0) {
        return videosQuery.data.slice(0, 6).map((v) => ({
          duration: v.duration,
          id: v.id,
          publishedAt: v.releaseAt ?? undefined,
          thumbnailUrl: v.thumbnailUrl,
          title: v.title,
          views: v.viewCount ? Number(v.viewCount) : undefined,
        }));
      }
      return [];
    }, [explicitVideos, videosQuery.data]),
    handleShare = async () => {
      const url = window.location.href;
      if (navigator.share) {
        try {
          await navigator.share({
            text: `Watch ${creator.displayName} live on SoundKit!`,
            title,
            url,
          });
          return;
        } catch {
          // Fallback to clipboard
        }
      }
      await navigator.clipboard.writeText(url);
      toast({
        description: "Stream link copied to clipboard.",
        title: "Link Copied",
      });
    },
    handleFollowClick = () => {
      setIsFollowing((prev) => !prev);
      onFollowToggle?.();
      toast({
        description: isFollowing
          ? `Unfollowed @${creator.username}`
          : `You are now following @${creator.username}! You'll receive live notifications.`,
        title: isFollowing ? "Unfollowed" : "Following",
      });
    },
    handlePlayTrackClick = (track: CreatorMusicTrack) => {
      if (onPlayTrack) {
        onPlayTrack(track);
        return;
      }
      const playerTrack = {
        artist: track.artistName,
        cover: track.coverArtUrl ?? "/default-track-artwork.png",
        duration: track.duration ?? 180,
        id: track.id,
        src: track.streamUrl ?? "",
        title: track.title,
      };
      setQueue([playerTrack]);
      setCurrentTrack(playerTrack);
    };

  return (
    <div className="space-y-6 pt-4">
      {/* Stream & Creator Header Bar */}
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-border/50 bg-card/60 p-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="relative shrink-0">
            <Avatar
              className={`size-14 border-2 ${
                isLive
                  ? "border-destructive ring-2 ring-destructive/40 ring-offset-2 ring-offset-background"
                  : "border-border"
              }`}
            >
              <AvatarImage alt={creator.displayName} src={resolvedAvatar} />
              <AvatarFallback className="font-bold">
                {creator.displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {isLive && (
              <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded bg-destructive px-1.5 py-0.5 font-bold text-[9px] text-destructive-foreground tracking-wider uppercase">
                LIVE
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate font-bold text-lg leading-tight">
                {title}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-foreground">
                {creator.displayName}
              </span>
              <span className="text-muted-foreground">@{creator.username}</span>
              {genre && (
                <Badge className="font-medium text-[10px]" variant="secondary">
                  {genre}
                </Badge>
              )}
              {statusLabel && (
                <Badge className="text-[10px]" variant="outline">
                  {statusLabel}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls & Live Count */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:self-center">
          {isLive && (
            <div className="flex items-center gap-1.5 rounded-lg border bg-background/80 px-3 py-1.5 font-mono text-xs font-semibold text-destructive shadow-sm">
              <Radio className="size-3.5 animate-pulse" />
              <span>{viewerCount.toLocaleString()} Viewers</span>
            </div>
          )}

          <Button
            className={
              isFollowing
                ? "border-primary/50 text-foreground"
                : "bg-primary text-primary-foreground"
            }
            onClick={handleFollowClick}
            size="sm"
            variant={isFollowing ? "outline" : "default"}
          >
            <Heart
              className={`mr-1.5 size-3.5 ${
                isFollowing ? "fill-destructive text-destructive" : ""
              }`}
            />
            {isFollowing ? "Following" : "Follow"}
          </Button>

          <Button onClick={handleShare} size="sm" variant="outline">
            <Share2 className="mr-1.5 size-3.5" />
            Share
          </Button>
        </div>
      </div>

      {/* Creator Tabs */}
      <Tabs className="w-full" defaultValue="about">
        <TabsList className="grid w-full grid-cols-4 sm:w-auto sm:inline-flex">
          <TabsTrigger value="about">About</TabsTrigger>
          <TabsTrigger value="music">
            Music {loadedTracks.length > 0 ? `(${loadedTracks.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="videos">
            Videos {loadedVideos.length > 0 ? `(${loadedVideos.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="shop">Shop &amp; Kits</TabsTrigger>
        </TabsList>

        {/* About Tab */}
        <TabsContent className="space-y-4 pt-4" value="about">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">
                  About {creator.displayName}
                </CardTitle>
                <CardDescription>
                  {resolvedFollowers > 0
                    ? `${resolvedFollowers.toLocaleString()} followers on SoundKit`
                    : "SoundKit Creator"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                <p>{resolvedBio}</p>
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  {resolvedSocials.instagram && (
                    <Button asChild size="sm" variant="outline">
                      <a
                        href={resolvedSocials.instagram}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <Instagram className="mr-1.5 size-3.5 text-pink-500" />
                        Instagram
                      </a>
                    </Button>
                  )}
                  {resolvedSocials.twitter && (
                    <Button asChild size="sm" variant="outline">
                      <a
                        href={resolvedSocials.twitter}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <Twitter className="mr-1.5 size-3.5 text-sky-400" />
                        Twitter / X
                      </a>
                    </Button>
                  )}
                  {resolvedSocials.youtube && (
                    <Button asChild size="sm" variant="outline">
                      <a
                        href={resolvedSocials.youtube}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <Youtube className="mr-1.5 size-3.5 text-red-500" />
                        YouTube
                      </a>
                    </Button>
                  )}
                  {resolvedSocials.personalSite && (
                    <Button asChild size="sm" variant="outline">
                      <a
                        href={resolvedSocials.personalSite}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <Globe className="mr-1.5 size-3.5" />
                        Website
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Broadcast Schedule</CardTitle>
                <CardDescription>Creator stream alerts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="rounded-md border p-3 bg-background/50 space-y-1">
                  <p className="font-semibold text-foreground">
                    Live Notifications
                  </p>
                  <p className="text-muted-foreground">
                    Follow @{creator.username} to get push and in-app alerts
                    whenever they go live with battles, listening parties, and
                    studio sessions.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Music Tab */}
        <TabsContent className="space-y-4 pt-4" value="music">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Music className="size-4 text-primary" />
                Featured Tracks &amp; Releases
              </CardTitle>
              <CardDescription>
                Releases and tracks by {creator.displayName}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadedTracks.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  <Music className="mx-auto size-7 mb-2 opacity-50" />
                  No public tracks released yet.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {loadedTracks.map((track) => (
                    <div
                      className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40"
                      key={track.id}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative group size-10 shrink-0 overflow-hidden rounded-md bg-muted">
                          <AppImage
                            alt={track.title}
                            className="size-full object-cover"
                            height={40}
                            src={
                              track.coverArtUrl || "/default-track-artwork.png"
                            }
                            width={40}
                          />
                          <button
                            className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handlePlayTrackClick(track)}
                            type="button"
                          >
                            <Play className="size-4 fill-white text-white" />
                          </button>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-sm">
                            {track.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {track.artistName}{" "}
                            {track.genre ? `• ${track.genre}` : ""}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {track.priceCents ? (
                          <Badge variant="outline">
                            ${(track.priceCents / 100).toFixed(2)}
                          </Badge>
                        ) : null}
                        <Button
                          onClick={() => handlePlayTrackClick(track)}
                          size="sm"
                          variant="secondary"
                        >
                          <Play className="mr-1 size-3 fill-current" />
                          Play
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Videos Tab */}
        <TabsContent className="space-y-4 pt-4" value="videos">
          {loadedVideos.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                <Video className="mx-auto size-7 mb-2 opacity-50" />
                No public videos published yet.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {loadedVideos.map((v) => (
                <Card className="overflow-hidden group" key={v.id}>
                  <div className="relative aspect-video w-full bg-muted">
                    <AppImage
                      alt={v.title}
                      className="size-full object-cover"
                      height={180}
                      src={v.thumbnailUrl || "/default-track-artwork.png"}
                      width={320}
                    />
                    {v.duration && (
                      <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 font-mono text-[10px] text-white">
                        {v.duration}
                      </span>
                    )}
                  </div>
                  <CardHeader className="p-3.5">
                    <CardTitle className="line-clamp-1 text-sm">
                      {v.title}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {v.views ? `${v.views.toLocaleString()} views • ` : ""}
                      {v.publishedAt}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Shop Tab */}
        <TabsContent className="space-y-4 pt-4" value="shop">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingBag className="size-4 text-primary" />
                Official Kits &amp; Digital Store
              </CardTitle>
              <CardDescription>
                Sound kits, presets, and digital items by {creator.displayName}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                <ShoppingBag className="mx-auto size-7 mb-2 opacity-50" />
                No digital kits currently listed in store.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
