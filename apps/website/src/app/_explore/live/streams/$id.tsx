"use client";
/* eslint-disable complexity, no-unused-vars, sort-vars, one-var, require-unicode-regexp */

import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarClock, Maximize, Minimize, Play, Radio } from "lucide-react";
import { useState } from "react";

import { LiveRoomAccessGuard } from "@/components/explore/live-room-access-guard";
import { LiveCreatorPanel } from "@/components/live/live-creator-panel";
import {
  LiveChatPanel,
  LiveLyricsPanel,
} from "@/components/live/live-room-panels";
import { LiveTwitchShell } from "@/components/live/live-twitch-shell";
import { useBrowserFullscreen } from "@/components/live/use-browser-fullscreen";
import { AppImage } from "@/components/ui/app-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { API_V1_URL } from "@/lib/api";
import { useLiveRoom } from "@/lib/live-room";
import { useArtistQuery } from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/_explore/live/streams/$id")({
  component: StreamDetailPage,
});

function StreamDetailPage() {
  const { id } = Route.useParams(),
    { chat, chatMessages, query } = useLiveRoom(id),
    [isChatOpen, setIsChatOpen] = useState(true),
    {
      containerRef: videoContainerRef,
      isFullscreen,
      toggleFullscreen,
    } = useBrowserFullscreen(),
    room = query.data,
    experienceQuery = useQuery({
      queryFn: async () => {
        const response = await fetch(
          `${API_V1_URL}/live/experiences/${encodeURIComponent(id)}`,
          { credentials: "include" }
        );
        if (!response.ok) {
          throw new Error(`Unable to load live media: ${response.status}`);
        }
        return (await response.json()) as {
          creatorAvatar: string | null;
          creatorBio?: string | null;
          creatorName: string | null;
          creatorUsername?: string | null;
          genre: string | null;
          id: string;
          kind: string;
          playbackUrl: string | null;
          playerUrl: string | null;
          source: string;
          startsAt: string;
          status: string;
          title: string;
          viewerCount: number;
          visibility: string;
          ingestErrorCode?: string | null;
          ingestErrorMessage?: string | null;
          ingestStatus?: string;
          reconnectUntil?: string | null;
          replayPublishedAt?: string | null;
          recordingStatus?: string | null;
        };
      },
      queryKey: ["live-experience", id],
      refetchInterval: 5000,
    }),
    experience = experienceQuery.data,
    isLive =
      experience?.status === "live" &&
      (experience.ingestStatus === undefined ||
        experience.ingestStatus === "connected"),
    isReconnecting = experience?.ingestStatus === "reconnecting",
    currentTrack = room?.tracklist.find(
      (track) => track.id === room.currentTrackId
    ),
    rawCreatorUsername =
      experience?.creatorUsername ??
      (experience?.creatorName ?? room?.hostName ?? "")
        .toLowerCase()
        .replaceAll(/\s+/g, ""),
    artistQuery = useArtistQuery(rawCreatorUsername),
    artistData = artistQuery.data;

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
            {query.error?.message ?? "Stream room offline"}
          </p>
        </div>
      </div>
    );
  }

  const creatorName =
      artistData?.name ??
      experience?.creatorName ??
      room.hostName ??
      "SoundKit Creator",
    creatorUsername =
      artistData?.username ??
      rawCreatorUsername ??
      creatorName.toLowerCase().replaceAll(/\s+/g, ""),
    creatorAvatar =
      artistData?.avatarUrl ??
      experience?.creatorAvatar ??
      "/soundkit-default-avatar.svg",
    chatPanel = (
      <LiveChatPanel
        disabled={chat.isPending}
        fillHeight
        messages={chatMessages}
        onCollapse={() => setIsChatOpen(false)}
        onSend={(message) => chat.mutate({ message, userName: "You" })}
        title="Stream Chat"
      />
    ),
    videoNode = (
      <div
        className="group relative aspect-video w-full bg-black"
        ref={videoContainerRef}
      >
        {experience?.playerUrl && isLive ? (
          <iframe
            allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            className="size-full"
            sandbox="allow-scripts allow-forms allow-popups allow-presentation"
            src={experience.playerUrl}
            title={`${room.title} live stream`}
          />
        ) : (
          <>
            <AppImage
              alt={room.title}
              className="size-full object-cover opacity-80"
              height={720}
              src={currentTrack?.coverArtUrl ?? "/soundkit-default-banner.svg"}
              width={1280}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-xl border border-white/10 bg-black/75 px-8 py-6 text-center text-white backdrop-blur-md">
                {isReconnecting ? (
                  <>
                    <Radio className="mx-auto mb-3 size-10 animate-pulse text-amber-400" />
                    <p className="font-bold text-lg">
                      Temporarily Reconnecting
                    </p>
                    <p className="mt-1 text-sm text-white/70">
                      The broadcaster lost connection. We are holding the room
                      open.
                    </p>
                  </>
                ) : (experience?.ingestStatus === "waiting_for_ingest" ||
                  experience?.status === "scheduled" ? (
                  <>
                    <CalendarClock className="mx-auto mb-3 size-10 text-primary" />
                    <p className="font-bold text-lg">Broadcast Scheduled</p>
                    <p className="mt-1 text-sm text-white/70">
                      Starts at {new Date(experience.startsAt).toLocaleString()}
                    </p>
                    <p className="mt-3 text-xs text-white/50">
                      Stream starting soon...
                    </p>
                  </>
                ) : (
                  <>
                    <Play className="mx-auto mb-3 size-10 fill-white text-white" />
                    <p className="font-bold text-lg">{room.title}</p>
                    <p className="mt-1 text-sm text-white/70">
                      {experience?.replayPublishedAt
                        ? "Replay Available"
                        : experience?.recordingStatus
                          ? "Replay Processing"
                          : "Waiting for Broadcaster"}
                    </p>
                  </>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="absolute left-4 top-4 flex flex-wrap items-center gap-2">
          <Badge
            className="font-bold tracking-wider"
            variant={
              isLive ? "destructive" : (isReconnecting ? "outline" : "secondary")
            }
          >
            {isLive
              ? "LIVE"
              : isReconnecting
                ? "RECONNECTING"
                : experience?.ingestStatus === "waiting_for_ingest"
                  ? "WAITING FOR OBS"
                  : "OFFLINE"}
          </Badge>
          {experience?.genre ? (
            <Badge className="bg-black/60 backdrop-blur-md" variant="outline">
              {experience.genre}
            </Badge>
          ) : null}
        </div>

        <div className="absolute right-4 bottom-4 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            className="size-9 bg-black/70 text-white hover:bg-black/90 backdrop-blur-md"
            onClick={toggleFullscreen}
            size="icon"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            type="button"
            variant="ghost"
          >
            {isFullscreen ? (
              <Minimize className="size-5" />
            ) : (
              <Maximize className="size-5" />
            )}
          </Button>
        </div>
      </div>
    );

  return (
    <LiveRoomAccessGuard roomTitle={room.title}>
      <LiveTwitchShell
        chatPanel={chatPanel}
        defaultChatOpen={true}
        isChatOpen={isChatOpen}
        onChatOpenChange={setIsChatOpen}
        videoNode={videoNode}
      >
        <LiveCreatorPanel
          creator={{
            avatarUrl: creatorAvatar,
            bio: artistData?.bio ?? experience?.creatorBio,
            displayName: creatorName,
            followersCount: artistData?.followers ?? 1420,
            username: creatorUsername,
          }}
          genre={experience?.genre}
          isLive={isLive}
          title={room.title}
          viewerCount={experience?.viewerCount ?? room.viewerCount}
        />

        {currentTrack &&
        currentTrack.lyrics &&
        currentTrack.lyrics.length > 0 ? (
          <div className="mt-6">
            <LiveLyricsPanel track={currentTrack} />
          </div>
        ) : null}
      </LiveTwitchShell>
    </LiveRoomAccessGuard>
  );
}
