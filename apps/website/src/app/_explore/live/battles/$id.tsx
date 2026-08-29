"use client";
/* eslint-disable complexity, no-nested-ternary, no-unused-vars, no-void, react/set-state-in-effect, sort-vars, one-var, require-unicode-regexp, unicorn/consistent-function-scoping, unicorn/no-nested-ternary */

import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
  ArrowLeft,
  Camera,
  CalendarClock,
  CheckCircle2,
  Disc3,
  Heart,
  ListPlus,
  LockKeyhole,
  LogOut,
  Maximize,
  Mic,
  MicOff,
  Minimize,
  Play,
  Radio,
  RefreshCw,
  Share2,
  Swords,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { LiveRoomAccessGuard } from "@/components/explore/live-room-access-guard";
import { BattleArtistControlPanel } from "@/components/live/battle-artist-control-panel";
import { BattleLifecycleControls } from "@/components/live/battle-lifecycle-controls";
import { BattleMediaStage } from "@/components/live/battle-media-stage";
import { BattleTimer } from "@/components/live/battle-timer";
import { LiveChatPanel } from "@/components/live/live-room-panels";
import { LiveTwitchShell } from "@/components/live/live-twitch-shell";
import { useBrowserFullscreen } from "@/components/live/use-browser-fullscreen";
import { UserProfilePreviewModal } from "@/components/live/user-profile-preview-modal";
import type { UserPreviewData } from "@/components/live/user-profile-preview-modal";
import { AppImage } from "@/components/ui/app-image";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBattleLeaveGuard } from "@/hooks/use-battle-leave-guard";
import { toast } from "@/hooks/use-toast";
import { API_V1_URL } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import {
  clearBattleKitSelection,
  readBattleKitSelection,
} from "@/lib/battle-kit-selection";
import type { BattleMediaDeviceSelection } from "@/lib/battle-media-selection";
import {
  readBattleMediaDeviceSelection,
  rememberBattleMediaDeviceSelection,
  resolveBattleMediaDeviceSelection,
} from "@/lib/battle-media-selection";
import {
  clearBattleReturnIntent,
  rememberBattleReturnIntent,
} from "@/lib/battle-return-intent";
import {
  completeBattleShareReferral,
  rememberBattleShareReferral,
} from "@/lib/battle-share";
import type { LiveBattleRound, LiveRoomArtist } from "@/lib/live-room";
import { useLiveRoom } from "@/lib/live-room";
import type { BattleKit } from "@/lib/soundkit-api-hooks";
import { useBattleKitsQuery } from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/_explore/live/battles/$id")({
  component: PublicBattlePage,
});

function PublicBattlePage() {
  const { id } = Route.useParams();
  return <BattlePage roomId={id} />;
}

const mediaErrorMessage = (error: unknown) => {
    if (error instanceof Error && !(error instanceof DOMException)) {
      return error.message;
    }

    const name = error instanceof DOMException ? error.name : "";
    if (name === "NotAllowedError" || name === "SecurityError") {
      return "Camera or microphone access is blocked. Allow both devices in your browser site settings, then try again.";
    }
    if (name === "NotFoundError") {
      return "No camera or microphone was found. Connect both devices, then try again.";
    }
    if (name === "NotReadableError") {
      return "Another app is using your camera or microphone. Close it, then try again.";
    }
    if (name === "OverconstrainedError") {
      return "The saved device is no longer available. SoundKit reset to your browser’s default devices; try again.";
    }
    return "We could not access your camera or microphone. Check browser permissions and try again.";
  },
  voteTotal = (round: LiveBattleRound) =>
    Object.values(round.voteTotals).reduce((sum, votes) => sum + votes, 0),
  votePercent = (round: LiveBattleRound, artistId: string) => {
    const total = voteTotal(round);
    return total > 0
      ? Math.round(((round.voteTotals[artistId] ?? 0) / total) * 100)
      : 50;
  };

function WinnerBanner({
  artist,
  isTie,
}: {
  artist?: LiveRoomArtist;
  isTie?: boolean;
}) {
  if (isTie) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-center">
        <p className="font-bold text-amber-400 text-sm">Round Tied!</p>
        <p className="mt-1 text-muted-foreground text-xs">
          Audience votes were split evenly. Entering sudden death tiebreaker.
        </p>
      </div>
    );
  }

  if (!artist) {
    return null;
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-center">
      <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-primary/20 text-primary">
        <Trophy className="size-5" />
      </div>
      <p className="mt-2 font-bold text-base text-foreground">
        {artist.name} Wins Round!
      </p>
      <p className="text-muted-foreground text-xs">
        Highest audience score &amp; verified turn completion
      </p>
    </div>
  );
}

function StageCard({
  artist,
  isActive,
}: {
  artist: LiveRoomArtist;
  isActive: boolean;
}) {
  return (
    <div
      className={`relative flex items-center gap-3.5 rounded-xl border p-3.5 transition-all ${
        isActive
          ? "border-primary bg-primary/10 shadow-md ring-1 ring-primary/40"
          : "border-border/50 bg-card/60"
      }`}
    >
      <Avatar className="size-12 border-2 border-border/80">
        <AvatarImage src={artist.avatarUrl} />
        <AvatarFallback className="font-bold">
          {artist.name.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-1.5">
          <p className="truncate font-bold text-sm">{artist.name}</p>
          {artist.verified && (
            <CheckCircle2 className="size-3.5 text-primary" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 rounded bg-background/80 px-1.5 py-0.5 font-bold text-[10px] text-amber-400">
            <Trophy className="size-2.5" />
            {artist.roundsWon} Won
          </span>
          <Badge
            className="text-[9px] px-1.5 py-0"
            variant={artist.isMuted ? "outline" : "default"}
          >
            {artist.isMuted ? (
              <>
                <MicOff className="mr-1 size-2.5" />
                Muted until turn
              </>
            ) : (
              <>
                <Mic className="mr-1 size-2.5" />
                Turn
              </>
            )}
          </Badge>
        </div>
      </div>
    </div>
  );
}

function BattleStageVisual({
  artistView = false,
  artists,
  phaseLabel,
}: {
  artistView?: boolean;
  artists: [LiveRoomArtist, LiveRoomArtist];
  phaseLabel: string;
}) {
  const [artistA, artistB] = artists;
  return (
    <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden bg-gradient-to-br from-primary/30 via-black to-secondary/30">
      <AppImage
        alt="SoundKit branded battle backdrop"
        className="absolute inset-0 size-full object-cover opacity-70"
        height={500}
        src="/soundkit-default-banner.svg"
        width={1280}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/30" />
      <div className="relative z-10 flex flex-col items-center gap-4 p-4 text-center">
        <Badge
          className="gap-1.5 bg-black/60 text-white backdrop-blur-md"
          variant="outline"
        >
          <CalendarClock className="size-3.5" />
          {phaseLabel}
        </Badge>
        <div className="flex items-center gap-6 sm:gap-10">
          <div className="flex flex-col items-center gap-2">
            <Avatar className="size-16 rounded-xl border-2 border-primary ring-4 ring-primary/20 shadow-xl sm:size-20">
              <AvatarImage src={artistA.avatarUrl} />
              <AvatarFallback className="rounded-xl text-lg font-bold">
                {artistA.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <p className="max-w-[140px] truncate text-sm font-bold text-white sm:text-base">
              {artistNameWithRank(artistA)}
            </p>
          </div>
          <div className="rounded-full bg-destructive/90 p-3 text-white shadow-lg">
            <Swords className="size-6 sm:size-8" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <Avatar className="size-16 rounded-xl border-2 border-secondary ring-4 ring-secondary/20 shadow-xl sm:size-20">
              <AvatarImage src={artistB.avatarUrl} />
              <AvatarFallback className="rounded-xl text-lg font-bold">
                {artistB.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <p className="max-w-[140px] truncate text-sm font-bold text-white sm:text-base">
              {artistNameWithRank(artistB)}
            </p>
          </div>
        </div>
        <p className="text-xs text-white/70 sm:text-sm">
          {artistView
            ? "You are in the artist room. Chat with the arena while BattleBot prepares the stage."
            : "Watch the countdown, chat with the arena, and get admitted when the battle opens."}
        </p>
      </div>
    </div>
  );
}

const battleFormatDetails = {
  best_of_3: {
    label: "Best of 3",
    rounds: "3 rounds + tiebreaker",
  },
  best_of_5: {
    label: "Best of 5",
    rounds: "5 rounds + tiebreaker",
  },
  best_of_7: {
    label: "Best of 7",
    rounds: "7 rounds + tiebreaker",
  },
} satisfies Record<BattleKit["format"], { label: string; rounds: string }>;

const artistNameWithRank = (artist: LiveRoomArtist) => {
  if (typeof artist.rank === "number" && artist.rank > 0) {
    return `#${artist.rank} ${artist.name}`;
  }

  if (typeof artist.rank === "string" && artist.rank.trim()) {
    const rankLabel = artist.rank.trim().startsWith("#")
      ? artist.rank.trim()
      : `#${artist.rank.trim()}`;
    return `${rankLabel} ${artist.name}`;
  }

  return artist.name;
};

function BattleStartStatus({
  artists,
  phase,
  phaseEndsAt,
  presentArtistUserIds,
  readyArtistUserIds,
  serverNow,
}: {
  artists: [LiveRoomArtist, LiveRoomArtist];
  phase?: string;
  phaseEndsAt: number | null | undefined;
  presentArtistUserIds: string[];
  readyArtistUserIds: string[];
  serverNow?: number;
}) {
  const allArtistsReady = artists.every((artist) =>
      readyArtistUserIds.includes(artist.id)
    ),
    allArtistsPresent = artists.every((artist) =>
      presentArtistUserIds.includes(artist.id)
    ),
    timerLabel =
      phase === "scheduled"
        ? "Battle opens in"
        : phase === "waiting_room"
          ? "Waiting room closes in"
          : "Battle starts in";

  return (
    <div className="mx-auto w-full max-w-2xl rounded-xl border border-border/60 bg-background/50 p-3 text-center">
      <p className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground">
        Battle starts
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <BattleTimer
          label={timerLabel}
          phaseEndsAt={phaseEndsAt}
          serverNow={serverNow}
        />
        <Badge
          className="gap-1.5 font-mono text-[10px]"
          variant={allArtistsReady ? "default" : "outline"}
        >
          {allArtistsReady ? (
            <CheckCircle2 className="size-3.5 text-emerald-300" />
          ) : (
            <Users className="size-3.5" />
          )}
          {allArtistsReady && allArtistsPresent
            ? "Ready"
            : `${readyArtistUserIds.length}/2 ready · ${presentArtistUserIds.length}/2 in room`}
        </Badge>
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-1.5">
        {artists.map((artist) => {
          const isPresent = presentArtistUserIds.includes(artist.id),
            isReady = readyArtistUserIds.includes(artist.id);
          return (
            <Badge
              className="max-w-56 gap-1.5 truncate text-[10px]"
              key={artist.id}
              variant={isReady && isPresent ? "secondary" : "outline"}
            >
              {isReady && isPresent ? (
                <CheckCircle2 className="size-3 text-emerald-400" />
              ) : (
                <span className="size-1.5 rounded-full bg-muted-foreground/50" />
              )}
              {artist.name} ·{" "}
              {isPresent ? (isReady ? "Ready" : "Preparing") : "Not in room"}
            </Badge>
          );
        })}
      </div>
    </div>
  );
}

function BattleDeviceSetup({
  onSaved,
  pending,
}: {
  onSaved: (selection: BattleMediaDeviceSelection) => void;
  pending: boolean;
}) {
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]),
    [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]),
    [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState(""),
    [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState(""),
    [mediaStream, setMediaStream] = useState<MediaStream | null>(null),
    [mediaStatus, setMediaStatus] = useState<
      "error" | "idle" | "ready" | "requesting"
    >("idle"),
    [error, setError] = useState<string | null>(null),
    [saved, setSaved] = useState(false),
    restoredSelectionRef = useRef<string | null>(null),
    previewRef = useRef<HTMLVideoElement | null>(null);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return [];
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setVideoDevices(devices.filter((device) => device.kind === "videoinput"));
      setAudioDevices(devices.filter((device) => device.kind === "audioinput"));
      return devices;
    } catch {
      return [];
    }
  }, []);

  const requestPermissions = useCallback(
    async (
      videoDeviceId = selectedVideoDeviceId,
      audioDeviceId = selectedAudioDeviceId
    ): Promise<BattleMediaDeviceSelection | null> => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser does not provide camera and microphone access.");
        setMediaStatus("error");
        return null;
      }

      setMediaStatus("requesting");
      setError(null);
      setSaved(false);

      let acquiredStream: MediaStream | null = null;
      try {
        const devicesBeforeRequest = await refreshDevices(),
          availableDeviceSelection = resolveBattleMediaDeviceSelection(
            devicesBeforeRequest,
            {
              audioDeviceId,
              videoDeviceId,
            }
          ),
          validVideoDeviceId =
            availableDeviceSelection.videoDeviceId === videoDeviceId
              ? videoDeviceId
              : "",
          validAudioDeviceId =
            availableDeviceSelection.audioDeviceId === audioDeviceId
              ? audioDeviceId
              : "",
          constraints = {
            audio: validAudioDeviceId
              ? { deviceId: { exact: validAudioDeviceId } }
              : true,
            video: validVideoDeviceId
              ? { deviceId: { exact: validVideoDeviceId } }
              : true,
          };
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          acquiredStream = stream;
        } catch (mediaError) {
          const errorName =
            mediaError instanceof DOMException ? mediaError.name : "";
          if (
            errorName !== "OverconstrainedError" &&
            errorName !== "NotFoundError"
          ) {
            throw mediaError;
          }

          stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true,
          });
          acquiredStream = stream;
        }
        const devices = await refreshDevices(),
          streamVideoDeviceId =
            stream.getVideoTracks()[0]?.getSettings().deviceId ?? "",
          streamAudioDeviceId =
            stream.getAudioTracks()[0]?.getSettings().deviceId ?? "",
          refreshedDeviceSelection = resolveBattleMediaDeviceSelection(
            devices,
            {
              audioDeviceId: validAudioDeviceId,
              videoDeviceId: validVideoDeviceId,
            }
          ),
          nextVideoDevice =
            streamVideoDeviceId ||
            validVideoDeviceId ||
            refreshedDeviceSelection.videoDeviceId,
          nextAudioDevice =
            streamAudioDeviceId ||
            validAudioDeviceId ||
            refreshedDeviceSelection.audioDeviceId,
          selection = {
            audioDeviceId: nextAudioDevice,
            videoDeviceId: nextVideoDevice,
          };
        if (!(selection.videoDeviceId && selection.audioDeviceId)) {
          throw new Error(
            "SoundKit could not find both a camera and microphone. Connect both devices, then try again."
          );
        }

        setMediaStream(stream);
        setSelectedVideoDeviceId(selection.videoDeviceId);
        setSelectedAudioDeviceId(selection.audioDeviceId);
        setMediaStatus("ready");
        return selection;
      } catch (permissionError) {
        for (const track of acquiredStream?.getTracks() ?? []) {
          track.stop();
        }
        setMediaStatus("error");
        setError(mediaErrorMessage(permissionError));
        return null;
      }
    },
    [refreshDevices, selectedAudioDeviceId, selectedVideoDeviceId]
  );

  useEffect(() => {
    const stream = mediaStream;
    return () => {
      for (const track of stream?.getTracks() ?? []) {
        track.stop();
      }
    };
  }, [mediaStream]);

  useEffect(() => {
    const video = previewRef.current;
    if (!video) {
      return;
    }

    video.srcObject = mediaStream;
    return () => {
      video.srcObject = null;
    };
  }, [mediaStream]);

  useEffect(() => {
    void refreshDevices();
  }, [refreshDevices]);

  useEffect(() => {
    const savedSelection = readBattleMediaDeviceSelection();
    if (!savedSelection) {
      return;
    }

    setSelectedVideoDeviceId(savedSelection.videoDeviceId);
    setSelectedAudioDeviceId(savedSelection.audioDeviceId);

    if (!navigator.permissions?.query) {
      return;
    }

    const selectionKey = `${savedSelection.videoDeviceId}:${savedSelection.audioDeviceId}`;
    if (restoredSelectionRef.current === selectionKey) {
      return;
    }
    restoredSelectionRef.current = selectionKey;

    let disposed = false;
    const restoreSavedSetup = async () => {
      try {
        const [cameraPermission, microphonePermission] = await Promise.all([
          navigator.permissions.query({ name: "camera" }),
          navigator.permissions.query({ name: "microphone" }),
        ]);
        if (
          disposed ||
          cameraPermission.state !== "granted" ||
          microphonePermission.state !== "granted"
        ) {
          return;
        }

        const restoredSelection = await requestPermissions(
          savedSelection.videoDeviceId,
          savedSelection.audioDeviceId
        );
        if (restoredSelection && !disposed) {
          rememberBattleMediaDeviceSelection(restoredSelection);
          setSaved(true);
          onSaved(restoredSelection);
        }
      } catch {
        if (!disposed) {
          setMediaStatus("idle");
        }
      }
    };

    void restoreSavedSetup();
    return () => {
      disposed = true;
    };
  }, [onSaved, requestPermissions]);

  useEffect(() => {
    const { mediaDevices } = navigator;
    if (!mediaDevices) {
      return;
    }

    const handleDeviceChange = () => {
      void refreshDevices();
    };
    mediaDevices.addEventListener("devicechange", handleDeviceChange);
    return () =>
      mediaDevices.removeEventListener("devicechange", handleDeviceChange);
  }, [refreshDevices]);

  const saveSetup = () => {
    if (
      !(
        mediaStatus === "ready" &&
        selectedVideoDeviceId &&
        selectedAudioDeviceId
      )
    ) {
      return;
    }

    const hasSelectedDevices =
      videoDevices.some(
        (device) => device.deviceId === selectedVideoDeviceId
      ) &&
      audioDevices.some((device) => device.deviceId === selectedAudioDeviceId);
    if (!hasSelectedDevices) {
      setMediaStatus("error");
      setError(
        "The selected camera or microphone is no longer available. Choose another device and try again."
      );
      return;
    }

    const selection = {
      audioDeviceId: selectedAudioDeviceId,
      videoDeviceId: selectedVideoDeviceId,
    };
    rememberBattleMediaDeviceSelection(selection);
    onSaved(selection);
    setSaved(true);
  };

  return (
    <>
      <div className="space-y-2 rounded-xl border border-border/60 bg-background/40 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Camera className="size-3.5 text-primary" />
            <p className="font-semibold text-xs">Camera</p>
          </div>
          <Badge
            className="text-[10px]"
            variant={mediaStatus === "ready" ? "secondary" : "outline"}
          >
            {mediaStatus === "ready" ? "Ready" : "Not set"}
          </Badge>
        </div>
        <div className="aspect-video overflow-hidden rounded-lg bg-black">
          {mediaStream ? (
            <video
              aria-label="Camera preview"
              autoPlay
              className="size-full object-cover"
              muted
              playsInline
              ref={previewRef}
            />
          ) : (
            <div className="flex size-full items-center justify-center px-3 text-center text-[10px] text-muted-foreground">
              Preview appears after permission is granted.
            </div>
          )}
        </div>
        <Select
          disabled={mediaStatus === "requesting" || videoDevices.length === 0}
          onValueChange={(value) => {
            setSelectedVideoDeviceId(value);
            void requestPermissions(value, selectedAudioDeviceId);
          }}
          value={selectedVideoDeviceId}
        >
          <SelectTrigger aria-label="Battle camera" className="text-xs">
            <SelectValue placeholder="Select camera" />
          </SelectTrigger>
          <SelectContent>
            {videoDevices.map((device) => (
              <SelectItem key={device.deviceId} value={device.deviceId}>
                {device.label || `Camera ${device.deviceId.slice(0, 6)}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {mediaStatus !== "ready" && (
          <Button
            className="w-full gap-1.5 text-xs"
            disabled={mediaStatus === "requesting" || pending}
            onClick={() => void requestPermissions()}
            size="sm"
            type="button"
            variant="outline"
          >
            <Camera className="size-3.5" />
            {mediaStatus === "requesting"
              ? "Requesting access..."
              : "Enable camera & mic"}
          </Button>
        )}
      </div>

      <div className="space-y-2 rounded-xl border border-border/60 bg-background/40 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Mic className="size-3.5 text-primary" />
            <p className="font-semibold text-xs">Microphone</p>
          </div>
          <Badge
            className="text-[10px]"
            variant={mediaStatus === "ready" ? "secondary" : "outline"}
          >
            {mediaStatus === "ready" ? "Ready" : "Not set"}
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Choose the input used for your live battle turn.
        </p>
        <Select
          disabled={mediaStatus === "requesting" || audioDevices.length === 0}
          onValueChange={(value) => {
            setSelectedAudioDeviceId(value);
            void requestPermissions(selectedVideoDeviceId, value);
          }}
          value={selectedAudioDeviceId}
        >
          <SelectTrigger aria-label="Battle microphone" className="text-xs">
            <SelectValue placeholder="Select microphone" />
          </SelectTrigger>
          <SelectContent>
            {audioDevices.map((device) => (
              <SelectItem key={device.deviceId} value={device.deviceId}>
                {device.label || `Mic ${device.deviceId.slice(0, 6)}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="rounded-lg border border-dashed border-border/70 p-2 text-[10px] text-muted-foreground">
          {mediaStatus === "ready"
            ? "Access granted. Your selected camera and microphone will be restored next time."
            : "Camera and microphone permissions are requested together. Browser permission is remembered after you allow it."}
        </div>
        {error && <p className="text-[10px] text-destructive">{error}</p>}
        <Button
          className="w-full gap-1.5 text-xs"
          disabled={
            pending ||
            mediaStatus !== "ready" ||
            !selectedVideoDeviceId ||
            !selectedAudioDeviceId
          }
          onClick={saveSetup}
          size="sm"
          type="button"
        >
          <CheckCircle2 className="size-3.5" />
          {saved ? "Device setup saved" : "Save device setup"}
        </Button>
      </div>
    </>
  );
}

function ArtistBattlePreparation({
  format,
  isReady,
  lockedKitId,
  onLock,
  onMediaSetupSaved,
  onReady,
  pending,
}: {
  format: BattleKit["format"];
  isReady: boolean;
  lockedKitId: string | null;
  onLock: (kitId: string) => Promise<void>;
  onMediaSetupSaved: (selection: BattleMediaDeviceSelection) => void;
  onReady: (ready: boolean) => Promise<void>;
  pending: boolean;
}) {
  const formatDetails = battleFormatDetails[format],
    kitsQuery = useBattleKitsQuery({ format, ready: true }),
    kits = kitsQuery.data ?? [],
    [draftKitId, setDraftKitId] = useState(lockedKitId ?? ""),
    [isSetupOpen, setIsSetupOpen] = useState(!isReady),
    [mediaSetupSaved, setMediaSetupSaved] = useState(false),
    [saveError, setSaveError] = useState<string | null>(null),
    draftKit = kits.find((kit) => kit.id === draftKitId),
    lockedKit = kits.find((kit) => kit.id === lockedKitId),
    selectedKit = draftKit ?? lockedKit,
    selectedKitId = selectedKit?.id ?? "",
    isLocked = Boolean(selectedKitId && selectedKitId === lockedKitId),
    lockKit = async () => {
      if (!selectedKitId || isLocked) {
        return;
      }

      setSaveError(null);
      try {
        await onLock(selectedKitId);
      } catch (error) {
        setSaveError(
          error instanceof Error
            ? error.message
            : "Could not lock this Battle Kit."
        );
      }
    },
    handleMediaSetupSaved = (selection: BattleMediaDeviceSelection) => {
      setMediaSetupSaved(true);
      onMediaSetupSaved(selection);
    },
    handleReady = async (ready: boolean) => {
      await onReady(ready);
    };

  return (
    <Card className="border-primary/30 bg-primary/5 shadow-sm">
      <Accordion
        collapsible
        onValueChange={(value) => setIsSetupOpen(value === "setup")}
        type="single"
        value={isSetupOpen ? "setup" : ""}
      >
        <AccordionItem className="border-0" value="setup">
          <CardHeader className="gap-2 pb-3">
            <AccordionTrigger className="items-start gap-3 py-0 hover:no-underline [&>svg]:mt-1 [&>svg]:text-muted-foreground">
              <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-3 text-left">
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 rounded-md bg-primary/15 p-2 text-primary">
                    <Disc3 className="size-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm">
                      {isReady ? "Ready for battle" : "Prepare your battle lineup"}
                    </CardTitle>
                    <CardDescription className="mt-1 text-xs">
                      {isReady
                        ? `${formatDetails.label} kit and media permissions saved.`
                        : `${formatDetails.label} · ${formatDetails.rounds}. Choose a battle-ready kit before the room opens.`}
                    </CardDescription>
                  </div>
                </div>
                <Badge
                  className="gap-1.5 text-[10px]"
                  variant={isReady ? "default" : isLocked ? "secondary" : "outline"}
                >
                  {isReady || isLocked ? (
                    <LockKeyhole className="size-3" />
                  ) : (
                    <Swords className="size-3" />
                  )}
                  {isReady ? "Ready" : isLocked ? "Kit locked" : "Setup needed"}
                </Badge>
              </div>
            </AccordionTrigger>
          </CardHeader>
          <AccordionContent className="px-6 pb-6 pt-0">
            <div className="space-y-3">
        {kitsQuery.isLoading && (
          <div className="rounded-lg border border-dashed border-border/70 bg-background/40 p-3 text-xs text-muted-foreground">
            Loading your {formatDetails.label} Battle Kits...
          </div>
        )}

        {kitsQuery.error && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-xs text-destructive">
              We could not load your Battle Kits. Try again before the battle
              starts.
            </p>
            <Button
              className="gap-1.5 text-xs"
              onClick={async () => {
                await kitsQuery.refetch();
              }}
              size="sm"
              variant="outline"
            >
              <RefreshCw className="size-3.5" />
              Retry
            </Button>
          </div>
        )}

        {!kitsQuery.isLoading && !kitsQuery.error && kits.length === 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border/70 bg-background/40 p-3">
            <div>
              <p className="font-semibold text-xs">
                No battle-ready {formatDetails.label} kits yet.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Build the required lineup in My Battle Kits, then return here.
              </p>
            </div>
            <Button asChild className="text-xs" size="sm" variant="outline">
              <Link to="/dashboard/live/my-kit">Manage kits</Link>
            </Button>
          </div>
        )}

        {!kitsQuery.isLoading && !kitsQuery.error && kits.length > 0 && (
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <label
                    className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground"
                    htmlFor="battle-kit-select"
                  >
                    Battle Kit
                  </label>
                  <Select
                    onValueChange={(value) => {
                      setSaveError(null);
                      setDraftKitId(value);
                    }}
                    value={selectedKitId}
                  >
                    <SelectTrigger
                      aria-label="Battle Kit"
                      className="bg-background/70"
                      id="battle-kit-select"
                    >
                      <SelectValue
                        placeholder={`Choose a ${formatDetails.label} kit`}
                      />
                    </SelectTrigger>
                    <SelectContent className="[&_[data-highlighted]]:bg-muted [&_[data-highlighted]]:text-foreground">
                      {kits.map((kit) => (
                        <SelectItem key={kit.id} value={kit.id}>
                          <span className="flex items-center gap-2">
                            <span>{kit.name}</span>
                            <span className="text-muted-foreground">
                              · {kit.totalUniqueTracks} tracks
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="gap-1.5 text-xs"
                  disabled={!selectedKitId || isLocked || kitsQuery.isFetching}
                  onClick={async () => {
                    await lockKit();
                  }}
                  size="sm"
                >
                  <LockKeyhole className="size-3.5" />
                  {isLocked ? "Locked for battle" : "Lock Kit"}
                </Button>
              </div>

              {selectedKit && (
                <div className="rounded-lg border border-border/60 bg-background/40 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-xs">{selectedKit.name}</p>
                    <Badge className="text-[10px]" variant="secondary">
                      {selectedKit.totalUniqueTracks} tracks ready
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selectedKit.tracks.map((track) => (
                      <Badge
                        className="max-w-full truncate text-[10px]"
                        key={track.id}
                        variant="outline"
                      >
                        {track.role === "tiebreaker"
                          ? "TB"
                          : `R${track.mainSlot ?? "?"}`}{" "}
                        {track.title}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <BattleDeviceSetup
              onSaved={handleMediaSetupSaved}
              pending={pending}
            />
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
          <p className="text-[11px] text-muted-foreground">
            {mediaSetupSaved
              ? "Device setup saved. Mark yourself ready when your Battle Kit is locked."
              : "Save your Battle Kit, camera, and microphone before marking yourself ready."}
          </p>
          <Button
            className="gap-1.5"
            disabled={pending || !isLocked || !mediaSetupSaved}
            onClick={() => void handleReady(!isReady)}
            size="sm"
            type="button"
            variant={isReady ? "secondary" : "default"}
          >
            <CheckCircle2 className="size-3.5" />
            {isReady ? "Not ready" : "I’m ready"}
          </Button>
        </div>

        {saveError && <p className="text-xs text-destructive">{saveError}</p>}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}

export function BattlePage({
  artistView = false,
  roomId,
}: {
  artistView?: boolean;
  roomId: string;
}) {
  const id = roomId,
    referrerUsername =
      typeof window === "undefined"
        ? undefined
        : (new URLSearchParams(window.location.search).get("ref") ?? undefined),
    router = useRouter(),
    { data: session } = authClient.useSession(),
    {
      battleDisposition,
      battleKit,
      battleReady,
      battleTrack,
      chat,
      chatMessages,
      leave,
      query,
      queue,
      vote,
    } = useLiveRoom(id),
    [isChatOpen, setIsChatOpen] = useState(true),
    [isFollowingBattle, setIsFollowingBattle] = useState(false),
    [previewUser, setPreviewUser] = useState<UserPreviewData | null>(null),
    [selectedBattleKitId, setSelectedBattleKitId] = useState<string | null>(
      () => readBattleKitSelection()?.kitId ?? null
    ),
    [mediaDeviceSelection, setMediaDeviceSelection] =
      useState<BattleMediaDeviceSelection | null>(null),
    selectedBattleKit = useRef(readBattleKitSelection()),
    battleKitApplied = useRef(false),
    {
      containerRef: videoContainerRef,
      isFullscreen,
      toggleFullscreen,
    } = useBrowserFullscreen(),
    room = query.data,
    battle = room?.battle,
    phase = battle?.coordination?.phase,
    isBattleEnded = Boolean(room?.status === "ended" || phase === "ended"),
    canonicalRoomId = battle?.coordination?.battleId ?? id,
    artistRole =
      room?.role === "artist_a" || room?.role === "artist_b"
        ? room.role
        : session?.user?.id === battle?.artists[0]?.id
          ? "artist_a"
          : session?.user?.id === battle?.artists[1]?.id
            ? "artist_b"
            : null,
    isAdmin = room?.role === "admin" || session?.user?.role === "admin",
    isScheduled =
      room?.status === "upcoming" ||
      phase === "scheduled" ||
      phase === "waiting_room",
    isPreStartBattle = phase === "scheduled" || phase === "waiting_room",
    isBattleActive = Boolean(phase && !isPreStartBattle && !isBattleEnded),
    viewerQueueStatus = isBattleEnded
      ? null
      : (battle?.viewerQueueStatus ?? null),
    isAdmitted = viewerQueueStatus === "admitted",
    isArtist = artistRole !== null,
    isQueued =
      viewerQueueStatus === "queued" || viewerQueueStatus === "waiting",
    readyArtistUserIds = battle?.coordination?.artistReadyUserIds ?? [],
    isBattleTie = Boolean(
      battle &&
      !battle.outcome &&
      !battle.coordination?.winnerUserId &&
      (phase === "battle_result" || phase === "ended") &&
      battle.rounds.find((round) => round.id === battle.currentRoundId)
        ?.status === "complete"
    ),
    lockedBattleKitId =
      battle?.artistControls?.selectedKitId ?? selectedBattleKitId,
    currentRound = battle?.rounds.find(
      (round) => round.id === battle.currentRoundId
    ),
    currentTrack = room?.tracklist.find(
      (track) => track.id === room.currentTrackId
    ),
    battleWinner = battle?.artists.find(
      (artist) => artist.id === battle.coordination?.winnerUserId
    ),
    { dialog: battleLeaveDialog } = useBattleLeaveGuard({
      isArtist,
      isLeaving: leave.isPending || battleDisposition.isPending,
      onForfeit: isArtist
        ? async () => {
            await battleDisposition.mutateAsync({
              affectedUserId: session?.user?.id,
              kind: "forfeited",
              reason: "artist_unavailable",
            });
          }
        : undefined,
      onLeave: () => {
        leave.mutate();
      },
      onQuit: isArtist
        ? async () => {
            await battleDisposition.mutateAsync({
              affectedUserId: session?.user?.id,
              kind: "quit",
              reason: "artist_unavailable",
            });
          }
        : undefined,
      shouldBlock: isBattleActive,
    });

  const currentArtistId =
      artistRole === "artist_a"
        ? battle?.artists[0]?.id
        : artistRole === "artist_b"
          ? battle?.artists[1]?.id
          : null,
    currentArtistReady = Boolean(
      isArtist &&
      currentArtistId &&
      readyArtistUserIds.includes(currentArtistId)
    );

  useEffect(() => {
    if (!referrerUsername) {
      return;
    }

    rememberBattleShareReferral({
      battleId: id,
      returnPath: `/live/battles/${encodeURIComponent(id)}`,
      senderUsername: referrerUsername.trim().toLowerCase(),
    });
    if (session?.user?.id) {
      void completeBattleShareReferral();
    }
  }, [id, referrerUsername, session?.user?.id]);

  useEffect(() => {
    if (!isArtist || !session?.user?.id || !battle) {
      return;
    }

    if (isPreStartBattle) {
      rememberBattleReturnIntent({ battleId: id, userId: session.user.id });
    } else {
      clearBattleReturnIntent(id);
    }
  }, [battle, id, isArtist, isPreStartBattle, session?.user?.id]);

  useEffect(() => {
    if (artistView || !isArtist || !battle || isBattleEnded) {
      return;
    }

    void router.navigate({
      params: { roomId: canonicalRoomId },
      replace: true,
      to: "/dashboard/live/battles/join/$roomId/artistview",
    });
  }, [
    artistView,
    battle,
    canonicalRoomId,
    isArtist,
    isBattleEnded,
    phase,
    router,
  ]);

  useEffect(() => {
    if (
      !artistView ||
      query.isLoading ||
      query.isError ||
      !room ||
      !battle ||
      isArtist ||
      isAdmin
    ) {
      return;
    }

    void router.navigate({
      params: { id },
      replace: true,
      to: "/live/battles/$id",
    });
  }, [
    artistView,
    battle,
    id,
    isAdmin,
    isArtist,
    query.isError,
    query.isLoading,
    room,
    router,
  ]);

  useEffect(() => {
    if (
      !artistView ||
      !isBattleEnded ||
      query.isLoading ||
      query.isError ||
      !room ||
      !battle
    ) {
      return;
    }

    void router.navigate({
      params: { id },
      replace: true,
      to: "/live/battles/$id",
    });
  }, [
    artistView,
    battle,
    id,
    isBattleEnded,
    query.isError,
    query.isLoading,
    room,
    router,
  ]);

  useEffect(() => {
    const selection = selectedBattleKit.current;
    if (
      battleKitApplied.current ||
      !selection ||
      !battle ||
      !isScheduled ||
      !session?.user?.id ||
      (selection.battleId && selection.battleId !== id)
    ) {
      return;
    }

    battleKitApplied.current = true;
    void (async () => {
      try {
        await battleKit.mutateAsync({ kitId: selection.kitId });
        setSelectedBattleKitId(selection.kitId);
        clearBattleKitSelection();
        toast({
          description: "Your selected kit is locked for this battle.",
          title: "Battle Kit selected",
        });
      } catch {
        battleKitApplied.current = false;
      }
    })();
  }, [battleKit, battle, id, isScheduled, session?.user?.id]);

  useEffect(() => {
    if (!isAdmitted) {
      return;
    }
    const sendLeaveAttempt = () => {
      navigator.sendBeacon(
        `${API_V1_URL}/live/rooms/${id}/leave`,
        new Blob([], { type: "application/json" })
      );
    };
    window.addEventListener("pagehide", sendLeaveAttempt);
    return () => window.removeEventListener("pagehide", sendLeaveAttempt);
  }, [id, isAdmitted]);

  const handleJoinQueue = () => {
      if (!session?.user) {
        void router.navigate({ to: "/signup/fan/credentials" });
        return;
      }

      if (!queue.mutate) {
        return;
      }
      queue.mutate();
    },
    handleLockBattleKit = async (kitId: string) => {
      await battleKit.mutateAsync({ kitId });
      setSelectedBattleKitId(kitId);
      clearBattleKitSelection();
      toast({
        description:
          "This lineup is locked and will be used when the battle opens.",
        title: "Battle Kit locked",
      });
    };

  const handleBattleDisposition = async (disposition: {
    affectedUserId?: string | null;
    kind: "canceled" | "ducked" | "forfeited" | "quit";
    reason: string;
  }) => {
    await battleDisposition.mutateAsync({
      ...disposition,
      affectedUserId:
        (disposition.kind === "forfeited" || disposition.kind === "quit") &&
        !isAdmin
          ? (session?.user?.id ?? null)
          : disposition.affectedUserId,
    });
    clearBattleReturnIntent(id);
    toast({
      description:
        disposition.kind === "ducked"
          ? "The opponent was recorded as ducked. No rating was changed."
          : disposition.kind === "forfeited"
            ? "The forfeit was recorded."
            : disposition.kind === "quit"
              ? "Your battle exit was recorded."
              : "The battle was canceled without changing ratings.",
      title: "Battle updated",
    });
  };

  const handleShareBattle = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      toast({
        description: "Battle link copied to clipboard.",
        title: "Link Copied",
      });
    }
  };

  const handleToggleFollow = () => {
    setIsFollowingBattle((prev) => !prev);
    toast({
      description: isFollowingBattle
        ? "Unfollowed battle notifications."
        : "You will receive alerts when new battle rounds start!",
      title: isFollowingBattle ? "Unfollowed" : "Following Battle",
    });
  };

  if (query.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Swords className="mx-auto size-8 animate-pulse text-primary" />
          <p className="mt-3 font-semibold text-sm">Loading live room...</p>
        </div>
      </div>
    );
  }

  if (query.isError || !room || !battle) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="font-semibold text-sm">
            {query.error?.message ?? "Battle room offline"}
          </p>
        </div>
      </div>
    );
  }

  if (artistView && !(isArtist || isAdmin)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <Card className="max-w-lg text-center">
          <CardHeader>
            <CardTitle>Opening public battle room</CardTitle>
            <CardDescription>
              This account is not assigned to this battle. Sending you to the
              viewer room now.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link params={{ id }} to="/live/battles/$id">
                Open public battle room
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [artistA, artistB] = battle.artists;

  if (isBattleEnded) {
    const replayIsReady =
      battle.replayStatus === "available" && Boolean(battle.replayVideoId),
      endedBeforeFirstTurn = battle.hasPlayedTurn === false;

    return (
      <LiveRoomAccessGuard allowPublic roomTitle={room.title}>
        <div className="flex min-h-[50vh] items-center justify-center p-6">
          <Card className="max-w-lg text-center">
            <CardHeader>
              <CardTitle>
                {endedBeforeFirstTurn
                  ? "Battle ended before the first turn"
                  : "Battle ended"}
              </CardTitle>
              <CardDescription>
                {endedBeforeFirstTurn
                  ? "No result was recorded because the first turn never opened."
                  : replayIsReady
                    ? "The final result is locked. Watch the published replay to review every turn."
                    : battle.replayStatus === "processing"
                      ? "The battle had real activity. Its replay is being prepared for publication."
                      : "The final result is locked, but no replay has been published for this battle."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {replayIsReady ? (
                <Button asChild>
                  <Link
                    params={{ id: battle.replayVideoId ?? "" }}
                    to="/videos/$id"
                  >
                    <Play aria-hidden="true" data-icon="inline-start" />
                    Watch Replay
                  </Link>
                </Button>
              ) : null}
              <Button asChild variant="outline">
                <Link
                  search={{
                    genre: undefined,
                    region: undefined,
                    regionType: "north-america",
                    sort: undefined,
                  }}
                  to="/live/battles"
                >
                  Browse recent replays
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </LiveRoomAccessGuard>
    );
  }

  if (isScheduled || !currentRound) {
    return (
      <LiveRoomAccessGuard
        allowPublic={artistView || isScheduled || isArtist || isAdmin}
        roomTitle={room.title}
      >
        <LiveTwitchShell
          chatPanel={
            <LiveChatPanel
              artistAvatarUrls={Object.fromEntries(
                battle.artists.map((artist) => [artist.id, artist.avatarUrl])
              )}
              artistUserIds={battle.artists.map((artist) => artist.id)}
              disabled={chat.isPending || isBattleEnded}
              fillHeight
              messages={chatMessages}
              onCollapse={() => setIsChatOpen(false)}
              onSend={(message) => chat.mutate({ message, userName: "You" })}
              title={artistView ? "Battle Chat" : "Waiting Room Chat"}
            />
          }
          isChatOpen={isChatOpen}
          onChatOpenChange={setIsChatOpen}
          videoNode={
            <BattleStageVisual
              artistView={artistView}
              artists={battle.artists}
              phaseLabel={phase === "scheduled" ? "Scheduled" : "Open"}
            />
          }
        >
          <div className="space-y-4 pt-4">
            <Card className="border-primary/40 bg-card/90 shadow-xl overflow-hidden">
              <CardHeader className="border-b border-border/60 bg-muted/40">
                <div className="flex flex-wrap items-center justify-center gap-2 text-center">
                  <div>
                    <CardTitle className="text-sm">{room.title}</CardTitle>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {artistNameWithRank(artistA)} vs{" "}
                      {artistNameWithRank(artistB)}
                    </p>
                  </div>
                  <Badge
                    className="gap-1.5 text-xs font-mono"
                    variant="outline"
                  >
                    <Users className="size-3 text-muted-foreground" />
                    {battle.queueSize?.toLocaleString() ?? 0} in queue
                  </Badge>
                </div>
                <div className="mt-3">
                  <BattleStartStatus
                    artists={battle.artists}
                    phase={phase}
                    phaseEndsAt={battle.coordination?.phaseEndsAt}
                    presentArtistUserIds={
                      battle.coordination?.artistPresentUserIds ?? []
                    }
                    readyArtistUserIds={readyArtistUserIds}
                    serverNow={room.serverNow}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {isArtist || isAdmin ? (
                    <Badge className="gap-1.5 text-xs" variant="secondary">
                      <Swords className="size-3.5" />
                      Artist room
                    </Badge>
                  ) : isQueued ? (
                    <>
                      <Badge variant="secondary" className="gap-1.5 text-xs">
                        <ListPlus className="size-3.5" />
                        You are in the queue
                      </Badge>
                      <Button
                        className="gap-1.5 text-xs"
                        disabled={leave.isPending}
                        onClick={() => leave.mutate()}
                        size="sm"
                        variant="outline"
                      >
                        <LogOut className="size-3.5" />
                        Leave
                      </Button>
                    </>
                  ) : (
                    <Button
                      className="gap-1.5 text-xs"
                      disabled={queue.isPending}
                      onClick={handleJoinQueue}
                      size="sm"
                    >
                      <ListPlus className="size-3.5" />
                      {session?.user ? "Join Queue" : "Sign up to Join Queue"}
                    </Button>
                  )}
                </div>
                {artistRole && battle.coordination?.format && (
                  <ArtistBattlePreparation
                    format={battle.coordination.format}
                    isReady={currentArtistReady}
                    lockedKitId={lockedBattleKitId ?? null}
                    onLock={handleLockBattleKit}
                    onMediaSetupSaved={setMediaDeviceSelection}
                    onReady={async (ready) => {
                      await battleReady.mutateAsync({ ready });
                    }}
                    pending={
                      battleReady.isPending || battleDisposition.isPending
                    }
                  />
                )}
                <BattleLifecycleControls
                  artists={battle.artists}
                  compact
                  currentUserId={session?.user?.id}
                  isAdmin={isAdmin}
                  isArtist={isArtist}
                  onDisposition={handleBattleDisposition}
                  pending={battleReady.isPending || battleDisposition.isPending}
                  phase={phase ?? "waiting_room"}
                  readyArtistUserIds={readyArtistUserIds}
                  roundNumber={battle.coordination?.roundNumber}
                />
                <p className="text-xs text-muted-foreground">
                  {artistView
                    ? "You can leave before the battle starts. SoundKit will bring you back when your match opens."
                    : "Join the queue to be admitted in batches when the battle opens."}
                </p>
                <Button
                  className="px-0"
                  onClick={() => router.history.back()}
                  size="sm"
                  variant="ghost"
                >
                  <ArrowLeft className="mr-2 size-4" />
                  Back
                </Button>
              </CardContent>
            </Card>
          </div>
        </LiveTwitchShell>
        {battleLeaveDialog}
      </LiveRoomAccessGuard>
    );
  }

  if (!currentRound) {
    return (
      <LiveRoomAccessGuard
        allowPublic={artistView || isArtist || isAdmin}
        roomTitle={room.title}
      >
        <div className="space-y-6 pb-8">
          <Button
            className="px-0"
            onClick={() => router.history.back()}
            size="sm"
            variant="ghost"
          >
            <ArrowLeft className="mr-2 size-4" />
            Back
          </Button>
          <Card>
            <CardHeader>
              <CardTitle>{room.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
              <div>
                <p className="font-semibold text-foreground">
                  This battle room is connected and preparing the lineup.
                </p>
                <p className="mt-1 text-sm">
                  {isArtist
                    ? "Lock your battle-ready Battle Kit. The stage will open as soon as both artists have a lineup."
                    : "The artists are finishing their lineup. Stay on this page and refresh to enter when the stage opens."}
                </p>
              </div>
              {isArtist && battle.coordination?.format && (
                <ArtistBattlePreparation
                  format={battle.coordination.format}
                  isReady={currentArtistReady}
                  lockedKitId={lockedBattleKitId ?? null}
                  onLock={handleLockBattleKit}
                  onMediaSetupSaved={setMediaDeviceSelection}
                  onReady={async (ready) => {
                    await battleReady.mutateAsync({ ready });
                  }}
                  pending={battleReady.isPending || battleDisposition.isPending}
                />
              )}
              {isArtist && (
                <BattleLifecycleControls
                  artists={battle.artists}
                  compact
                  currentUserId={session?.user?.id}
                  isAdmin={isAdmin}
                  isArtist={isArtist}
                  onDisposition={handleBattleDisposition}
                  pending={battleReady.isPending || battleDisposition.isPending}
                  phase={phase ?? "waiting_room"}
                  readyArtistUserIds={readyArtistUserIds}
                  roundNumber={battle.coordination?.roundNumber}
                />
              )}
              <div className="flex flex-wrap items-center gap-2">
                {!isArtist &&
                  (isQueued ? (
                    <>
                      <Badge className="gap-1.5" variant="secondary">
                        <ListPlus className="size-3.5" />
                        {viewerQueueStatus === "waiting"
                          ? "Waiting for the next opening"
                          : "In the battle queue"}
                      </Badge>
                      <Button
                        className="gap-1.5"
                        disabled={leave.isPending}
                        onClick={() => leave.mutate()}
                        size="sm"
                        variant="outline"
                      >
                        <LogOut className="size-3.5" />
                        Leave Queue
                      </Button>
                    </>
                  ) : (
                    <Button
                      className="gap-1.5"
                      disabled={queue.isPending}
                      onClick={handleJoinQueue}
                      size="sm"
                    >
                      <ListPlus className="size-3.5" />
                      {session?.user ? "Join Battle Queue" : "Sign up to Join"}
                    </Button>
                  ))}
                <Button
                  className="gap-1.5"
                  disabled={query.isFetching}
                  onClick={async () => {
                    await query.refetch();
                  }}
                  variant="outline"
                >
                  <RefreshCw className="size-3.5" />
                  Refresh Room
                </Button>
                {artistView ? (
                  <Button asChild variant="outline">
                    <Link to="/dashboard/live/battles">
                      Back to Battles Studio
                    </Link>
                  </Button>
                ) : (
                  <Button asChild variant="outline">
                    <Link
                      search={{
                        genre: undefined,
                        region: undefined,
                        regionType: "north-america",
                        sort: undefined,
                      }}
                      to="/live/battles"
                    >
                      Back to Battles
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        {battleLeaveDialog}
      </LiveRoomAccessGuard>
    );
  }

  const chatPanel = (
      <LiveChatPanel
        artistAvatarUrls={Object.fromEntries(
          battle.artists.map((artist) => [artist.id, artist.avatarUrl])
        )}
        artistUserIds={battle.artists.map((artist) => artist.id)}
        disabled={chat.isPending || isBattleEnded}
        extraHeaderAction={
          <Badge className="font-mono text-[10px]" variant="outline">
            BattleBot Control
          </Badge>
        }
        fillHeight
        messages={chatMessages}
        onCollapse={() => setIsChatOpen(false)}
        onSend={(message) => chat.mutate({ message, userName: "You" })}
        title="Arena Chat"
      />
    ),
    videoNode = (
      <div
        className="group relative aspect-video w-full overflow-hidden bg-black"
        ref={videoContainerRef}
      >
        <AppImage
          alt={currentTrack?.title ?? room.title}
          className="size-full object-cover opacity-80"
          height={720}
          src={
            currentTrack?.coverArtUrl ??
            "/music-battle-live-performance-video.jpg"
          }
          width={1280}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/30" />

        <div className="absolute left-4 top-4 right-4 flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="font-bold" variant="destructive">
              ROUND {currentRound.number}{" "}
              {currentRound.isTiebreaker ? "TIEBREAKER" : ""}
            </Badge>
            <Badge
              className="bg-black/60 backdrop-blur-md"
              variant={isBattleEnded ? "secondary" : "outline"}
            >
              {isBattleEnded
                ? "Battle Ended"
                : `Status: ${currentRound.status.toUpperCase()}`}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              className="bg-black/60 text-white backdrop-blur-md"
              variant="outline"
            >
              <Users className="mr-1 size-3" />
              {room.viewerCount.toLocaleString()} watching
            </Badge>
            {isBattleEnded ? (
              <Badge
                className="bg-black/70 font-mono text-white backdrop-blur-md"
                variant="outline"
              >
                Ended
              </Badge>
            ) : (
              <BattleTimer
                phaseEndsAt={battle.coordination?.phaseEndsAt}
                serverNow={room.serverNow}
                label={battle.coordination?.phase ?? "Round"}
              />
            )}
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

        <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
          <div className="grid w-full max-w-lg grid-cols-[1fr_auto_1fr] items-center gap-4 text-center">
            <button
              className="flex flex-col items-center space-y-1 cursor-pointer transition-transform hover:scale-105"
              onClick={() =>
                setPreviewUser({
                  avatarUrl: artistA.avatarUrl,
                  displayName: artistA.name,
                  followersCount: 1450,
                  role: "Battle Contender",
                  username: artistA.name.toLowerCase().replaceAll(/\s+/g, ""),
                  verified: artistA.verified,
                })
              }
              type="button"
            >
              <Avatar className="size-16 rounded-xl border-2 border-primary ring-4 ring-primary/20 shadow-xl sm:size-20">
                <AvatarImage src={artistA.avatarUrl} />
                <AvatarFallback className="rounded-xl font-bold text-lg">
                  {artistA.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <p className="max-w-[140px] truncate font-bold text-sm text-white sm:text-base">
                {artistNameWithRank(artistA)}
              </p>
              <span className="text-xs text-amber-400 font-bold">
                {artistA.roundsWon} Wins
              </span>
            </button>

            <div className="rounded-full bg-destructive/90 p-2.5 text-white shadow-lg">
              <Swords className="size-6 sm:size-8" />
            </div>

            <button
              className="flex flex-col items-center space-y-1 cursor-pointer transition-transform hover:scale-105"
              onClick={() =>
                setPreviewUser({
                  avatarUrl: artistB.avatarUrl,
                  displayName: artistB.name,
                  followersCount: 1820,
                  role: "Battle Contender",
                  username: artistB.name.toLowerCase().replaceAll(/\s+/g, ""),
                  verified: artistB.verified,
                })
              }
              type="button"
            >
              <Avatar className="size-16 rounded-xl border-2 border-secondary ring-4 ring-secondary/20 shadow-xl sm:size-20">
                <AvatarImage src={artistB.avatarUrl} />
                <AvatarFallback className="rounded-xl font-bold text-lg">
                  {artistB.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <p className="max-w-[140px] truncate font-bold text-sm text-white sm:text-base">
                {artistNameWithRank(artistB)}
              </p>
              <span className="text-xs text-amber-400 font-bold">
                {artistB.roundsWon} Wins
              </span>
            </button>
          </div>
        </div>

        {!isBattleEnded && phase !== "round_intro" && (
          <BattleMediaStage
            activeArtistUserId={battle.coordination?.activeArtistUserId}
            artists={battle.artists}
            audioDeviceId={mediaDeviceSelection?.audioDeviceId}
            className="absolute inset-0 z-10 rounded-none border-0 bg-transparent"
            experienceId={id}
            videoDeviceId={mediaDeviceSelection?.videoDeviceId}
            phase={phase}
            showHeader={false}
            viewerOnly={!isAdmin && !isArtist}
          />
        )}

        {currentTrack && (
          <div className="absolute bottom-4 left-4 right-4 z-20 flex items-center justify-between rounded-xl border border-white/10 bg-black/75 px-4 py-2.5 backdrop-blur-md">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                {isBattleEnded ? "Final track" : "Now Performing Track"}
              </p>
              <p className="truncate font-semibold text-white text-sm">
                {currentTrack.title} — {currentTrack.artistName}
              </p>
            </div>
          </div>
        )}
      </div>
    );

  return (
    <LiveRoomAccessGuard
      allowPublic={artistView || isArtist || isAdmin}
      roomTitle={room.title}
    >
      <LiveTwitchShell
        chatPanel={chatPanel}
        defaultChatOpen={true}
        isChatOpen={isChatOpen}
        onChatOpenChange={setIsChatOpen}
        videoNode={videoNode}
      >
        <div className="space-y-4 pt-4">
          {/* Battle Header Strip directly under video */}
          <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/60 p-4 sm:flex-row sm:items-center sm:justify-between shadow-sm">
            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bold text-lg sm:text-xl text-foreground truncate">
                  {room.title}
                </h2>
                <Badge
                  className="text-[10px] font-bold"
                  variant={isBattleEnded ? "secondary" : "destructive"}
                >
                  {isBattleEnded ? "ENDED" : "LIVE"}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  Trap / Boom Bap
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  SoundKit Battle League
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                <button
                  className="font-semibold text-foreground hover:text-primary transition-colors cursor-pointer"
                  onClick={() =>
                    setPreviewUser({
                      avatarUrl: artistA.avatarUrl,
                      displayName: artistA.name,
                      followersCount: 1450,
                      role: "Battle Contender",
                      username: artistA.name
                        .toLowerCase()
                        .replaceAll(/\s+/g, ""),
                      verified: artistA.verified,
                    })
                  }
                  type="button"
                >
                  {artistNameWithRank(artistA)}
                </button>{" "}
                vs{" "}
                <button
                  className="font-semibold text-foreground hover:text-primary transition-colors cursor-pointer"
                  onClick={() =>
                    setPreviewUser({
                      avatarUrl: artistB.avatarUrl,
                      displayName: artistB.name,
                      followersCount: 1820,
                      role: "Battle Contender",
                      username: artistB.name
                        .toLowerCase()
                        .replaceAll(/\s+/g, ""),
                      verified: artistB.verified,
                    })
                  }
                  type="button"
                >
                  {artistNameWithRank(artistB)}
                </button>{" "}
                • Click artist to view profile
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Badge
                variant="outline"
                className="gap-1.5 py-1 px-2.5 text-xs font-mono"
              >
                <Radio className="size-3 text-destructive animate-pulse" />
                {room.viewerCount.toLocaleString()} Viewers
              </Badge>
              {isBattleEnded ? (
                <Badge
                  variant="secondary"
                  className="gap-1.5 py-1 px-2.5 text-xs"
                >
                  <Trophy className="size-3.5" />
                  Read-only result
                </Badge>
              ) : isArtist || isAdmin ? (
                <Badge
                  variant="secondary"
                  className="gap-1.5 py-1 px-2.5 text-xs"
                >
                  <Swords className="size-3.5" />
                  Artist room
                </Badge>
              ) : isQueued ? (
                <Badge
                  variant="secondary"
                  className="gap-1.5 py-1 px-2.5 text-xs"
                >
                  <ListPlus className="size-3.5" />
                  In Queue
                </Badge>
              ) : null}
              {isAdmitted && !isArtist && !isAdmin ? (
                <Button
                  className="gap-1.5 text-xs"
                  disabled={leave.isPending}
                  onClick={() => leave.mutate()}
                  size="sm"
                  variant="outline"
                >
                  <LogOut className="size-3.5" />
                  Leave
                </Button>
              ) : (
                !isBattleEnded &&
                !isArtist &&
                !isAdmin &&
                !isQueued && (
                  <Button
                    className="gap-1.5 text-xs"
                    disabled={queue.isPending}
                    onClick={handleJoinQueue}
                    size="sm"
                  >
                    <ListPlus className="size-3.5" />
                    Join Queue
                  </Button>
                )
              )}
              <Button
                className="gap-1.5 text-xs"
                onClick={handleToggleFollow}
                size="sm"
                variant={isFollowingBattle ? "secondary" : "default"}
              >
                {isFollowingBattle ? (
                  <>
                    <UserCheck className="size-3.5" />
                    Following
                  </>
                ) : (
                  <>
                    <Heart className="size-3.5" />
                    Follow
                  </>
                )}
              </Button>
              <Button
                className="gap-1.5 text-xs"
                onClick={handleShareBattle}
                size="sm"
                variant="outline"
              >
                <Share2 className="size-3.5" />
                Share
              </Button>
            </div>
          </div>

          {/* Consolidated Arena Scoreboard & Side-by-Side Voting Box */}
          <Card className="border-primary/40 bg-card/90 shadow-xl overflow-hidden">
            {/* Header Scoreboard */}
            <div className="flex flex-wrap items-center justify-between border-b border-border/60 bg-muted/40 px-4 py-3 gap-2">
              <div className="flex items-center gap-2">
                <Trophy className="size-4.5 text-amber-400" />
                <div>
                  <span className="font-bold text-sm">Match Scoreboard</span>
                  <p className="text-[11px] text-muted-foreground">
                    Round {currentRound.number}{" "}
                    {currentRound.isTiebreaker ? "(Tiebreaker)" : ""} • Best of
                    3
                  </p>
                </div>
              </div>

              {/* Center Match Score Display */}
              <div className="flex items-center gap-2 rounded-lg border bg-background/80 px-3 py-1 shadow-sm text-xs">
                <span className="font-bold text-foreground truncate max-w-[80px]">
                  {artistA.name}
                </span>
                <span className="rounded bg-primary/20 px-2 py-0.5 font-mono text-sm font-black text-primary">
                  {artistA.roundsWon}
                </span>
                <span className="font-bold text-muted-foreground text-[10px]">
                  VS
                </span>
                <span className="rounded bg-secondary/20 px-2 py-0.5 font-mono text-sm font-black text-secondary-foreground">
                  {artistB.roundsWon}
                </span>
                <span className="font-bold text-foreground truncate max-w-[80px]">
                  {artistB.name}
                </span>
              </div>

              <Badge
                className="text-[11px]"
                variant={
                  isBattleEnded
                    ? "secondary"
                    : currentRound.status === "voting"
                      ? "default"
                      : "secondary"
                }
              >
                {isBattleEnded
                  ? "Battle Ended"
                  : currentRound.status === "voting"
                    ? "Voting Open"
                    : "Turn Live"}
              </Badge>
            </div>

            {/* Side-by-side Artist Turn & Voting Strips (2 Columns on mobile & desktop) */}
            <CardContent className="p-3 sm:p-5 space-y-4">
              <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
                {battle.artists.map((artist) => {
                  const percent = votePercent(currentRound, artist.id),
                    isActive = !isBattleEnded && !artist.isMuted;

                  return (
                    <div
                      className={`space-y-2 sm:space-y-3 rounded-xl border p-2.5 sm:p-4 transition-all ${
                        isActive
                          ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/30"
                          : "border-border/60 bg-background/50"
                      }`}
                      key={artist.id}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                        <button
                          className="flex items-center gap-2 min-w-0 text-left cursor-pointer transition-transform hover:scale-[1.02]"
                          onClick={() =>
                            setPreviewUser({
                              avatarUrl: artist.avatarUrl,
                              displayName: artist.name,
                              followersCount: 1450,
                              role: "Battle Contender",
                              username: artist.name
                                .toLowerCase()
                                .replaceAll(/\s+/g, ""),
                              verified: artist.verified,
                            })
                          }
                          type="button"
                        >
                          <Avatar className="size-8 sm:size-10 border shrink-0">
                            <AvatarImage src={artist.avatarUrl} />
                            <AvatarFallback className="text-xs">
                              {artist.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1">
                              <p className="font-bold text-xs sm:text-sm truncate">
                                {artist.name}
                              </p>
                              {artist.verified && (
                                <CheckCircle2 className="size-3 text-primary shrink-0" />
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {artist.roundsWon} Won
                            </p>
                          </div>
                        </button>

                        <Badge
                          className="text-[9px] sm:text-[10px] px-1.5 py-0 self-start sm:self-center shrink-0"
                          variant={
                            isBattleEnded
                              ? "outline"
                              : isActive
                                ? "default"
                                : "outline"
                          }
                        >
                          {isBattleEnded ? (
                            <>
                              <MicOff className="mr-1 size-2.5" />
                              Battle ended
                            </>
                          ) : isActive ? (
                            <>
                              <Mic className="mr-1 size-2.5" />
                              Turn
                            </>
                          ) : (
                            <>
                              <MicOff className="mr-1 size-2.5" />
                              Muted until turn
                            </>
                          )}
                        </Badge>
                      </div>

                      <div className="space-y-1 pt-0.5">
                        <div className="flex items-center justify-between text-[10px] sm:text-xs">
                          <span className="text-muted-foreground">Votes</span>
                          <span className="font-mono font-bold text-primary">
                            {percent}% (
                            {(
                              currentRound.voteTotals[artist.id] ?? 0
                            ).toLocaleString()}
                            )
                          </span>
                        </div>
                        <Progress className="h-1.5 sm:h-2" value={percent} />
                      </div>

                      <Button
                        className="w-full text-xs h-8 sm:h-9"
                        disabled={
                          isBattleEnded ||
                          currentRound.status !== "voting" ||
                          vote.isPending
                        }
                        onClick={() =>
                          vote.mutate({
                            artistId: artist.id,
                            roundId: currentRound.id,
                          })
                        }
                        size="sm"
                      >
                        Vote {artist.name}
                      </Button>
                    </div>
                  );
                })}
              </div>

              {currentRound.winnerArtistId && (
                <WinnerBanner
                  artist={battle.artists.find(
                    (a) => a.id === currentRound.winnerArtistId
                  )}
                  isTie={currentRound.isTiebreaker}
                />
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/70">
            <CardContent className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Round votes
                </p>
                <p className="mt-1 font-mono font-bold text-sm">
                  {voteTotal(currentRound).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Viewers
                </p>
                <p className="mt-1 font-mono font-bold text-sm">
                  {room.viewerCount.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Queue
                </p>
                <p className="mt-1 font-mono font-bold text-sm">
                  {(battle.queueSize ?? 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Battle phase
                </p>
                <p className="mt-1 truncate font-semibold text-sm">
                  {(phase ?? "unknown").replaceAll("_", " ")}
                </p>
              </div>
            </CardContent>
          </Card>

          {isBattleEnded && (
            <Card
              className={
                battle.outcome
                  ? "border-purple-400/40 bg-purple-500/10"
                  : "border-amber-400/40 bg-amber-500/10"
              }
            >
              <CardContent className="flex items-start gap-3 p-4">
                <Swords className="mt-0.5 size-5 shrink-0 text-amber-300" />
                <div>
                  <p className="font-semibold text-sm">
                    {battle.outcome?.kind === "ducked"
                      ? "Battle ended: opponent ducked"
                      : battle.outcome?.kind === "forfeited"
                        ? "Battle ended by forfeit"
                        : battle.outcome?.kind === "quit"
                          ? "Battle ended by quit"
                          : battle.outcome?.kind === "canceled"
                            ? "Battle canceled"
                            : isBattleTie
                              ? "Battle ended in a tie"
                              : battleWinner
                                ? `${battleWinner.name} won the battle`
                                : "Battle complete"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {battle.outcome
                      ? "The room is closed. No new turns, votes, or lineup changes are available."
                      : isBattleTie
                        ? "The final score stayed even. The result is locked and this room is now read-only."
                        : "The final result is locked. This room is now read-only."}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <BattleLifecycleControls
            artists={battle.artists}
            currentUserId={session?.user?.id}
            isAdmin={isAdmin}
            isArtist={isArtist}
            onDisposition={handleBattleDisposition}
            pending={battleReady.isPending || battleDisposition.isPending}
            phase={phase ?? "waiting_room"}
            readyArtistUserIds={readyArtistUserIds}
            roundNumber={battle.coordination?.roundNumber}
          />

          {artistRole && !isBattleEnded && (
            <BattleArtistControlPanel
              artistId={
                artistRole === "artist_a"
                  ? battle.artists[0].id
                  : battle.artists[1].id
              }
              battle={battle}
              currentTrackId={room.currentTrackId}
              onSelectTrack={(trackId) => battleTrack.mutate({ trackId })}
              pending={battleTrack.isPending}
            />
          )}
        </div>
      </LiveTwitchShell>

      <UserProfilePreviewModal
        onClose={() => setPreviewUser(null)}
        open={Boolean(previewUser)}
        user={previewUser}
      />
      {battleLeaveDialog}
    </LiveRoomAccessGuard>
  );
}
