"use client";
/* eslint-disable complexity, no-unused-vars, sort-vars, one-var, require-unicode-regexp, unicorn/consistent-function-scoping */

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
  Radio,
  RefreshCw,
  Share2,
  Swords,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

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

const voteTotal = (round: LiveBattleRound) =>
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
        alt={artistView ? "Artist battle waiting room" : "Upcoming battle"}
        className="absolute inset-0 size-full object-cover opacity-25"
        height={720}
        src={
          artistView
            ? "/music-battle-live-performance-video.jpg"
            : "/soundkit-default-banner.svg"
        }
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
            <Avatar className="size-16 border-2 border-primary ring-4 ring-primary/20 shadow-xl sm:size-20">
              <AvatarImage src={artistA.avatarUrl} />
              <AvatarFallback className="text-lg font-bold">
                {artistA.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <p className="max-w-[120px] truncate text-sm font-bold text-white sm:text-base">
              {artistA.name}
            </p>
          </div>
          <div className="rounded-full bg-destructive/90 p-3 text-white shadow-lg">
            <Swords className="size-6 sm:size-8" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <Avatar className="size-16 border-2 border-secondary ring-4 ring-secondary/20 shadow-xl sm:size-20">
              <AvatarImage src={artistB.avatarUrl} />
              <AvatarFallback className="text-lg font-bold">
                {artistB.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <p className="max-w-[120px] truncate text-sm font-bold text-white sm:text-base">
              {artistB.name}
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

const artistForfeitPhases = new Set([
  "artist_a_turn",
  "artist_b_turn",
  "between_rounds",
  "pre_vote",
  "round_result",
  "turn_transition",
  "tiebreaker_a",
  "tiebreaker_b",
  "tiebreaker_transition",
  "voting",
  "tiebreaker_voting",
]);

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

interface BattleMediaDeviceSelection {
  audioDeviceId: string;
  videoDeviceId: string;
}

function BattleStartStatus({
  artists,
  phase,
  phaseEndsAt,
  readyArtistUserIds,
  serverNow,
}: {
  artists: [LiveRoomArtist, LiveRoomArtist];
  phase?: string;
  phaseEndsAt: number | null | undefined;
  readyArtistUserIds: string[];
  serverNow?: number;
}) {
  const allArtistsReady = readyArtistUserIds.length >= artists.length,
    timerLabel = phase === "scheduled" ? "Battle opens in" : "Battle starts in";

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
          {allArtistsReady ? "Ready" : `${readyArtistUserIds.length}/2 ready`}
        </Badge>
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-1.5">
        {artists.map((artist) => {
          const isReady = readyArtistUserIds.includes(artist.id);
          return (
            <Badge
              className="max-w-44 gap-1.5 truncate text-[10px]"
              key={artist.id}
              variant={isReady ? "secondary" : "outline"}
            >
              {isReady ? (
                <CheckCircle2 className="size-3 text-emerald-400" />
              ) : (
                <span className="size-1.5 rounded-full bg-muted-foreground/50" />
              )}
              {artist.name} · {isReady ? "Ready" : "Preparing"}
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
    previewRef = useRef<HTMLVideoElement | null>(null);

  const refreshDevices = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return;
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    setVideoDevices(devices.filter((device) => device.kind === "videoinput"));
    setAudioDevices(devices.filter((device) => device.kind === "audioinput"));
  };

  const requestPermissions = async (
    videoDeviceId = selectedVideoDeviceId,
    audioDeviceId = selectedAudioDeviceId
  ) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser does not provide camera and microphone access.");
      setMediaStatus("error");
      return;
    }

    setMediaStatus("requesting");
    setError(null);
    setSaved(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true,
        video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : true,
      });
      setMediaStream(stream);
      await refreshDevices();
      const devices = await navigator.mediaDevices.enumerateDevices(),
        nextVideoDevice =
          videoDeviceId ||
          devices.find((device) => device.kind === "videoinput")?.deviceId ||
          "",
        nextAudioDevice =
          audioDeviceId ||
          devices.find((device) => device.kind === "audioinput")?.deviceId ||
          "";
      setSelectedVideoDeviceId(nextVideoDevice);
      setSelectedAudioDeviceId(nextAudioDevice);
      setMediaStatus("ready");
    } catch (permissionError) {
      setMediaStatus("error");
      setError(
        permissionError instanceof DOMException &&
          permissionError.name === "NotAllowedError"
          ? "Allow camera and microphone access to continue."
          : "We could not access the selected camera and microphone."
      );
    }
  };

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
    const {mediaDevices} = navigator;
    if (!mediaDevices) {
      return;
    }

    const handleDeviceChange = () => {
      void refreshDevices();
    };
    mediaDevices.addEventListener("devicechange", handleDeviceChange);
    return () =>
      mediaDevices.removeEventListener("devicechange", handleDeviceChange);
  }, []);

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

    onSaved({
      audioDeviceId: selectedAudioDeviceId,
      videoDeviceId: selectedVideoDeviceId,
    });
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
          disabled={mediaStatus !== "ready"}
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
          disabled={mediaStatus !== "ready"}
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
            ? "Microphone access granted. Save this setup when both devices are correct."
            : "Camera and microphone permissions are requested together."}
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
    };

  return (
    <Card className="border-primary/30 bg-primary/5 shadow-sm">
      <CardHeader className="gap-2 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 rounded-md bg-primary/15 p-2 text-primary">
              <Disc3 className="size-4" />
            </div>
            <div>
              <CardTitle className="text-sm">
                Prepare your battle lineup
              </CardTitle>
              <CardDescription className="mt-1 text-xs">
                {formatDetails.label} · {formatDetails.rounds}. Choose a
                battle-ready kit before the room opens.
              </CardDescription>
            </div>
          </div>
          <Badge
            className="gap-1.5 text-[10px]"
            variant={isLocked ? "default" : "outline"}
          >
            {isLocked ? (
              <LockKeyhole className="size-3" />
            ) : (
              <Swords className="size-3" />
            )}
            {isLocked ? "Kit locked" : "Artist only"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
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
            onClick={() => void onReady(!isReady)}
            size="sm"
            type="button"
            variant={isReady ? "secondary" : "default"}
          >
            <CheckCircle2 className="size-3.5" />
            {isReady ? "Not ready" : "I’m ready"}
          </Button>
        </div>

        {saveError && <p className="text-xs text-destructive">{saveError}</p>}
      </CardContent>
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
    canonicalRoomId = battle?.coordination?.battleId ?? id,
    isAdmin = room?.role === "admin",
    isScheduled =
      room?.status === "upcoming" ||
      phase === "scheduled" ||
      phase === "waiting_room",
    viewerQueueStatus = battle?.viewerQueueStatus ?? null,
    isAdmitted = viewerQueueStatus === "admitted",
    isArtist = Boolean(room?.role === "artist_a" || room?.role === "artist_b"),
    isArtistForfeitPhase = isArtist && artistForfeitPhases.has(phase ?? ""),
    isQueued =
      viewerQueueStatus === "queued" || viewerQueueStatus === "waiting",
    readyArtistUserIds = battle?.coordination?.artistReadyUserIds ?? [],
    isBattleTie = Boolean(
      battle &&
      !battle.outcome &&
      !battle.coordination?.winnerUserId &&
      (phase === "battle_result" || phase === "ended")
    ),
    lockedBattleKitId =
      battle?.artistControls?.selectedKitId ?? selectedBattleKitId,
    currentRound = battle?.rounds.find(
      (round) => round.id === battle.currentRoundId
    ),
    currentTrack = room?.tracklist.find(
      (track) => track.id === room.currentTrackId
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
      shouldBlock:
        Boolean(currentRound) &&
        (isAdmitted || isArtistForfeitPhase) &&
        !(isArtist && (phase === "scheduled" || phase === "waiting_room")),
    });

  const currentArtistId =
      room?.role === "artist_a"
        ? battle?.artists[0]?.id
        : room?.role === "artist_b"
          ? battle?.artists[1]?.id
          : null,
    currentArtistReady = Boolean(
      isArtist && currentArtistId && readyArtistUserIds.includes(currentArtistId)
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
    if (
      artistView ||
      !isArtist ||
      !battle ||
      room?.status === "ended" ||
      phase === "ended"
    ) {
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
    phase,
    room?.status,
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
            <CardTitle>Artist room access required</CardTitle>
            <CardDescription>
              This route is reserved for the two artists assigned to this
              battle. Join the public room as a viewer instead.
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

  if (isScheduled || !currentRound) {
    return (
      <LiveRoomAccessGuard
        allowPublic={artistView || isScheduled || isArtist || isAdmin}
        roomTitle={room.title}
      >
        <LiveTwitchShell
          chatPanel={
            <LiveChatPanel
              artistUserIds={battle.artists.map((artist) => artist.id)}
              disabled={chat.isPending}
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
                  <div className="flex items-center gap-2">
                    <CalendarClock className="size-4.5 text-primary" />
                    <div>
                      <CardTitle className="text-sm">{room.title}</CardTitle>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {artistA.name} vs {artistB.name}
                      </p>
                    </div>
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
                  ) : (isQueued ? (
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
                  ))}
                </div>
                {(room.role === "artist_a" || room.role === "artist_b") &&
                  battle.coordination?.format && (
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
                  hasSelectedKit={Boolean(lockedBattleKitId)}
                  isAdmin={isAdmin}
                  isArtist={isArtist}
                  isReady={currentArtistReady}
                  onDisposition={handleBattleDisposition}
                  onReady={async (ready) => {
                    await battleReady.mutateAsync({ ready });
                  }}
                  pending={battleReady.isPending || battleDisposition.isPending}
                  phase={phase ?? "waiting_room"}
                  readyArtistUserIds={readyArtistUserIds}
                  roundNumber={battle.coordination?.roundNumber}
                />
                <p className="text-xs text-muted-foreground">
                  {artistView
                    ? "Your artist seat stays connected while BattleBot prepares the stage."
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
                  hasSelectedKit={Boolean(lockedBattleKitId)}
                  isAdmin={isAdmin}
                  isArtist={isArtist}
                  isReady={currentArtistReady}
                  onDisposition={handleBattleDisposition}
                  onReady={async (ready) => {
                    await battleReady.mutateAsync({ ready });
                  }}
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
        artistUserIds={battle.artists.map((artist) => artist.id)}
        disabled={chat.isPending}
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
            <Badge className="bg-black/60 backdrop-blur-md" variant="outline">
              Status: {currentRound.status.toUpperCase()}
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
            <BattleTimer
              phaseEndsAt={battle.coordination?.phaseEndsAt}
              serverNow={room.serverNow}
              label={battle.coordination?.phase ?? "Round"}
            />
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
              <Avatar className="size-16 sm:size-20 border-2 border-primary ring-4 ring-primary/20 shadow-xl">
                <AvatarImage src={artistA.avatarUrl} />
                <AvatarFallback className="font-bold text-lg">
                  {artistA.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <p className="font-bold text-sm sm:text-base text-white truncate max-w-[120px]">
                {artistA.name}
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
              <Avatar className="size-16 sm:size-20 border-2 border-secondary ring-4 ring-secondary/20 shadow-xl">
                <AvatarImage src={artistB.avatarUrl} />
                <AvatarFallback className="font-bold text-lg">
                  {artistB.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <p className="font-bold text-sm sm:text-base text-white truncate max-w-[120px]">
                {artistB.name}
              </p>
              <span className="text-xs text-amber-400 font-bold">
                {artistB.roundsWon} Wins
              </span>
            </button>
          </div>
        </div>

        {phase !== "ended" && (
          <BattleMediaStage
            activeArtistUserId={battle.coordination?.activeArtistUserId}
            artists={battle.artists}
            audioDeviceId={mediaDeviceSelection?.audioDeviceId}
            className="absolute inset-0 z-10 rounded-none border-0 bg-transparent"
            experienceId={id}
            videoDeviceId={mediaDeviceSelection?.videoDeviceId}
            phase={phase}
            showHeader={false}
            viewerOnly={
              room.role !== "admin" &&
              room.role !== "artist_a" &&
              room.role !== "artist_b"
            }
          />
        )}

        {currentTrack && (
          <div className="absolute bottom-4 left-4 right-4 z-20 flex items-center justify-between rounded-xl border border-white/10 bg-black/75 px-4 py-2.5 backdrop-blur-md">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                Now Performing Track
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
                <Badge className="bg-destructive text-destructive-foreground text-[10px] font-bold">
                  LIVE
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
                  {artistA.name}
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
                  {artistB.name}
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
              {isArtist || isAdmin ? (
                <Badge
                  variant="secondary"
                  className="gap-1.5 py-1 px-2.5 text-xs"
                >
                  <Swords className="size-3.5" />
                  Artist room
                </Badge>
              ) : (isQueued ? (
                <Badge
                  variant="secondary"
                  className="gap-1.5 py-1 px-2.5 text-xs"
                >
                  <ListPlus className="size-3.5" />
                  In Queue
                </Badge>
              ) : null)}
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
                  currentRound.status === "voting" ? "default" : "secondary"
                }
              >
                {currentRound.status === "voting" ? "Voting Open" : "Turn Live"}
              </Badge>
            </div>

            {/* Side-by-side Artist Turn & Voting Strips (2 Columns on mobile & desktop) */}
            <CardContent className="p-3 sm:p-5 space-y-4">
              <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
                {battle.artists.map((artist) => {
                  const percent = votePercent(currentRound, artist.id),
                    isActive = !artist.isMuted;

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
                          variant={isActive ? "default" : "outline"}
                        >
                          {isActive ? (
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
                          currentRound.status !== "voting" || vote.isPending
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

          {isBattleTie && (
            <Card className="border-amber-400/40 bg-amber-500/10">
              <CardContent className="flex items-start gap-3 p-4">
                <Swords className="mt-0.5 size-5 shrink-0 text-amber-300" />
                <div>
                  <p className="font-semibold text-sm">Battle ended in a tie</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    The final score stayed even. This result is shown in your
                    participation history and does not change ratings.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {battle.outcome && (
            <Card className="border-purple-400/40 bg-purple-500/10">
              <CardContent className="flex items-start gap-3 p-4">
                <Swords className="mt-0.5 size-5 shrink-0 text-purple-300" />
                <div>
                  <p className="font-semibold text-sm">
                    {battle.outcome.kind === "ducked"
                      ? "Battle ended: opponent ducked"
                      : battle.outcome.kind === "forfeited"
                        ? "Battle ended by forfeit"
                        : battle.outcome.kind === "quit"
                          ? "Battle ended by quit"
                          : "Battle canceled"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    This outcome did not change battle ratings.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <BattleLifecycleControls
            artists={battle.artists}
            currentUserId={session?.user?.id}
            hasSelectedKit={Boolean(lockedBattleKitId)}
            isAdmin={room.role === "admin"}
            isArtist={isArtist}
            isReady={Boolean(
              readyArtistUserIds.includes(
                room.role === "artist_a"
                  ? battle.artists[0].id
                  : battle.artists[1].id
              )
            )}
            onDisposition={handleBattleDisposition}
            onReady={async (ready) => {
              await battleReady.mutateAsync({ ready });
            }}
            pending={battleReady.isPending || battleDisposition.isPending}
            phase={phase ?? "waiting_room"}
            readyArtistUserIds={readyArtistUserIds}
            roundNumber={battle.coordination?.roundNumber}
          />

          {(room.role === "artist_a" || room.role === "artist_b") && (
            <BattleArtistControlPanel
              artistId={
                room.role === "artist_a"
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
