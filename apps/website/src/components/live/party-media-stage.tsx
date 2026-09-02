"use client";
/* eslint-disable complexity, no-void, no-nested-ternary, one-var, promise/prefer-await-to-callbacks, promise/prefer-await-to-then, react/exhaustive-effect-dependencies, react/set-state-in-effect, react/todo, sort-vars, unicorn/no-nested-ternary */

import type RealtimeKitClientType from "@cloudflare/realtimekit";
import type { RTKParticipant, RTKSelf } from "@cloudflare/realtimekit";
import { Camera, CameraOff, Mic, MicOff, Radio, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { API_V1_URL } from "@/lib/api";

interface PartyParticipantToken {
  authToken: string;
  meetingId: string;
  participantId: string;
  presetName: string;
}

interface PartyJoinResponse {
  participant: PartyParticipantToken;
}

type PartyPeer = RTKParticipant | RTKSelf;

export function PartyMediaStage({
  artistAvatarUrl,
  artistName,
  artistUserId,
  enabled = true,
  experienceId,
  viewerOnly = false,
}: {
  artistAvatarUrl?: string | null;
  artistName: string;
  artistUserId: string;
  enabled?: boolean;
  experienceId: string;
  viewerOnly?: boolean;
}) {
  const [participants, setParticipants] = useState<RTKParticipant[]>([]),
    [self, setSelf] = useState<RTKSelf | null>(null),
    [connection, setConnection] = useState<
      "connecting" | "connected" | "disabled" | "error"
    >(enabled ? "connecting" : "disabled"),
    [error, setError] = useState<string | null>(null),
    [retry, setRetry] = useState(0),
    initials = artistName.slice(0, 2).toUpperCase(),
    participant = useMemo(
      () =>
        participants.find(
          (entry) =>
            entry.customParticipantId === artistUserId ||
            entry.userId === artistUserId
        ) ??
        participants[0] ??
        null,
      [artistUserId, participants]
    ),
    peer: PartyPeer | null = viewerOnly ? participant : (self ?? participant),
    videoRef = useRef<HTMLVideoElement>(null),
    audioRef = useRef<HTMLAudioElement>(null),
    [, setMediaVersion] = useState(0);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let activeMeeting: RealtimeKitClientType | null = null,
      disposed = false;

    const connect = async () => {
      setConnection("connecting");
      setError(null);

      try {
        const response = await fetch(
          `${API_V1_URL}/live/experiences/${encodeURIComponent(experienceId)}/join`,
          {
            body: JSON.stringify({
              phase: "round_active",
              role: viewerOnly ? "listener" : "host",
            }),
            credentials: "include",
            headers: { "content-type": "application/json" },
            method: "POST",
          }
        );
        if (!response.ok) {
          throw new Error(`Unable to join party media: ${response.status}`);
        }

        const payload = (await response.json()) as PartyJoinResponse,
          { default: RealtimeKitClient } =
            await import("@cloudflare/realtimekit"),
          client = await RealtimeKitClient.init({
            authToken: payload.participant.authToken,
            defaults: {
              audio: false,
              video: false,
            },
          });

        await client.join(...([] as []));
        if (disposed) {
          await client.leave();
          return;
        }

        activeMeeting = client;
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
        client.self.on("roomJoined", refreshParticipants);
        client.self.on("roomLeft", refreshParticipants);
      } catch (connectError) {
        if (!disposed) {
          setConnection("error");
          setError(
            connectError instanceof Error
              ? connectError.message
              : "Party media could not connect."
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
      setSelf(null);
      setParticipants([]);
    };
  }, [enabled, experienceId, retry, viewerOnly]);

  useEffect(() => {
    if (!(peer && videoRef.current && peer.videoEnabled)) {
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
    audioElement.muted = peer === self;
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
  }, [peer, self]);

  useEffect(() => {
    if (!peer) {
      return;
    }

    const refresh = () => setMediaVersion((version) => version + 1);
    if ("isHost" in peer) {
      peer.on("videoUpdate", refresh);
      peer.on("audioUpdate", refresh);
      return () => {
        peer.off("videoUpdate", refresh);
        peer.off("audioUpdate", refresh);
      };
    }

    peer.on("videoUpdate", refresh);
    peer.on("audioUpdate", refresh);
    return () => {
      peer.off("videoUpdate", refresh);
      peer.off("audioUpdate", refresh);
    };
  }, [peer]);

  const hasVideo = Boolean(peer?.videoEnabled),
    hasAudio = Boolean(peer?.audioEnabled),
    displayedConnection = enabled ? connection : "disabled";

  return (
    <Card className="overflow-hidden border-primary/30 bg-black/80">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-2">
          <Radio className="size-4 text-primary" />
          <div>
            <p className="font-bold text-sm text-white">Artist room</p>
            <p className="text-[11px] text-white/60">
              Camera, microphone, and host presence
            </p>
          </div>
        </div>
        <Badge
          className="gap-1.5 text-[10px]"
          variant={displayedConnection === "connected" ? "default" : "outline"}
        >
          <span
            className={`size-1.5 rounded-full ${displayedConnection === "connected" ? "bg-emerald-400" : "bg-amber-400"}`}
          />
          {displayedConnection === "connected"
            ? "Connected"
            : displayedConnection === "error"
              ? "Offline"
              : displayedConnection === "disabled"
                ? "Waiting for live"
                : "Connecting"}
        </Badge>
      </div>

      {connection === "error" ? (
        <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
          <Radio className="size-7 text-amber-400" />
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
        <div className="relative aspect-video min-h-56 overflow-hidden bg-gradient-to-br from-primary/20 via-neutral-950 to-secondary/20">
          {hasVideo && peer ? (
            <video
              aria-label={`${artistName} live camera`}
              autoPlay
              className="absolute inset-0 size-full object-cover"
              muted={peer === self}
              playsInline
              ref={videoRef}
            >
              <track
                kind="captions"
                label={`${artistName} captions`}
                src="data:text/vtt,WEBVTT"
              />
            </video>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <Avatar className="size-20 border-2 border-white/20 sm:size-24">
                <AvatarImage src={artistAvatarUrl ?? undefined} />
                <AvatarFallback className="text-xl font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <p className="text-sm text-white/70">
                {displayedConnection === "disabled"
                  ? "Camera appears when the party goes live"
                  : peer
                    ? "Camera is off"
                    : "Waiting for artist camera"}
              </p>
            </div>
          )}
          <audio
            aria-label={`${artistName} microphone`}
            autoPlay
            ref={audioRef}
          >
            <track
              kind="captions"
              label={`${artistName} captions`}
              src="data:text/vtt,WEBVTT"
            />
          </audio>
          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/80 to-transparent p-3">
            <div>
              <p className="font-bold text-sm text-white">{artistName}</p>
              <Badge className="mt-1 text-[10px]" variant="default">
                {hasVideo ? "On camera" : "Audio room"}
              </Badge>
            </div>
            <div className="flex items-center gap-1 rounded-md bg-black/50 px-2 py-1 text-white">
              {hasAudio ? (
                <Mic className="size-3.5" />
              ) : (
                <MicOff className="size-3.5" />
              )}
              {hasVideo ? (
                <Camera className="size-3.5" />
              ) : (
                <CameraOff className="size-3.5" />
              )}
            </div>
          </div>
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
