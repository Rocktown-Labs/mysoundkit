"use client";
/* eslint-disable complexity, no-unused-vars, sort-vars, one-var, promise/prefer-await-to-then */

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bot,
  Camera,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  LoaderCircle,
  Link2,
  MessageSquare,
  Mic,
  MonitorUp,
  Music2,
  Radio,
  RefreshCcw,
  Trash2,
  Tv,
  Users,
  Video,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useAudioPlayer } from "@/components/audio-player-provider";
import { LiveExperienceAuthGuard } from "@/components/dashboard/live-experience-auth-guard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AppImage } from "@/components/ui/app-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { SoundKitApiError, apiClient } from "@/lib/api";
import { liveExperienceConfigs } from "@/lib/live-experience";
import type { LiveScheduleMode } from "@/lib/live-experience";
import { useLiveRoom } from "@/lib/live-room";
import { musicGenres } from "@/lib/music-genres";
import {
  useCreateLiveExperienceMutation,
  useCreateLiveOverlayTokenMutation,
  useDeleteLiveExperienceMutation,
  useGenresQuery,
  useLiveReviewCatalogQuery,
  useMyLiveExperiencesQuery,
  useSetLiveNowPlayingMutation,
  useSetStreamBotMutation,
  useVideosQuery,
} from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/live/streams")({
  component: DashboardLiveStreamsPage,
});

type SetupStep = "details" | "device" | "ready";
type StreamSource = "browser" | "obs";

interface ActiveStream {
  description: string;
  errorMessage?: string | null;
  experienceId: string;
  genre: string;
  id: string;
  ingestStatus?: string;
  playbackUrl: string;
  realtimeMeetingId: string;
  roomHref: string;
  rtmpsKey: string;
  rtmpsUrl: string;
  scheduleMode: LiveScheduleMode;
  source: StreamSource;
  srtKey: string;
  srtUrl: string;
  status: string;
  title: string;
  visibility: string;
}

const visibilityOptions = ["Public", "Unlisted", "Private"];

function readSavedStream() {
  if (typeof window === "undefined") {
    return null;
  }

  const saved = localStorage.getItem("soundkit_active_creator_stream");
  return saved ? (JSON.parse(saved) as ActiveStream) : null;
}

function readableStreamStatus(value: unknown): string {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (
    value &&
    typeof value === "object" &&
    "state" in value &&
    typeof value.state === "string" &&
    value.state.trim()
  ) {
    return value.state;
  }

  return "unknown";
}

function normalizeStreamIngestStatus(value: unknown): string {
  const status = readableStreamStatus(value);

  if (status === "connected" || status === "reconnected") {
    return "connected";
  }

  if (status === "reconnecting") {
    return "reconnecting";
  }

  return status;
}

function DashboardLiveStreamsPage() {
  const genresQuery = useGenresQuery(),
    videosQuery = useVideosQuery(),
    createLiveExperience = useCreateLiveExperienceMutation(),
    myExperiencesQuery = useMyLiveExperiencesQuery(),
    deleteExperience = useDeleteLiveExperienceMutation(),
    videos = videosQuery.data ?? [],
    liveRecordings = videos.filter(
      (video) => video.videoKind === "live_recording"
    ),
    processingVideos = videos.filter((video) => video.status === "processing"),
    streamConfig = liveExperienceConfigs.stream,
    [setupStep, setSetupStep] = useState<SetupStep>("details"),
    [streamTitle, setStreamTitle] = useState(""),
    [description, setDescription] = useState(""),
    genreOptions =
      genresQuery.data && genresQuery.data.length > 0
        ? genresQuery.data.map((genre) => genre.name)
        : musicGenres.map((genre) => genre.label),
    [genre, setGenre] = useState(genreOptions[0] ?? "Hip-Hop/Rap"),
    [visibility, setVisibility] = useState("Public"),
    [scheduleMode, setScheduleMode] = useState<LiveScheduleMode>("asap"),
    [source, setSource] = useState<StreamSource>("obs"),
    [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]),
    [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]),
    [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState<string>(""),
    [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string>(""),
    [hasMediaPermissions, setHasMediaPermissions] = useState<boolean | null>(
      null
    ),
    [mediaStream, setMediaStream] = useState<MediaStream | null>(null),
    cameraPreviewRef = useRef<HTMLVideoElement | null>(null),
    [activeStream, setActiveStream] = useState<ActiveStream | null>(() => {
      const saved = readSavedStream();
      return saved?.experienceId ? saved : null;
    }),
    [isRefreshing, setIsRefreshing] = useState(false),
    [showStreamKey, setShowStreamKey] = useState(false),
    [copiedField, setCopiedField] = useState<string | null>(null),
    canCreate = streamTitle.trim().length > 0,
    isCreatingStream = createLiveExperience.isPending,
    handleDeleteExperience = async (id: string) => {
      try {
        await deleteExperience.mutateAsync(id);
        if (activeStream?.experienceId === id) {
          setActiveStream(null);
          localStorage.removeItem("soundkit_active_creator_stream");
        }
        toast({
          description: "Live stream room removed.",
          title: "Stream deleted",
        });
      } catch {
        toast({
          description: "Failed to delete stream room. Please try again.",
          title: "Delete failed",
          variant: "destructive",
        });
      }
    },
    requestMediaPermissions = async (
      videoDeviceId?: string,
      audioDeviceId?: string
    ) => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setHasMediaPermissions(false);
          return;
        }
        if (mediaStream) {
          for (const track of mediaStream.getTracks()) {
            track.stop();
          }
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true,
          video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : true,
        });
        setMediaStream(stream);
        setHasMediaPermissions(true);

        const devices = await navigator.mediaDevices.enumerateDevices(),
          vDevs = devices.filter((d) => d.kind === "videoinput"),
          aDevs = devices.filter((d) => d.kind === "audioinput");
        setVideoDevices(vDevs);
        setAudioDevices(aDevs);
        if (vDevs[0] && !selectedVideoDeviceId) {
          setSelectedVideoDeviceId(videoDeviceId || vDevs[0].deviceId);
        }
        if (aDevs[0] && !selectedAudioDeviceId) {
          setSelectedAudioDeviceId(audioDeviceId || aDevs[0].deviceId);
        }
      } catch {
        setHasMediaPermissions(false);
      }
    },
    handleVideoDeviceChange = (deviceId: string) => {
      setSelectedVideoDeviceId(deviceId);
      requestMediaPermissions(deviceId, selectedAudioDeviceId || undefined);
    },
    handleAudioDeviceChange = (deviceId: string) => {
      setSelectedAudioDeviceId(deviceId);
      requestMediaPermissions(selectedVideoDeviceId || undefined, deviceId);
    },
    handleStartStream = async () => {
      try {
        const created = await createLiveExperience.mutateAsync({
            description,
            genre,
            kind: "stream",
            scheduleMode,
            source,
            title: streamTitle.trim() || "My Live Stream",
            visibility: visibility.toLowerCase() as
              | "private"
              | "public"
              | "unlisted",
          }),
          stream =
            created.streamInput ??
            ({
              experienceId: created.experience.id,
              id: created.realtime.id,
              playbackUrl: "",
              rtmpsKey: "",
              rtmpsUrl: "",
              srtKey: "",
              srtUrl: "",
              status: created.experience.status,
              title: created.experience.title,
            } satisfies Pick<
              ActiveStream,
              | "experienceId"
              | "id"
              | "playbackUrl"
              | "rtmpsKey"
              | "rtmpsUrl"
              | "srtKey"
              | "srtUrl"
              | "status"
              | "title"
            >),
          nextStream: ActiveStream = {
            ...stream,
            description,
            errorMessage: null,
            experienceId: created.experience.id,
            genre,
            ingestStatus:
              typeof created.experience.ingestStatus === "string"
                ? created.experience.ingestStatus
                : undefined,
            realtimeMeetingId: created.realtime.id,
            roomHref: created.experience.roomHref,
            scheduleMode,
            source,
            visibility,
          };
        setActiveStream(nextStream);
        localStorage.setItem(
          "soundkit_active_creator_stream",
          JSON.stringify(nextStream)
        );
        setSetupStep("ready");
        toast({
          description: "Stream room, chat, and encoder credentials are ready.",
          title: "Live stream created",
        });
      } catch (error) {
        const errorDescription =
          error instanceof SoundKitApiError
            ? error.message
            : "Could not create the live stream room. Please try again.";
        toast({
          description: errorDescription,
          title: "Error starting stream",
          variant: "destructive",
        });
      }
    },
    handleRefreshStream = async () => {
      if (!activeStream) {
        return;
      }
      setIsRefreshing(true);
      try {
        const res = await apiClient.v1.live["cloudflare-stream"][
          ":streamId"
        ].$get({
          param: { streamId: activeStream.id },
        });
        if (res.ok) {
          const stream = await res.json(),
            status = readableStreamStatus(stream.status),
            updated = {
              ...activeStream,
              ingestStatus: normalizeStreamIngestStatus(status),
              status,
            };
          setActiveStream(updated);
          localStorage.setItem(
            "soundkit_active_creator_stream",
            JSON.stringify(updated)
          );
          toast({
            description: `Current connection state: ${status}`,
            title: "Stream status updated",
          });
        }
      } catch {
        // Status refresh is optional
      } finally {
        setIsRefreshing(false);
      }
    },
    activeStreamId = activeStream?.id;

  useEffect(() => {
    if (!(activeStreamId && source === "obs")) {
      return;
    }

    const refreshTimer = window.setInterval(() => {
      void (async () => {
        const response = await apiClient.v1.live["cloudflare-stream"][
          ":streamId"
        ].$get({
          param: { streamId: activeStreamId },
        });
        if (!response.ok) {
          return;
        }

        const stream = await response.json(),
          status = readableStreamStatus(stream.status);
        setActiveStream((current) => {
          if (!current) {
            return current;
          }
          const updated = {
            ...current,
            ingestStatus: normalizeStreamIngestStatus(status),
            status,
          };
          localStorage.setItem(
            "soundkit_active_creator_stream",
            JSON.stringify(updated)
          );
          return updated;
        });
      })().catch(() => {
        // Status polling is best effort; the manual refresh remains available.
      });
    }, 5000);

    return () => window.clearInterval(refreshTimer);
  }, [activeStreamId, source]);

  const handleEndStream = async () => {
      if (activeStream?.source === "obs") {
        try {
          const response = await apiClient.v1.live["cloudflare-stream"][
            ":streamId"
          ].$delete({
            param: { streamId: activeStream.id },
          });
          if (!response.ok) {
            throw new Error(`Unable to stop stream: ${response.status}`);
          }
        } catch {
          toast({
            description:
              "The local stream was cleared, but Cloudflare could not be stopped. Refresh the status and try again.",
            title: "Stream stop incomplete",
            variant: "destructive",
          });
        }
      }

      setActiveStream(null);
      localStorage.removeItem("soundkit_active_creator_stream");
      toast({
        description: "Live broadcast input cleared.",
        title: "Stream Ended",
      });
    },
    copyToClipboard = async (text: string, field: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopiedField(field);
        toast({
          description: `${field} copied to clipboard.`,
          title: "Copied",
        });
        setTimeout(() => setCopiedField(null), 2000);
      } catch {
        toast({
          description: "Clipboard access is unavailable in this browser.",
          title: "Copy unavailable",
          variant: "destructive",
        });
      }
    };

  return (
    <LiveExperienceAuthGuard
      actionLabel="create live streams, get RTMP keys, or host broadcasts"
      allowFreeArtist
      featureTitle="Live Streams Control Room"
      requiredEntitlement="canHostLiveStreams"
    >
      <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-bold">
              Live Streams
            </h1>
            <p className="mt-1 max-w-2xl text-muted-foreground">
              Broadcast live using browser camera or OBS/RTMP encoder with
              health checks and real-time audience analytics.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/live/streams">Open Public Streams</Link>
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <MetricCard
            icon={Radio}
            label="Live Recordings"
            value={liveRecordings.length}
          />
          <MetricCard
            icon={Users}
            label="Processing"
            value={processingVideos.length}
          />
          <MetricCard icon={Video} label="Total Videos" value={videos.length} />
          <MetricCard
            icon={MessageSquare}
            label="Realtime Chat"
            value="Always On"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <main className="flex flex-col gap-6">
            {activeStream ? (
              <ControlRoom
                activeStream={activeStream}
                copiedField={copiedField}
                isRefreshing={isRefreshing}
                onCopy={copyToClipboard}
                onEnd={handleEndStream}
                onRefresh={handleRefreshStream}
                showStreamKey={showStreamKey}
                toggleShowStreamKey={() => setShowStreamKey((v) => !v)}
              />
            ) : (
              <Card>
                <CardHeader className="border-b">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <CardTitle>Create Stream</CardTitle>
                      <CardDescription>
                        Choose a camera or encoder, then start your broadcast.
                        SoundKit keeps your room, chat, and viewers in sync.
                      </CardDescription>
                    </div>
                    <StepTabs
                      onStepChange={setSetupStep}
                      setupStep={setupStep}
                    />
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-6 p-4 md:p-6">
                  {setupStep === "details" && (
                    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="stream-title">Title</Label>
                          <Input
                            id="stream-title"
                            onChange={(e) => setStreamTitle(e.target.value)}
                            placeholder="Late Night Studio Jam"
                            value={streamTitle}
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="stream-description">
                            Description
                          </Label>
                          <Textarea
                            className="min-h-28 resize-none"
                            id="stream-description"
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Tell viewers what is happening tonight."
                            value={description}
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-4">
                        <FieldSelect
                          label="Genre"
                          onValueChange={setGenre}
                          options={genreOptions}
                          value={genre}
                        />
                        <FieldSelect
                          label="Visibility"
                          onValueChange={setVisibility}
                          options={visibilityOptions}
                          value={visibility}
                        />
                        <SchedulePicker
                          scheduleMode={scheduleMode}
                          setScheduleMode={setScheduleMode}
                        />
                      </div>
                    </div>
                  )}

                  {setupStep === "device" && (
                    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
                      <div className="flex flex-col gap-4">
                        <p className="font-medium text-sm">
                          How are you going live?
                        </p>
                        <RadioGroup
                          className="grid gap-3 md:grid-cols-2"
                          onValueChange={(val) => {
                            const newSource = val as StreamSource;
                            setSource(newSource);
                            if (
                              newSource === "browser" &&
                              hasMediaPermissions === null
                            ) {
                              requestMediaPermissions();
                            }
                          }}
                          value={source}
                        >
                          <label
                            className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 hover:border-primary/50 transition-colors"
                            htmlFor="stream-source-browser"
                          >
                            <RadioGroupItem
                              id="stream-source-browser"
                              value="browser"
                            />
                            <span>
                              <span className="flex items-center gap-2 font-medium">
                                <Video className="size-4 text-primary" />
                                Browser camera &amp; mic
                              </span>
                              <span className="mt-1 block text-muted-foreground text-sm">
                                Broadcast directly from your webcam, USB mic, or
                                audio interface.
                              </span>
                            </span>
                          </label>
                          <label
                            className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 hover:border-primary/50 transition-colors"
                            htmlFor="stream-source-obs"
                          >
                            <RadioGroupItem
                              id="stream-source-obs"
                              value="obs"
                            />
                            <span>
                              <span className="flex items-center gap-2 font-medium">
                                <MonitorUp className="size-4 text-primary" />
                                OBS or encoder
                              </span>
                              <span className="mt-1 block text-muted-foreground text-sm">
                                Get RTMPS / SRT stream key and push video from
                                OBS or Meld Studio.
                              </span>
                            </span>
                          </label>
                        </RadioGroup>

                        {source === "browser" && (
                          <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-4">
                            <div className="flex items-center justify-between">
                              <p className="font-semibold text-xs text-foreground uppercase tracking-wider">
                                Browser Devices &amp; Permissions
                              </p>
                              <Button
                                onClick={() =>
                                  requestMediaPermissions(
                                    selectedVideoDeviceId,
                                    selectedAudioDeviceId
                                  )
                                }
                                size="sm"
                                variant="outline"
                              >
                                <RefreshCcw className="mr-1.5 size-3" />
                                Refresh Devices
                              </Button>
                            </div>

                            {hasMediaPermissions ? (
                              <div className="space-y-4">
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-medium flex items-center gap-1.5">
                                      <Camera className="size-3.5 text-primary" />
                                      Camera
                                    </Label>
                                    <Select
                                      onValueChange={handleVideoDeviceChange}
                                      value={selectedVideoDeviceId}
                                    >
                                      <SelectTrigger className="text-xs">
                                        <SelectValue placeholder="Select camera" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {videoDevices.map((dev) => (
                                          <SelectItem
                                            key={dev.deviceId}
                                            value={dev.deviceId}
                                          >
                                            {dev.label ||
                                              `Camera (${dev.deviceId.slice(0, 6)})`}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-medium flex items-center gap-1.5">
                                      <Mic className="size-3.5 text-primary" />
                                      Microphone / Input
                                    </Label>
                                    <Select
                                      onValueChange={handleAudioDeviceChange}
                                      value={selectedAudioDeviceId}
                                    >
                                      <SelectTrigger className="text-xs">
                                        <SelectValue placeholder="Select microphone" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {audioDevices.map((dev) => (
                                          <SelectItem
                                            key={dev.deviceId}
                                            value={dev.deviceId}
                                          >
                                            {dev.label ||
                                              `Mic (${dev.deviceId.slice(0, 6)})`}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>

                                <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
                                  <video
                                    autoPlay
                                    className="size-full object-cover"
                                    muted
                                    playsInline
                                    ref={cameraPreviewRef}
                                  />
                                  <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded bg-black/70 px-2 py-0.5 font-mono text-[10px] text-emerald-400 backdrop-blur-md">
                                    <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    Live Preview Active
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="rounded-lg border border-dashed p-6 text-center space-y-3">
                                <Camera className="mx-auto size-8 text-primary opacity-80" />
                                <div className="space-y-1">
                                  <p className="font-semibold text-sm">
                                    Camera &amp; Microphone Access
                                  </p>
                                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                                    Grant browser permissions to select your
                                    video camera and microphone input.
                                  </p>
                                </div>
                                <Button
                                  onClick={() => requestMediaPermissions()}
                                  size="sm"
                                >
                                  <Camera className="mr-1.5 size-3.5" />
                                  Grant Device Permissions
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <ChecklistCard
                        items={
                          source === "browser"
                            ? [
                                hasMediaPermissions
                                  ? "Camera & Microphone connected"
                                  : "Grant camera & microphone permissions",
                                selectedVideoDeviceId
                                  ? "Video device selected"
                                  : "Choose default camera",
                                selectedAudioDeviceId
                                  ? "Audio device selected"
                                  : "Choose default microphone",
                                "Low latency WebRTC stream ready",
                              ]
                            : streamConfig.checklist
                        }
                        title="Device checklist"
                      />
                    </div>
                  )}

                  {setupStep === "ready" && (
                    <div className="rounded-lg border bg-muted/30 p-5">
                      <div className="flex items-center gap-2 font-semibold">
                        <CheckCircle2 className="size-5 text-primary" />
                        Stream room is ready to launch
                      </div>
                      <p className="mt-2 text-muted-foreground text-sm">
                        SoundKit will initialize your stream control room with
                        chat, low-latency playback, encoder keys, and viewer
                        analytics.
                      </p>
                    </div>
                  )}

                  <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <Badge variant="outline">
                      {source === "obs" ? "OBS Setup" : "Browser Setup"}
                    </Badge>
                    <div className="flex gap-2">
                      {setupStep !== "details" && (
                        <Button
                          onClick={() =>
                            setSetupStep(
                              setupStep === "ready" ? "device" : "details"
                            )
                          }
                          type="button"
                          variant="outline"
                        >
                          Back
                        </Button>
                      )}
                      {setupStep === "ready" ? (
                        <Button
                          disabled={isCreatingStream || !canCreate}
                          onClick={handleStartStream}
                        >
                          {isCreatingStream ? (
                            <>
                              <LoaderCircle className="mr-2 size-4 animate-spin" />
                              Creating...
                            </>
                          ) : (
                            <>
                              <Radio className="mr-2 size-4" />
                              Create Stream Room
                            </>
                          )}
                        </Button>
                      ) : (
                        <Button
                          disabled={setupStep === "details" && !canCreate}
                          onClick={() =>
                            setSetupStep(
                              setupStep === "details" ? "device" : "ready"
                            )
                          }
                          type="button"
                        >
                          Next
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <StreamLibrary
              isLoading={videosQuery.isLoading}
              liveRecordings={liveRecordings}
            />
          </main>

          {/* Active and Scheduled Streams management panel in the sidebar */}
          <aside className="flex flex-col gap-4">
            <ActiveScheduledStreamsSection
              experiences={
                myExperiencesQuery.data?.filter(
                  (exp) => exp.kind === "stream"
                ) ?? []
              }
              isDeleting={deleteExperience.isPending}
              isLoading={myExperiencesQuery.isLoading}
              onDelete={handleDeleteExperience}
            />
          </aside>
        </div>
      </div>
    </LiveExperienceAuthGuard>
  );
}

function ControlRoom({
  activeStream,
  copiedField,
  isRefreshing,
  onCopy,
  onEnd,
  onRefresh,
  showStreamKey,
  toggleShowStreamKey,
}: {
  activeStream: ActiveStream;
  copiedField: string | null;
  isRefreshing: boolean;
  onCopy: (text: string, field: string) => void;
  onEnd: () => void;
  onRefresh: () => void;
  showStreamKey: boolean;
  toggleShowStreamKey: () => void;
}) {
  const visibleKey = showStreamKey ? activeStream.rtmpsKey : "••••••••••••",
    streamStatus = readableStreamStatus(activeStream.status),
    streamIngestStatus = readableStreamStatus(activeStream.ingestStatus),
    statusLabel =
      streamIngestStatus === "connected" ||
      streamStatus === "connected" ||
      streamStatus === "reconnected"
        ? "Live"
        : streamIngestStatus === "reconnecting"
          ? "Reconnecting"
          : streamIngestStatus === "error"
            ? "Error"
            : "Waiting for OBS";

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>{activeStream.title}</CardTitle>
            <CardDescription>
              {activeStream.source === "obs"
                ? "Send video from OBS or your encoder using keys below."
                : "Join with browser camera when broadcast begins."}
            </CardDescription>
          </div>
          <Badge
            variant={
              statusLabel === "Live"
                ? "destructive"
                : (statusLabel === "Error"
                  ? "destructive"
                  : "outline")
            }
          >
            {statusLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 p-4 md:p-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="rounded-lg border bg-black text-center text-white flex min-h-72 flex-col items-center justify-center overflow-hidden">
            {activeStream.playbackUrl ? (
              <video
                autoPlay
                className="aspect-video w-full object-contain"
                controls
                muted
                playsInline
                src={activeStream.playbackUrl}
              />
            ) : (
              <>
                <Radio className="size-10 text-primary animate-pulse" />
                <h2 className="mt-4 font-semibold text-xl">
                  Control Room Online
                </h2>
                <p className="mt-2 max-w-md px-6 text-sm text-white/70">
                  {statusLabel === "Error"
                    ? activeStream.errorMessage ||
                      "Cloudflare rejected the ingest. Check your encoder settings and try again."
                    : (statusLabel === "Reconnecting"
                      ? "OBS disconnected briefly. The room is holding your broadcast open while you reconnect."
                      : "Connect OBS to begin the broadcast. You will not appear as live until Cloudflare confirms the input is connected.")}
                </p>
              </>
            )}
            <Button asChild className="mt-4" size="sm">
              <Link
                params={{ id: activeStream.experienceId }}
                to="/live/streams/$id"
              >
                Open public room
              </Link>
            </Button>
          </div>
          <div className="flex flex-col gap-3">
            <CredentialRow
              field="RTMPS URL"
              onCopy={onCopy}
              value={activeStream.rtmpsUrl || "Waiting for Cloudflare Stream"}
            />
            <CredentialRow
              field="Stream Key"
              onCopy={onCopy}
              value={activeStream.rtmpsKey ? visibleKey : "Unavailable"}
            />
            <Button
              onClick={toggleShowStreamKey}
              type="button"
              variant="outline"
              size="sm"
            >
              {showStreamKey ? (
                <EyeOff className="mr-2 size-4" />
              ) : (
                <Eye className="mr-2 size-4" />
              )}
              {showStreamKey ? "Hide Stream Key" : "Show Stream Key"}
            </Button>
            {copiedField && (
              <p className="text-primary text-xs font-medium">
                {copiedField} copied!
              </p>
            )}
          </div>
        </div>

        <ReviewStudio experienceId={activeStream.experienceId} />

        <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
          <Badge variant="outline">{activeStream.visibility}</Badge>
          <div className="flex gap-2">
            <Button
              disabled={isRefreshing}
              onClick={onRefresh}
              type="button"
              variant="outline"
              size="sm"
            >
              {isRefreshing ? "Refreshing..." : "Refresh Connection"}
            </Button>
            <Button
              onClick={onEnd}
              type="button"
              variant="destructive"
              size="sm"
            >
              End Broadcast
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReviewStudio({ experienceId }: { experienceId: string }) {
  const [search, setSearch] = useState(""),
    [overlayUrl, setOverlayUrl] = useState<string | null>(null),
    { setCurrentTrack, setQueue } = useAudioPlayer(),
    catalogQuery = useLiveReviewCatalogQuery(experienceId, search),
    room = useLiveRoom(experienceId),
    roomQuery = room.query,
    setNowPlaying = useSetLiveNowPlayingMutation(experienceId),
    setStreamBot = useSetStreamBotMutation(experienceId),
    createOverlayToken = useCreateLiveOverlayTokenMutation(),
    nowPlaying = roomQuery.data?.stream?.nowPlaying ?? null,
    botEnabled = roomQuery.data?.stream?.botEnabled ?? false,
    selectedTrack = catalogQuery.data?.find(
      (track) => track.id === nowPlaying?.id
    ),
    updateNowPlaying = async (trackId: string | null) => {
      try {
        await setNowPlaying.mutateAsync({ trackId });
        toast({
          description: trackId
            ? "The track is playing locally and viewers will see it in Now Playing."
            : "Now Playing has been cleared for viewers.",
          title: "Now Playing updated",
        });
        return true;
      } catch (error) {
        toast({
          description:
            error instanceof Error
              ? error.message
              : "Could not update Now Playing.",
          title: "Update failed",
          variant: "destructive",
        });
        return false;
      }
    },
    selectReviewTrack = async (
      track: NonNullable<typeof catalogQuery.data>[number]
    ) => {
      const updated = await updateNowPlaying(track.id);
      if (!updated) {
        return;
      }

      const playerTrack = {
        artist: track.artistName,
        cover: track.coverArtUrl,
        id: track.id,
        sourceType: "library" as const,
        src: track.playbackUrl,
        title: track.title,
        trackHref: `/tracks/${encodeURIComponent(track.id)}`,
      };
      setQueue([playerTrack]);
      setCurrentTrack(playerTrack);
    },
    toggleBot = async (enabled: boolean) => {
      try {
        await setStreamBot.mutateAsync({ enabled });
        toast({
          description: enabled
            ? "StreamBot will announce future track changes."
            : "StreamBot announcements are off.",
          title: "StreamBot updated",
        });
      } catch (error) {
        toast({
          description:
            error instanceof Error
              ? error.message
              : "Could not update StreamBot.",
          title: "Update failed",
          variant: "destructive",
        });
      }
    },
    generateOverlayUrl = async () => {
      try {
        const response = await createOverlayToken.mutateAsync(experienceId);
        const url = new URL(
          `/live/streams/overlay/${encodeURIComponent(experienceId)}`,
          window.location.origin
        );
        url.searchParams.set("token", response.token);
        setOverlayUrl(url.toString());
      } catch (error) {
        toast({
          description:
            error instanceof Error
              ? error.message
              : "Could not create an OBS overlay token.",
          title: "Overlay setup failed",
          variant: "destructive",
        });
      }
    },
    copyOverlayUrl = async () => {
      if (!overlayUrl) {
        return;
      }
      try {
        await navigator.clipboard.writeText(overlayUrl);
        toast({ description: "OBS Browser Source URL copied." });
      } catch {
        toast({
          description: "Clipboard access is unavailable in this browser.",
          title: "Copy unavailable",
          variant: "destructive",
        });
      }
    };

  return (
    <Card className="border-primary/20 bg-primary/[0.03]">
      <CardHeader className="border-b border-primary/10">
        <CardTitle className="flex items-center gap-2 text-base">
          <Music2 className="size-4 text-primary" />
          Live Music Review Studio
        </CardTitle>
        <CardDescription>
          Select a SoundKit track while you review it on stream. Viewers get a
          linked Now Playing card and optional chat announcement.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 p-4 md:p-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor={`review-track-search-${experienceId}`}>
                Review catalog
              </Label>
              <span className="text-xs text-muted-foreground">
                {catalogQuery.data?.length ?? 0} tracks
              </span>
            </div>
            <Input
              id={`review-track-search-${experienceId}`}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search your tracks and public catalog..."
              value={search}
            />
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border p-2">
              {catalogQuery.isLoading ? (
                <p className="p-3 text-sm text-muted-foreground">
                  Loading review catalog...
                </p>
              ) : (catalogQuery.data && catalogQuery.data.length > 0 ? (
                catalogQuery.data.map((track) => {
                  const isSelected = nowPlaying?.id === track.id;
                  return (
                    <button
                      className={`flex w-full items-center gap-3 rounded-md border p-2 text-left transition-colors ${isSelected ? "border-primary bg-primary/10" : "hover:bg-muted/50"}`}
                      key={track.id}
                      onClick={() => void selectReviewTrack(track)}
                      type="button"
                    >
                      <AppImage
                        alt={track.title}
                        className="size-10 rounded object-cover"
                        height={40}
                        src={track.coverArtUrl ?? "/soundkit-default-cover.svg"}
                        width={40}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-sm">
                          {track.title}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {track.artistName}
                        </span>
                      </span>
                      {isSelected && (
                        <Badge className="shrink-0" variant="default">
                          Live
                        </Badge>
                      )}
                    </button>
                  );
                })
              ) : (
                <p className="p-3 text-sm text-muted-foreground">
                  No playable tracks found for this review.
                </p>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                disabled={!nowPlaying || setNowPlaying.isPending}
                onClick={() => void updateNowPlaying(null)}
                size="sm"
                type="button"
                variant="outline"
              >
                Clear Now Playing
              </Button>
              {selectedTrack && (
                <span className="truncate text-xs text-muted-foreground">
                  Selected: {selectedTrack.title}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-lg border bg-background/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 font-medium text-sm">
                  <Bot className="size-4 text-primary" />
                  StreamBot announcements
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Posts a safe linked chat card when you select a new track.
                </p>
              </div>
              <Switch
                aria-label="Enable StreamBot announcements"
                checked={botEnabled}
                disabled={setStreamBot.isPending}
                onCheckedChange={(checked) => void toggleBot(checked)}
              />
            </div>
            <div className="border-t pt-4">
              <p className="flex items-center gap-2 font-medium text-sm">
                <Link2 className="size-4 text-primary" />
                OBS Browser Source
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Generate a read-only overlay URL for OBS. Anyone with the URL
                can view this room’s Now Playing state.
              </p>
              <Button
                className="mt-3 w-full"
                disabled={createOverlayToken.isPending}
                onClick={() => void generateOverlayUrl()}
                size="sm"
                type="button"
                variant="outline"
              >
                {createOverlayToken.isPending
                  ? "Generating..."
                  : "Generate OBS URL"}
              </Button>
              {overlayUrl && (
                <div className="mt-3 flex gap-2">
                  <Input
                    aria-label="OBS Browser Source URL"
                    className="min-w-0 text-xs"
                    readOnly
                    value={overlayUrl}
                  />
                  <Button
                    aria-label="Copy OBS Browser Source URL"
                    onClick={() => void copyOverlayUrl()}
                    size="icon"
                    type="button"
                    variant="outline"
                  >
                    <Copy className="size-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CredentialRow({
  field,
  onCopy,
  value,
}: {
  field: string;
  onCopy: (text: string, field: string) => void;
  value: string;
}) {
  return (
    <div className="rounded-lg border p-3 bg-muted/20">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs">{field}</p>
          <p className="truncate font-mono text-xs mt-0.5">{value}</p>
        </div>
        <Button
          onClick={() => onCopy(value, field)}
          size="icon"
          type="button"
          variant="outline"
          className="size-7 shrink-0"
        >
          <Copy className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function StepTabs({
  onStepChange,
  setupStep,
}: {
  onStepChange: (step: SetupStep) => void;
  setupStep: SetupStep;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 text-center text-xs">
      {(["details", "device", "ready"] as const).map((step, index) => (
        <button
          className={`rounded-md border px-3 py-1.5 font-medium capitalize transition-colors ${
            setupStep === step
              ? "border-primary bg-primary/10 text-primary font-semibold"
              : "text-muted-foreground hover:bg-accent"
          }`}
          key={step}
          onClick={() => onStepChange(step)}
          type="button"
        >
          {index + 1}. {step}
        </button>
      ))}
    </div>
  );
}

function FieldSelect({
  label,
  onValueChange,
  options,
  value,
}: {
  label: string;
  onValueChange: (v: string) => void;
  options: string[];
  value: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <Select onValueChange={onValueChange} value={value}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SchedulePicker({
  scheduleMode,
  setScheduleMode,
}: {
  scheduleMode: LiveScheduleMode;
  setScheduleMode: (m: LiveScheduleMode) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-medium text-sm">Start Mode</p>
      <RadioGroup
        className="grid grid-cols-2 gap-2"
        onValueChange={(val) => setScheduleMode(val as LiveScheduleMode)}
        value={scheduleMode}
      >
        <label
          className="flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-xs"
          htmlFor="stream-start-asap"
        >
          <RadioGroupItem id="stream-start-asap" value="asap" />
          <span>ASAP</span>
        </label>
        <label
          className="flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-xs"
          htmlFor="stream-start-scheduled"
        >
          <RadioGroupItem id="stream-start-scheduled" value="scheduled" />
          <span>Scheduled</span>
        </label>
      </RadioGroup>
    </div>
  );
}

function ChecklistCard({ items, title }: { items: string[]; title: string }) {
  return (
    <Card className="bg-muted/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {items.map((item) => (
          <div className="flex items-start gap-2 text-xs" key={item}>
            <CheckCircle2 className="mt-0.5 size-3.5 text-primary shrink-0" />
            <span className="text-muted-foreground">{item}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Radio;
  label: string;
  value: number | string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 font-medium text-muted-foreground text-sm">
          <Icon className="size-4 text-primary" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-3xl font-bold">{value}</CardContent>
    </Card>
  );
}

function ActiveScheduledStreamsSection({
  experiences,
  isDeleting,
  isLoading,
  onDelete,
}: {
  experiences: {
    genre: string | null;
    id: string;
    startsAt: string;
    status: string;
    streamInputId: string | null;
    title: string;
    viewerCount: number;
  }[];
  isDeleting: boolean;
  isLoading: boolean;
  onDelete: (id: string) => void;
}) {
  const [cancellingId, setCancellingId] = useState<string | null>(null),
    [confirmText, setConfirmText] = useState(""),
    targetStream = experiences.find((exp) => exp.id === cancellingId);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="size-5 text-primary" />
            Active &amp; Scheduled Streams
          </CardTitle>
          <CardDescription>
            Manage your upcoming broadcasts and active live rooms.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <p className="text-muted-foreground text-sm">Loading streams...</p>
          )}
          {!isLoading && experiences.length === 0 && (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <Radio className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 font-semibold text-sm">
                No scheduled or active streams
              </p>
              <p className="mt-1 text-muted-foreground text-xs">
                Create a stream above to get your OBS encoder keys and go live.
              </p>
            </div>
          )}
          <div className="space-y-3">
            {experiences.map((exp) => {
              const isLive = exp.status === "live",
                statusVariant = (() => {
                  if (isLive) {
                    return "destructive";
                  }
                  if (exp.status === "ended") {
                    return "secondary";
                  }
                  return "outline";
                })(),
                statusLabel = (() => {
                  if (isLive) {
                    return "LIVE";
                  }
                  if (exp.status === "scheduled") {
                    return "Scheduled";
                  }
                  return exp.status;
                })();

              return (
                <div
                  className="space-y-3 rounded-lg border bg-card/60 p-3.5 transition-colors hover:bg-card/80"
                  key={exp.id}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm truncate">
                        {exp.title}
                      </p>
                      <Badge className="shrink-0" variant={statusVariant}>
                        {statusLabel}
                      </Badge>
                    </div>
                    {exp.genre ? (
                      <Badge className="w-fit text-[10px]" variant="secondary">
                        {exp.genre}
                      </Badge>
                    ) : null}
                    <p className="text-muted-foreground text-xs">
                      Scheduled: {new Date(exp.startsAt).toLocaleString()}
                      {isLive
                        ? ` • ${exp.viewerCount.toLocaleString()} viewers`
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-1 border-t border-border/40">
                    <Button
                      asChild
                      className="flex-1 h-8 text-xs"
                      size="sm"
                      variant={isLive ? "default" : "outline"}
                    >
                      <Link params={{ id: exp.id }} to="/live/streams/$id">
                        <ExternalLink className="mr-1.5 size-3.5" />
                        {isLive ? "Live Room" : "View Room"}
                      </Link>
                    </Button>
                    <Button
                      className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0 px-2.5"
                      disabled={isDeleting}
                      onClick={() => {
                        setCancellingId(exp.id);
                        setConfirmText("");
                      }}
                      size="sm"
                      variant="outline"
                    >
                      <Trash2 className="mr-1 size-3.5" />
                      Cancel
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Confirmation dialog requiring typing CANCEL */}
      <AlertDialog
        open={Boolean(cancellingId)}
        onOpenChange={(open) => {
          if (!open) {
            setCancellingId(null);
            setConfirmText("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Live Stream?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm">
              <span>
                Cancelling &quot;{targetStream?.title}&quot; will permanently
                remove this broadcast room and disconnect any encoder stream
                keys.
              </span>
              <span className="block font-medium text-foreground">
                Type{" "}
                <span className="font-mono font-bold text-destructive">
                  CANCEL
                </span>{" "}
                to confirm:
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-2">
            <Input
              autoFocus
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type CANCEL to confirm"
              value={confirmText}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Stream</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={confirmText.trim() !== "CANCEL" || isDeleting}
              onClick={() => {
                if (cancellingId) {
                  onDelete(cancellingId);
                  setCancellingId(null);
                  setConfirmText("");
                }
              }}
            >
              {isDeleting ? "Cancelling..." : "Confirm Cancellation"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function StreamLibrary({
  isLoading,
  liveRecordings,
}: {
  isLoading: boolean;
  liveRecordings: { id: string; title: string; updatedAt?: string }[];
}) {
  const content = (() => {
    if (isLoading) {
      return <p className="text-muted-foreground text-sm">Loading videos...</p>;
    }

    if (liveRecordings.length === 0) {
      return (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <Tv className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-semibold text-sm">
            No live stream recordings yet
          </p>
          <p className="mt-1 text-muted-foreground text-xs">
            Go live or save a stream broadcast to build your video library.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {liveRecordings.map((recording) => (
          <div
            key={recording.id}
            className="flex items-center justify-between rounded-lg border p-3"
          >
            <div>
              <p className="font-semibold text-sm">{recording.title}</p>
              <p className="text-xs text-muted-foreground">
                {recording.updatedAt
                  ? new Date(recording.updatedAt).toLocaleDateString()
                  : "Saved recording"}
              </p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link params={{ id: recording.id }} to="/dashboard/videos">
                Watch Recording
              </Link>
            </Button>
          </div>
        ))}
      </div>
    );
  })();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stream Library</CardTitle>
        <CardDescription>
          Recorded broadcasts saved in your video catalog.
        </CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
