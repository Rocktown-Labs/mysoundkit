"use client";
/* eslint-disable complexity, no-unused-vars, sort-vars, one-var, require-unicode-regexp */

import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
  Bookmark,
  BookmarkCheck,
  Check,
  Disc3,
  Download,
  Flame,
  Heart,
  ListMusic,
  Maximize,
  Minimize,
  Music2,
  Pause,
  Play,
  Plus,
  Radio,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  Volume2,
} from "lucide-react";
import { useEffect, useState } from "react";

import { LiveRoomAccessGuard } from "@/components/explore/live-room-access-guard";
import { LiveCreatorPanel } from "@/components/live/live-creator-panel";
import { LiveTipButton } from "@/components/live/live-tip-button";
import { LiveChatPanel } from "@/components/live/live-room-panels";
import { LiveTwitchShell } from "@/components/live/live-twitch-shell";
import { PartyMediaStage } from "@/components/live/party-media-stage";
import { useBrowserFullscreen } from "@/components/live/use-browser-fullscreen";
import { AppImage } from "@/components/ui/app-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { useDbSavedTrackActions, useDbSavedTrackIds } from "@/lib/data-db";
import { useLiveRoom } from "@/lib/live-room";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_explore/live/parties/$id")({
  component: ListeningPartyDetailPage,
  ssr: "data-only",
});

const SAMPLE_LYRICS: Record<string, { id: string; text: string }[]> = {
  default: [
    { id: "lyric-1", text: "[Intro - Instrumental]" },
    { id: "lyric-2", text: "Late nights in the studio chasing the vibe" },
    { id: "lyric-3", text: "Frequencies align when the stars collide" },
    { id: "lyric-4", text: "Turn the monitors up, let the 808s ride" },
    { id: "lyric-5", text: "SoundKit premiere with the crew worldwide" },
    { id: "lyric-6", text: "" },
    { id: "lyric-7", text: "[Chorus]" },
    { id: "lyric-8", text: "We don't stop till the morning light" },
    { id: "lyric-9", text: "Sonic waves burning through the night" },
    { id: "lyric-10", text: "Drop the needle, hold the groove tight" },
    { id: "lyric-11", text: "Everything feels real, everything feels right" },
    { id: "lyric-12", text: "" },
    { id: "lyric-13", text: "[Verse 2]" },
    { id: "lyric-14", text: "Layer the synth, compress the snare" },
    { id: "lyric-15", text: "Bass heavy vibration in the midnight air" },
    { id: "lyric-16", text: "From the underground to anywhere" },
    { id: "lyric-17", text: "Stream the frequency, nothing else compares" },
  ],
};

const handlePurchaseTrack = (trackTitle: string) => {
  toast({
    description: `Purchased HD Master of "${trackTitle}" for $1.29. Added to downloads!`,
    title: "Track Purchased",
  });
};

const getLyricClass = (lineId: string, text: string) => {
  if (lineId === "lyric-3" || lineId === "lyric-4") {
    return "text-primary font-bold text-sm sm:text-base drop-shadow-md scale-105";
  }
  if (text === "") {
    return "h-2";
  }
  return "text-white/60 hover:text-white/90";
};

function ListeningPartyDetailPage() {
  const { id } = Route.useParams();
  return <ListeningPartyPage roomId={id} />;
}

export function ListeningPartyPage({
  artistView = false,
  roomId,
}: {
  artistView?: boolean;
  roomId: string;
}) {
  const id = roomId,
    router = useRouter(),
    { chat, chatMessages, partyPlayback, query } = useLiveRoom(id),
    [isChatOpen, setIsChatOpen] = useState(true),
    {
      containerRef: videoContainerRef,
      isFullscreen,
      toggleFullscreen,
    } = useBrowserFullscreen(),
    [localIsPlaying] = useState(true),
    [activeTrackId, setActiveTrackId] = useState<string | null>(null),
    [activeTab, setActiveTab] = useState<"tracklist" | "lyrics">("tracklist"),
    [likedTrackIds, setLikedTrackIds] = useState<Set<string>>(new Set()),
    { data: savedTrackRows = [] } = useDbSavedTrackIds(),
    { toggle } = useDbSavedTrackActions(),
    savedTrackIds = new Set(savedTrackRows.map((track) => track.id)),
    [isAlbumSaved, setIsAlbumSaved] = useState(false),
    room = query.data,
    authoritativePlayback = room?.party?.playback,
    isPlaying = authoritativePlayback
      ? authoritativePlayback.playbackState === "playing"
      : localIsPlaying,
    currentTrack =
      room?.tracklist.find(
        (track) =>
          track.id ===
          (activeTrackId ??
            authoritativePlayback?.trackId ??
            room.currentTrackId)
      ) ?? room?.tracklist[0],
    currentTrackIndex = room
      ? Math.max(
          0,
          room.tracklist.findIndex((track) => track.id === currentTrack?.id)
        )
      : 0,
    isHost = artistView && room?.role === "host",
    isCurrentLiked = currentTrack ? likedTrackIds.has(currentTrack.id) : false,
    handleToggleLike = (trackId: string, trackTitle: string) => {
      setLikedTrackIds((prev) => {
        const next = new Set(prev);
        if (next.has(trackId)) {
          next.delete(trackId);
          toast({ description: `Removed "${trackTitle}" from Liked Songs.` });
        } else {
          next.add(trackId);
          toast({ description: `Added "${trackTitle}" to your Liked Songs!` });
        }
        return next;
      });
    },
    handleToggleSaveTrack = async (trackId: string, trackTitle: string) => {
      const wasSaved = savedTrackIds.has(trackId);
      try {
        await toggle(trackId).isPersisted.promise;
        toast({
          description: wasSaved
            ? `Removed "${trackTitle}" from your Library.`
            : `Saved "${trackTitle}" to your Library!`,
          title: wasSaved ? "Track Removed" : "Track Saved",
        });
      } catch {
        toast({
          description: `Could not update "${trackTitle}" in your Library.`,
          title: "Library update failed",
          variant: "destructive",
        });
      }
    },
    handleSaveAlbum = () => {
      setIsAlbumSaved((prev) => !prev);
      toast({
        description: isAlbumSaved
          ? `Removed "${room?.title}" from Library.`
          : `Saved entire "${room?.title}" project to your Library!`,
        title: isAlbumSaved ? "Album Removed" : "Album Saved",
      });
    },
    handlePurchaseAlbum = () => {
      toast({
        description: `Purchased full "${room?.title}" lossless album package for $9.99!`,
        title: "Album Purchased",
      });
    },
    handleReplayTrack = (trackTitle?: string) => {
      const track =
        room?.tracklist.find((entry) => entry.title === trackTitle) ??
        currentTrack;
      if (track) {
        partyPlayback.mutate({ trackId: track.id, type: "replay" });
      }
      toast({
        description: `Restarted "${trackTitle ?? currentTrack?.title ?? "current track"}" for the live room.`,
        title: "Synced Playback",
      });
    },
    handleTogglePlayback = () => {
      partyPlayback.mutate({ type: isPlaying ? "pause" : "resume" });
    };

  useEffect(() => {
    if (artistView || !room || room.role !== "host") {
      return;
    }

    void router.navigate({
      params: { roomId: id },
      replace: true,
      to: "/dashboard/live/parties/join/$roomId/artistview",
    });
  }, [artistView, id, room?.role, router]);

  if (query.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Radio className="mx-auto size-8 animate-pulse text-primary" />
          <p className="mt-3 font-semibold text-sm">Loading live room...</p>
        </div>
      </div>
    );
  }

  if (query.isError || !room) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="font-semibold text-sm">
            {query.error?.message ?? "Listening party offline"}
          </p>
        </div>
      </div>
    );
  }

  if (artistView && room.role !== "host") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <div className="max-w-lg rounded-xl border border-primary/30 bg-card p-6 text-center shadow-xl">
          <h2 className="font-bold text-lg">Artist room access required</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This route is reserved for the artist hosting this listening party.
            Join the public room to watch and chat instead.
          </p>
        </div>
      </div>
    );
  }

  const hostName = room.hostName || "SoundKit Host",
    hostUsername = hostName.toLowerCase().replaceAll(/\s+/g, ""),
    lyrics = SAMPLE_LYRICS.default,
    chatPanel = (
      <LiveChatPanel
        disabled={chat.isPending}
        fillHeight
        messages={chatMessages}
        onCollapse={() => setIsChatOpen(false)}
        onSend={(message) => chat.mutate({ message, userName: "You" })}
        title="Party Chat"
      />
    ),
    videoNode = (
      <div
        className="group relative min-h-[560px] md:min-h-[600px] w-full overflow-hidden bg-zinc-950 select-none rounded-2xl border border-white/10 shadow-2xl flex flex-col justify-between"
        ref={videoContainerRef}
      >
        {/* Ambient Blur Background */}
        <AppImage
          alt={currentTrack?.title ?? room.title}
          className="size-full object-cover opacity-25 blur-3xl transition-all duration-700 scale-110 absolute inset-0 pointer-events-none"
          height={720}
          src={currentTrack?.coverArtUrl ?? "/night-music-album-cover.webp"}
          width={1280}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/85 to-black/60 pointer-events-none" />

        {/* Top Header Strip */}
        <div className="relative z-20 flex items-center justify-between p-4 pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="font-bold bg-primary text-primary-foreground flex items-center gap-1.5 shadow-lg">
              <Disc3 className="size-3.5 animate-spin" />
              LISTENING PARTY
            </Badge>
            <Badge
              className="bg-black/60 backdrop-blur-md text-white border-white/20 hidden sm:inline-flex"
              variant="outline"
            >
              Lossless Synced Audio
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/60 px-3 py-1 font-mono text-xs text-white backdrop-blur-md">
              <Radio className="size-3 text-destructive animate-pulse" />
              <span>{room.viewerCount.toLocaleString()} in room</span>
            </div>
            <Button
              className="size-8 bg-black/60 text-white hover:bg-black/80 backdrop-blur-md"
              onClick={toggleFullscreen}
              size="icon"
              type="button"
              variant="ghost"
            >
              {isFullscreen ? (
                <Minimize className="size-4" />
              ) : (
                <Maximize className="size-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Main Stage Grid: Large Album Cover on Left + Player Header & Full Tracklist on Right */}
        <div className="relative z-10 flex-1 p-4 sm:p-6 pt-2">
          <div className="grid size-full grid-cols-1 md:grid-cols-12 gap-6 items-start">
            {/* Left Side: Prominent Album Cover Art and Album Actions (5 cols) */}
            <div className="md:col-span-5 flex flex-col items-center justify-center text-center p-2">
              <div className="relative group/art">
                <div className="relative size-44 sm:size-56 md:size-64 overflow-hidden rounded-2xl border-2 border-white/20 shadow-2xl transition-transform duration-300 group-hover/art:scale-105">
                  <AppImage
                    alt={currentTrack?.title ?? room.title}
                    className="size-full object-cover"
                    height={256}
                    src={
                      currentTrack?.coverArtUrl ??
                      "/night-music-album-cover.webp"
                    }
                    width={256}
                  />
                  {isPlaying && (
                    <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 shadow-xl backdrop-blur-md">
                      <Volume2 className="size-3.5 text-primary-foreground animate-bounce" />
                      <span className="font-mono text-[10px] font-bold text-primary-foreground">
                        LIVE
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <h2 className="mt-4 font-bold text-lg sm:text-xl text-white drop-shadow-md truncate max-w-[320px]">
                {room.title}
              </h2>
              <p className="text-xs text-primary font-semibold truncate max-w-[280px] mt-0.5">
                By {hostName} • @{hostUsername}
              </p>

              {/* Action Strip for Album & Fan Support */}
              <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className={cn(
                    "h-8 text-xs px-3 gap-1.5 backdrop-blur-md border-white/20 text-white",
                    isAlbumSaved
                      ? "bg-primary text-primary-foreground"
                      : "bg-black/40 hover:bg-white/20"
                  )}
                  onClick={handleSaveAlbum}
                >
                  {isAlbumSaved ? (
                    <BookmarkCheck className="size-3.5" />
                  ) : (
                    <Bookmark className="size-3.5" />
                  )}
                  {isAlbumSaved ? "Album Saved" : "Save Album"}
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-xs px-3 gap-1.5 bg-primary text-primary-foreground shadow-sm font-bold"
                  onClick={handlePurchaseAlbum}
                >
                  <ShoppingBag className="size-3.5" />
                  Buy Full Album ($9.99)
                </Button>
              </div>
            </div>

            {/* Right Side: Player Header directly on Top + Full Synced Tracklist below (7 cols) */}
            <div className="md:col-span-7 flex flex-col h-full overflow-hidden rounded-2xl border border-white/15 bg-black/70 backdrop-blur-xl shadow-2xl">
              {/* Player Header above the Tracklist */}
              <div className="p-3.5 sm:p-4 border-b border-white/10 bg-white/[0.03] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-primary/20 text-primary border-primary/40 text-[10px] font-bold">
                      <Music2 className="size-3 mr-1" />
                      SYNCHRONIZED AUDIO
                    </Badge>
                    <span className="text-[10px] text-white/50 font-mono inline">
                      Lossless 48kHz • This room is synced
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-white/60">
                    Host: @{hostUsername}
                  </span>
                </div>

                {/* Player Controls Bar */}
                <div className="flex items-center justify-between gap-3 bg-black/60 border border-white/10 p-2.5 rounded-xl">
                  <div className="flex items-center gap-3 min-w-0">
                    {isHost ? (
                      <Button
                        className="size-9 rounded-full bg-primary text-primary-foreground hover:scale-105 transition shrink-0 shadow-md"
                        onClick={handleTogglePlayback}
                        size="icon"
                        variant="default"
                      >
                        {isPlaying ? (
                          <Pause className="size-4 fill-current" />
                        ) : (
                          <Play className="size-4 fill-current translate-x-0.5" />
                        )}
                      </Button>
                    ) : (
                      <Badge className="h-9 px-3" variant="secondary">
                        <Radio className="mr-1.5 size-3.5" /> Synced
                      </Badge>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-xs sm:text-sm text-white truncate max-w-[200px] sm:max-w-[260px]">
                        {currentTrack?.title ?? room.title}
                      </p>
                      <p className="text-[10px] text-white/60 truncate">
                        {currentTrack?.artistName ?? hostName}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Host Action: Replay Track / Fan Action: Save Track (+) */}
                    {isHost ? (
                      <Button
                        className="size-7 rounded-full text-white/70 hover:text-white hover:bg-white/20"
                        onClick={() => handleReplayTrack()}
                        size="icon"
                        aria-label="Repeat current track"
                        title="Repeat Current Track"
                        variant="ghost"
                      >
                        <RotateCcw className="size-3.5" />
                      </Button>
                    ) : (
                      <Button
                        className={cn(
                          "size-7 rounded-full text-white/70 hover:text-white hover:bg-white/20",
                          currentTrack &&
                            savedTrackIds.has(currentTrack.id) &&
                            "text-primary"
                        )}
                        onClick={() => {
                          if (currentTrack) {
                            void handleToggleSaveTrack(
                              currentTrack.id,
                              currentTrack.title
                            );
                          }
                        }}
                        size="icon"
                        title={
                          currentTrack && savedTrackIds.has(currentTrack.id)
                            ? "Saved to Library"
                            : "Save Current Track (+)"
                        }
                        variant="ghost"
                      >
                        {currentTrack && savedTrackIds.has(currentTrack.id) ? (
                          <BookmarkCheck className="size-3.5 text-primary" />
                        ) : (
                          <Plus className="size-3.5" />
                        )}
                      </Button>
                    )}
                    <Button
                      className={cn(
                        "size-7 rounded-full text-white/70 hover:text-white hover:bg-white/20",
                        currentTrack &&
                          likedTrackIds.has(currentTrack.id) &&
                          "text-destructive"
                      )}
                      onClick={() => {
                        if (currentTrack) {
                          handleToggleLike(currentTrack.id, currentTrack.title);
                        }
                      }}
                      size="icon"
                      title="Like Track"
                      variant="ghost"
                    >
                      <Heart
                        className={cn(
                          "size-3.5",
                          currentTrack &&
                            likedTrackIds.has(currentTrack.id) &&
                            "fill-destructive"
                        )}
                      />
                    </Button>
                  </div>
                </div>

                {/* Progress Timeline */}
                <div className="space-y-1">
                  <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, Math.max(15, (currentTrackIndex + 1) * 20))}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-white/40 font-mono">
                    <span>1:45</span>
                    <span>3:30</span>
                  </div>
                </div>
              </div>

              {/* Full Tracklist & Synced Lyrics Tabs below Player */}
              <Tabs
                defaultValue="tracklist"
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as "tracklist" | "lyrics")}
                className="flex flex-col flex-1"
              >
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 shrink-0 bg-white/[0.01]">
                  <TabsList className="bg-black/50 border border-white/10 h-7 p-0.5">
                    <TabsTrigger
                      value="tracklist"
                      className="text-xs h-6 px-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      <ListMusic className="size-3 mr-1.5" />
                      All Songs ({room.tracklist.length})
                    </TabsTrigger>
                    <TabsTrigger
                      value="lyrics"
                      className="text-xs h-6 px-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      <Sparkles className="size-3 mr-1.5" />
                      Synced Lyrics
                    </TabsTrigger>
                  </TabsList>
                  <span className="text-[10px] text-white/50">
                    Track {currentTrackIndex + 1} of {room.tracklist.length}
                  </span>
                </div>

                <TabsContent
                  value="tracklist"
                  className="flex-1 overflow-y-auto p-3 space-y-1.5 m-0 max-h-[300px] sm:max-h-[340px] focus-visible:outline-none custom-scrollbar"
                >
                  {room.tracklist.map((track, idx) => {
                    const isCurrent = track.id === currentTrack?.id;
                    const isTrackLiked = likedTrackIds.has(track.id);
                    const isTrackSaved = savedTrackIds.has(track.id);

                    return (
                      <div
                        className={cn(
                          "group flex items-center justify-between rounded-xl p-2.5 text-xs transition-all border",
                          isCurrent
                            ? "bg-primary/20 border-primary/40 text-white font-semibold shadow-md"
                            : "border-transparent bg-white/[0.02] hover:bg-white/10 text-white/80"
                        )}
                        key={track.id}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span className="w-5 font-mono text-[11px] text-white/40 text-center">
                            {idx + 1}
                          </span>
                          <div className="truncate min-w-0 flex-1">
                            <p className="truncate font-medium text-white">
                              {track.title}
                            </p>
                            <p className="text-[10px] text-white/50 truncate">
                              {track.artistName}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isCurrent && (
                            <Badge className="bg-primary text-primary-foreground text-[9px] px-1.5 py-0 mr-1 animate-pulse">
                              NOW PLAYING
                            </Badge>
                          )}

                          {/* Fan Action: Like */}
                          <Button
                            size="icon"
                            variant="ghost"
                            className={cn(
                              "size-7 rounded-full text-white/70 hover:text-white hover:bg-white/20",
                              isTrackLiked && "text-destructive"
                            )}
                            onClick={() =>
                              handleToggleLike(track.id, track.title)
                            }
                            title="Like Track"
                          >
                            <Heart
                              className={cn(
                                "size-3.5",
                                isTrackLiked && "fill-destructive"
                              )}
                            />
                          </Button>

                          {/* Fan Action: Save to Library */}
                          <Button
                            size="icon"
                            variant="ghost"
                            className={cn(
                              "size-7 rounded-full text-white/70 hover:text-white hover:bg-white/20",
                              isTrackSaved && "text-primary"
                            )}
                            onClick={() =>
                              void handleToggleSaveTrack(track.id, track.title)
                            }
                            title={
                              isTrackSaved
                                ? "Saved to Library"
                                : "Save Track (+)"
                            }
                          >
                            {isTrackSaved ? (
                              <BookmarkCheck className="size-3.5 text-primary" />
                            ) : (
                              <Plus className="size-3.5" />
                            )}
                          </Button>

                          {/* Fan Action: Buy Track ($1.29) */}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[10px] px-2 border-white/20 bg-black/40 text-white hover:bg-white/20"
                            onClick={() => handlePurchaseTrack(track.title)}
                            title="Buy Track HD Audio"
                          >
                            $1.29
                          </Button>

                          {/* Host Action: Replay / Cue Track for Party */}
                          {isHost && (
                            <Button
                              className="size-7 rounded-full text-white/70 hover:text-white hover:bg-white/20"
                              onClick={() => {
                                setActiveTrackId(track.id);
                                partyPlayback.mutate({
                                  trackId: track.id,
                                  type: "track_changed",
                                });
                                toast({
                                  description: `Changed the room to "${track.title}" for everyone.`,
                                  title: "Track Changed",
                                });
                              }}
                              size="icon"
                              title="Play this track for the party"
                              variant="ghost"
                            >
                              <RotateCcw className="size-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </TabsContent>

                <TabsContent
                  value="lyrics"
                  className="flex-1 overflow-y-auto p-4 space-y-2 m-0 max-h-[300px] sm:max-h-[340px] focus-visible:outline-none custom-scrollbar text-center"
                >
                  <p className="text-[11px] uppercase tracking-widest text-primary font-bold mb-3">
                    Live Karaoke Lyrics Stream
                  </p>
                  {lyrics.map((lyric) => (
                    <p
                      key={lyric.id}
                      className={cn(
                        "text-xs sm:text-sm transition-all duration-300 font-medium",
                        getLyricClass(lyric.id, lyric.text)
                      )}
                    >
                      {lyric.text}
                    </p>
                  ))}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    );

  return (
    <LiveRoomAccessGuard
      allowPublic={artistView && isHost}
      roomTitle={room.title}
    >
      <LiveTwitchShell
        chatPanel={chatPanel}
        defaultChatOpen={true}
        isChatOpen={isChatOpen}
        onChatOpenChange={setIsChatOpen}
        videoNode={videoNode}
      >
        {(artistView || room.party?.playback.mediaAvailable) && (
          <PartyMediaStage
            artistAvatarUrl="/soundkit-default-avatar.svg"
            artistName={hostName}
            artistUserId={room.party?.playback.hostUserId ?? ""}
            enabled={
              artistView ||
              (Boolean(room.party?.playback.mediaAvailable) &&
                room.status === "live")
            }
            experienceId={id}
            viewerOnly={!artistView}
          />
        )}
        <LiveCreatorPanel
          creator={{
            displayName: hostName,
            followersCount: 3200,
            username: hostUsername,
          }}
          isLive={room.status === "live"}
          statusLabel={
            artistView ? "Artist Control Room" : "Listening Premiere"
          }
          tipButton={
            room.status === "live" && room.party?.playback.hostUserId ? (
              <LiveTipButton
                isLive={room.status === "live"}
                kind="party"
                liveExperienceId={id}
                recipients={[{ id: room.party.playback.hostUserId, name: hostName }]}
              />
            ) : null
          }
          title={room.title}
          viewerCount={room.viewerCount}
        />
      </LiveTwitchShell>
    </LiveRoomAccessGuard>
  );
}
