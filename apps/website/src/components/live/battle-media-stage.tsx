"use client";
/* eslint-disable no-void, one-var, promise/prefer-await-to-callbacks, promise/prefer-await-to-then, react/exhaustive-effect-dependencies, react/todo, sort-vars, unicorn/no-nested-ternary, unicorn/require-array-join-separator */

import type RealtimeKitClientType from "@cloudflare/realtimekit";
import type { RTKParticipant, RTKSelf } from "@cloudflare/realtimekit";
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  Radio,
  RotateCcw,
  Shield,
  UserMinus,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { API_V1_URL } from "@/lib/api";
import type { LiveRoomArtist } from "@/lib/live-room";
import { wsUrlForRoom } from "@/lib/live-room";

interface BattleParticipantToken {
  authToken: string;
  meetingId: string;
  participantId: string;
  presetName: string;
}

interface BattleJoinResponse {
  participant: BattleParticipantToken;
}

type BattlePeer = RTKParticipant | RTKSelf;

interface BattleMediaTileProps {
  artist: LiveRoomArtist;
  isActive: boolean;
  isSelf: boolean;
  onPromote: () => void;
  onToggleMute: () => void;
  peer: BattlePeer | null;
  canModerate: boolean;
}

const NON_MEDIA_BATTLE_PHASES = new Set([
    "between_rounds",
    "pre_vote",
    "round_result",
    "scheduled",
    "turn_transition",
    "waiting_room",
  ]),
  isOnStage = (peer: BattlePeer | null) =>
    peer?.stageStatus === "ON_STAGE" ||
    peer?.stageStatus === "ACCEPTED_TO_JOIN_STAGE";

function BattleMediaTile({
  artist,
  canModerate,
  isActive,
  isSelf,
  onPromote,
  onToggleMute,
  peer,
}: BattleMediaTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null),
    audioRef = useRef<HTMLAudioElement>(null),
    [, setMediaVersion] = useState(0);

  useEffect(() => {
    if (!(peer && videoRef.current)) {
      return;
    }

    const videoElement = videoRef.current;
    peer.registerVideoElement(videoElement);
    return () => peer.deregisterVideoElement(videoElement);
  }, [peer]);

  useEffect(() => {
    const audioTrack = peer?.audioTrack;
    if (!(audioRef.current && audioTrack)) {
      return;
    }

    const audioElement = audioRef.current;
    audioElement.srcObject = new MediaStream([audioTrack]);
    const playAudio = async () => {
      try {
        await audioElement.play();
      } catch {
        // Browser autoplay policies can require a user gesture.
      }
    };
    void playAudio();

    return () => {
      audioElement.srcObject = null;
    };
  }, [peer]);

  useEffect(() => {
    if (!peer) {
      return;
    }

    const refresh = () => setMediaVersion((version) => version + 1);
    if ("isHost" in peer) {
      peer.on("videoUpdate", refresh);
      peer.on("audioUpdate", refresh);
      peer.on("stageStatusUpdate", refresh);
      return () => {
        peer.off("videoUpdate", refresh);
        peer.off("audioUpdate", refresh);
        peer.off("stageStatusUpdate", refresh);
      };
    }

    peer.on("videoUpdate", refresh);
    peer.on("audioUpdate", refresh);
    return () => {
      peer.off("videoUpdate", refresh);
      peer.off("audioUpdate", refresh);
    };
  }, [peer]);

  const initials = artist.name.slice(0, 2).toUpperCase(),
    hasVideo = Boolean(peer?.videoEnabled),
    muted = !peer?.audioEnabled;

  return (
    <div
      className={`relative min-h-52 overflow-hidden rounded-xl border bg-neutral-950 sm:min-h-72 ${
        isActive ? "border-primary ring-2 ring-primary/40" : "border-white/10"
      }`}
    >
      {hasVideo && peer ? (
        <video
          aria-label={`${artist.name} live camera`}
          autoPlay
          className="absolute inset-0 size-full object-cover"
          muted={isSelf}
          playsInline
          ref={videoRef}
        >
          <track
            kind="captions"
            label={`${artist.name} captions`}
            src="data:text/vtt,WEBVTT"
          />
        </video>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-primary/20 via-neutral-950 to-secondary/20">
          <Avatar className="size-20 border-2 border-white/20 sm:size-24">
            <AvatarImage src={artist.avatarUrl} />
            <AvatarFallback className="text-xl font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <p className="text-sm text-white/70">
            {peer ? "Camera is off" : "Waiting for camera"}
          </p>
        </div>
      )}
      <audio aria-label={`${artist.name} microphone`} autoPlay ref={audioRef}>
        <track
          kind="captions"
          label={`${artist.name} captions`}
          src="data:text/vtt,WEBVTT"
        />
      </audio>
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/80 to-transparent p-3">
        <div className="min-w-0">
          <p className="truncate font-bold text-sm text-white">{artist.name}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge
              className="text-[10px]"
              variant={isActive ? "default" : "secondary"}
            >
              {isActive ? "Their turn" : "On deck"}
            </Badge>
            {isOnStage(peer) && (
              <Badge className="gap-1 text-[10px]" variant="outline">
                <Radio className="size-2.5 text-emerald-400" /> On stage
              </Badge>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-md bg-black/50 px-2 py-1 text-white">
          {muted ? (
            <MicOff className="size-3.5" />
          ) : (
            <Mic className="size-3.5" />
          )}
          {hasVideo ? (
            <Camera className="size-3.5" />
          ) : (
            <CameraOff className="size-3.5" />
          )}
        </div>
      </div>
      {canModerate && peer && !isSelf && (
        <div className="absolute inset-x-0 bottom-0 flex flex-wrap gap-2 bg-gradient-to-t from-black/90 to-transparent p-3 pt-8">
          <Button
            className="h-8 gap-1.5 text-xs"
            onClick={onToggleMute}
            size="sm"
            type="button"
            variant="secondary"
          >
            {muted ? (
              <Mic className="size-3.5" />
            ) : (
              <MicOff className="size-3.5" />
            )}
            {muted ? "Allow mic" : "Mute"}
          </Button>
          <Button
            className="h-8 gap-1.5 text-xs"
            onClick={onPromote}
            size="sm"
            type="button"
            variant="outline"
          >
            {isOnStage(peer) ? (
              <UserMinus className="size-3.5" />
            ) : (
              <Radio className="size-3.5" />
            )}
            {isOnStage(peer) ? "Demote" : "Promote"}
          </Button>
        </div>
      )}
    </div>
  );
}

export function BattleMediaStage({
  activeArtistUserId,
  artists,
  canModerate = false,
  className,
  experienceId,
  phase,
  showHeader = true,
  viewerOnly = false,
}: {
  activeArtistUserId?: string | null;
  artists: [LiveRoomArtist, LiveRoomArtist];
  canModerate?: boolean;
  className?: string;
  experienceId: string;
  phase?: string;
  showHeader?: boolean;
  viewerOnly?: boolean;
}) {
  const [meeting, setMeeting] = useState<RealtimeKitClientType | null>(null),
    [participants, setParticipants] = useState<RTKParticipant[]>([]),
    [self, setSelf] = useState<RTKSelf | null>(null),
    [connection, setConnection] = useState<
      "connecting" | "connected" | "error"
    >("connecting"),
    [error, setError] = useState<string | null>(null),
    [retry, setRetry] = useState(0),
    mediaControlSocketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let activeMeeting: RealtimeKitClientType | null = null,
      disposed = false;

    const connect = async () => {
      const stageOpen = Boolean(phase && !NON_MEDIA_BATTLE_PHASES.has(phase));
      setConnection("connecting");
      setError(null);

      try {
        const response = await fetch(
          `${API_V1_URL}/live/experiences/${experienceId}/join`,
          {
            body: JSON.stringify({
              phase: phase === "waiting_room" ? "lobby" : "round_active",
              role: "viewer",
            }),
            credentials: "include",
            headers: { "content-type": "application/json" },
            method: "POST",
          }
        );
        if (!response.ok) {
          throw new Error(`Unable to join battle media: ${response.status}`);
        }

        const payload = (await response.json()) as BattleJoinResponse,
          { default: RealtimeKitClient } =
            await import("@cloudflare/realtimekit"),
          client = await RealtimeKitClient.init({
            authToken: payload.participant.authToken,
            defaults: {
              audio: !viewerOnly && stageOpen,
              video: !viewerOnly && stageOpen,
            },
          });

        await client.join();
        if (
          !viewerOnly &&
          stageOpen &&
          String(client.self.permissions.canProduceAudio) === "ALLOWED"
        ) {
          await client.stage.join();
        }
        if (disposed) {
          await client.leave();
          return;
        }

        activeMeeting = client;
        setMeeting(client);
        setSelf(client.self);
        setParticipants(client.participants.joined.toArray());
        setConnection("connected");

        const refreshParticipants = () => {
          setParticipants(client.participants.joined.toArray());
          setSelf(client.self);
        };
        client.participants.joined.on("participantJoined", refreshParticipants);
        client.participants.joined.on("participantLeft", refreshParticipants);
        client.participants.joined.on(
          "participantsUpdate",
          refreshParticipants
        );
        client.self.on("videoUpdate", refreshParticipants);
        client.self.on("audioUpdate", refreshParticipants);
        client.stage.on("stageStatusUpdate", () => refreshParticipants());
        client.self.on("roomJoined", () => refreshParticipants());
        client.self.on("roomLeft", () => refreshParticipants());
      } catch (connectError) {
        if (!disposed) {
          setConnection("error");
          setError(
            connectError instanceof Error
              ? connectError.message
              : "Battle media could not connect."
          );
        }
      }
    };

    void connect();
    return () => {
      disposed = true;
      if (activeMeeting) {
        void activeMeeting.leave();
      }
      setMeeting(null);
      setSelf(null);
      setParticipants([]);
    };
  }, [experienceId, phase, retry, viewerOnly]);

  useEffect(() => {
    if (!meeting) {
      return;
    }

    const socket = new WebSocket(wsUrlForRoom(experienceId));
    mediaControlSocketRef.current = socket;
    socket.addEventListener("message", (event) => {
      const payload = JSON.parse(String(event.data)) as {
        action?: string;
        targetUserId?: string;
        type?: string;
      };
      const selfUserIds = [
        meeting.self.customParticipantId,
        meeting.self.userId,
      ];
      if (
        payload.type === "battle.media_control" &&
        payload.action === "allow_audio" &&
        selfUserIds.includes(payload.targetUserId ?? "")
      ) {
        void meeting.self.enableAudio();
      }
    });

    return () => {
      socket.close();
      if (mediaControlSocketRef.current === socket) {
        mediaControlSocketRef.current = null;
      }
    };
  }, [experienceId, meeting]);

  const participantByUserId = useMemo(
      () =>
        new Map(
          participants.map((participant) => [
            participant.customParticipantId ?? participant.userId,
            participant,
          ])
        ),
      [participants]
    ),
    callParticipantAction = async (
      action: () => Promise<void>
    ): Promise<void> => {
      try {
        await action();
      } catch (actionError) {
        setError(
          actionError instanceof Error
            ? actionError.message
            : "The stage action could not be completed."
        );
      }
    },
    toggleRemoteMute = (participant: RTKParticipant) =>
      callParticipantAction(async () => {
        if (participant.audioEnabled) {
          await participant.disableAudio();
          return;
        }

        const socket = mediaControlSocketRef.current;
        if (socket?.readyState === WebSocket.OPEN) {
          socket.send(
            JSON.stringify({
              payload: {
                action: "allow_audio",
                targetUserId:
                  participant.customParticipantId ?? participant.userId,
              },
              type: "battle.media_control",
            })
          );
        }
      }),
    toggleStage = (participant: RTKParticipant) =>
      callParticipantAction(async () => {
        if (!meeting) {
          return;
        }
        if (isOnStage(participant)) {
          await meeting.stage.kick([participant.userId]);
          return;
        }
        await meeting.stage.grantAccess([participant.userId]);
      });

  return (
    <Card
      className={`overflow-hidden border-primary/30 bg-black/80 ${className ?? ""}`}
    >
      {showHeader && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2.5 sm:px-4">
          <div className="flex items-center gap-2">
            <Radio className="size-4 text-primary" />
            <div>
              <p className="font-bold text-sm text-white">Live battle stage</p>
              <p className="text-[11px] text-white/60">
                Browser camera and microphone • RealtimeKit
              </p>
            </div>
          </div>
          <Badge
            className="gap-1.5 text-[10px]"
            variant={connection === "connected" ? "default" : "outline"}
          >
            <span
              className={`size-1.5 rounded-full ${connection === "connected" ? "bg-emerald-400" : "bg-amber-400"}`}
            />
            {connection === "connected"
              ? "Connected"
              : connection === "error"
                ? "Offline"
                : "Connecting"}
          </Badge>
        </div>
      )}

      {!showHeader && connection === "connected" && (
        <div className="absolute right-3 top-3 z-30 rounded-md bg-black/60 px-2 py-1 text-[10px] text-white backdrop-blur">
          <span className="mr-1.5 inline-block size-1.5 rounded-full bg-emerald-400" />
          RealtimeKit live
        </div>
      )}

      {connection === "error" ? (
        <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
          <Shield className="size-7 text-amber-400" />
          <p className="max-w-md text-sm text-white/70">{error}</p>
          <Button
            className="gap-2"
            onClick={() => setRetry((value) => value + 1)}
            size="sm"
            type="button"
            variant="outline"
          >
            <RotateCcw className="size-3.5" /> Try again
          </Button>
        </div>
      ) : (
        <div className="grid gap-2 p-2 sm:grid-cols-2 sm:gap-3 sm:p-3">
          {artists.map((artist) => {
            const participant = participantByUserId.get(artist.id) ?? null,
              peer =
                self &&
                (self.customParticipantId === artist.id ||
                  self.userId === artist.id)
                  ? self
                  : participant,
              isSelf = peer === self;

            return (
              <BattleMediaTile
                artist={artist}
                canModerate={canModerate}
                isActive={activeArtistUserId === artist.id}
                isSelf={isSelf}
                key={artist.id}
                onPromote={() => {
                  if (participant && !isSelf) {
                    toggleStage(participant);
                  }
                }}
                onToggleMute={() => {
                  if (participant && !isSelf) {
                    toggleRemoteMute(participant);
                  }
                }}
                peer={peer}
              />
            );
          })}
        </div>
      )}

      {self && !viewerOnly && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-3 py-2.5 sm:px-4">
          <span className="text-[11px] text-white/60">Your controls</span>
          <div className="flex gap-2">
            <Button
              className="h-8 gap-1.5 text-xs"
              onClick={() =>
                void (self.audioEnabled
                  ? self.disableAudio()
                  : self.enableAudio())
              }
              size="sm"
              type="button"
              variant="outline"
            >
              {self.audioEnabled ? (
                <MicOff className="size-3.5" />
              ) : (
                <Mic className="size-3.5" />
              )}
              {self.audioEnabled ? "Mute mic" : "Enable mic"}
            </Button>
            <Button
              className="h-8 gap-1.5 text-xs"
              onClick={() =>
                void (self.videoEnabled
                  ? self.disableVideo()
                  : self.enableVideo())
              }
              size="sm"
              type="button"
              variant="outline"
            >
              {self.videoEnabled ? (
                <CameraOff className="size-3.5" />
              ) : (
                <Camera className="size-3.5" />
              )}
              {self.videoEnabled ? "Stop camera" : "Start camera"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
