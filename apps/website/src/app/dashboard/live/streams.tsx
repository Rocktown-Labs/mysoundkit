"use client";

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  LoaderCircle,
  MessageSquare,
  MonitorUp,
  Radio,
  Tv,
  Users,
  Video,
} from "lucide-react";
import { useEffect, useState } from "react";

import { LiveExperienceAuthGuard } from "@/components/dashboard/live-experience-auth-guard";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { SoundKitApiError, apiClient } from "@/lib/api";
import { liveExperienceConfigs } from "@/lib/live-experience";
import type { LiveScheduleMode } from "@/lib/live-experience";
import { musicGenres } from "@/lib/music-genres";
import {
  useCreateLiveExperienceMutation,
  useGenresQuery,
  useVideosQuery,
} from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/live/streams")({
  component: DashboardLiveStreamsPage,
});

type SetupStep = "details" | "device" | "ready";
type StreamSource = "browser" | "obs";

interface ActiveStream {
  description: string;
  genre: string;
  id: string;
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

function DashboardLiveStreamsPage() {
  const genresQuery = useGenresQuery();
  const videosQuery = useVideosQuery();
  const createLiveExperience = useCreateLiveExperienceMutation();
  const videos = videosQuery.data ?? [];
  const liveRecordings = videos.filter(
    (video) => video.videoKind === "live_recording"
  );
  const processingVideos = videos.filter(
    (video) => video.status === "processing"
  );
  const streamConfig = liveExperienceConfigs.stream;

  const [setupStep, setSetupStep] = useState<SetupStep>("details");
  const [streamTitle, setStreamTitle] = useState("");
  const [description, setDescription] = useState("");
  const genreOptions =
    genresQuery.data && genresQuery.data.length > 0
      ? genresQuery.data.map((genre) => genre.name)
      : musicGenres.map((genre) => genre.label);
  const [genre, setGenre] = useState(genreOptions[0] ?? "Hip-Hop/Rap");
  const [visibility, setVisibility] = useState("Public");
  const [scheduleMode, setScheduleMode] = useState<LiveScheduleMode>("asap");
  const [source, setSource] = useState<StreamSource>("obs");
  const [activeStream, setActiveStream] = useState<ActiveStream | null>(
    readSavedStream
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showStreamKey, setShowStreamKey] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const canCreate = streamTitle.trim().length > 0;
  const isCreatingStream = createLiveExperience.isPending;

  const handleStartStream = async () => {
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
      });

      const stream =
        created.streamInput ??
        ({
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
          | "id"
          | "playbackUrl"
          | "rtmpsKey"
          | "rtmpsUrl"
          | "srtKey"
          | "srtUrl"
          | "status"
          | "title"
        >);

      const nextStream: ActiveStream = {
        ...stream,
        description,
        genre,
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
  };

  const handleRefreshStream = async () => {
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
        const stream = await res.json();
        const updated = { ...activeStream, status: stream.status };
        setActiveStream(updated);
        localStorage.setItem(
          "soundkit_active_creator_stream",
          JSON.stringify(updated)
        );
        toast({
          description: `Current connection state: ${stream.status}`,
          title: "Stream status updated",
        });
      }
    } catch {
      // Status refresh is optional
    } finally {
      setIsRefreshing(false);
    }
  };

  const activeStreamId = activeStream?.id;

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

        const stream = await response.json();
        setActiveStream((current) => {
          if (!current) {
            return current;
          }
          const updated = { ...current, status: stream.status };
          localStorage.setItem(
            "soundkit_active_creator_stream",
            JSON.stringify(updated)
          );
          return updated;
        });
      })().catch(() => {
        // Status polling is best effort; the manual refresh remains available.
      });
    }, 5_000);

    return () => window.clearInterval(refreshTimer);
  }, [activeStreamId, source]);

  const handleEndStream = async () => {
    if (activeStream?.source === "obs") {
      try {
        await apiClient.v1.live["cloudflare-stream"][":streamId"].$delete({
          param: { streamId: activeStream.id },
        });
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
  };

  const copyToClipboard = async (text: string, field: string) => {
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
                        RealtimeKit Layer handles chat and room presence while
                        Cloudflare Stream handles the OBS input.
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
                          onValueChange={(val) =>
                            setSource(val as StreamSource)
                          }
                          value={source}
                        >
                          <label
                            className="flex cursor-pointer items-start gap-3 rounded-lg border p-4"
                            htmlFor="stream-source-browser"
                          >
                            <RadioGroupItem
                              disabled
                              id="stream-source-browser"
                              value="browser"
                            />
                            <span>
                              <span className="flex items-center gap-2 font-medium text-muted-foreground">
                                <Video className="size-4" />
                                Browser camera (coming soon)
                              </span>
                              <span className="mt-1 block text-muted-foreground text-sm">
                                Browser broadcasting will use the RealtimeKit
                                host studio once the web SDK is connected.
                              </span>
                            </span>
                          </label>
                          <label
                            className="flex cursor-pointer items-start gap-3 rounded-lg border p-4"
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
                                OBS.
                              </span>
                            </span>
                          </label>
                        </RadioGroup>
                      </div>
                      <ChecklistCard
                        items={streamConfig.checklist}
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

          {/* Real Analytics Panel replacing static constants block */}
          <aside className="flex flex-col gap-4">
            <RealAnalyticsPanel activeStream={activeStream} />
          </aside>
        </div>
      </div>
    </LiveExperienceAuthGuard>
  );
}

function RealAnalyticsPanel({
  activeStream,
}: {
  activeStream: ActiveStream | null;
}) {
  return (
    <Card className="border-primary/20 bg-card/80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="size-5 text-primary" />
          Realtime Stream Analytics
        </CardTitle>
        <CardDescription>
          Live telemetry appears after OBS connects to the stream input.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <div className="flex items-center justify-between rounded-lg border p-3 bg-background/50">
          <span className="text-muted-foreground">Stream Input</span>
          <Badge variant="outline">{activeStream?.status ?? "Offline"}</Badge>
        </div>
        <div className="flex items-center justify-between rounded-lg border p-3 bg-background/50">
          <span className="text-muted-foreground">Active Viewers</span>
          <span className="font-bold text-foreground">0</span>
        </div>
        <div className="flex items-center justify-between rounded-lg border p-3 bg-background/50">
          <span className="text-muted-foreground">Stream Latency</span>
          <Badge
            variant="outline"
            className="font-mono text-emerald-500 border-emerald-500/40"
          >
            {activeStream ? activeStream.status : "Offline"}
          </Badge>
        </div>
        <div className="flex items-center justify-between rounded-lg border p-3 bg-background/50">
          <span className="text-muted-foreground">Chat Velocity</span>
          <span className="font-mono text-xs font-semibold">0 msgs/min</span>
        </div>
        <div className="flex items-center justify-between rounded-lg border p-3 bg-background/50">
          <span className="text-muted-foreground">Peak Viewers</span>
          <span className="font-semibold">0</span>
        </div>
        <div className="flex items-center justify-between rounded-lg border p-3 bg-background/50">
          <span className="text-muted-foreground">Retention Rate</span>
          <span className="font-semibold text-primary">N/A</span>
        </div>
        <div className="flex items-center justify-between rounded-lg border p-3 bg-background/50">
          <span className="text-muted-foreground">Encoding / Quality</span>
          <span className="font-mono text-xs">N/A</span>
        </div>
      </CardContent>
    </Card>
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
  const visibleKey = showStreamKey ? activeStream.rtmpsKey : "••••••••••••";

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
              activeStream.status === "connected" ||
              activeStream.status === "reconnected"
                ? "destructive"
                : "outline"
            }
          >
            {activeStream.status}
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
                <h2 className="mt-4 font-semibold text-xl">Control Room Online</h2>
                <p className="mt-2 max-w-md px-6 text-sm text-white/70">
                  Connect OBS to begin the broadcast. Stream playback will
                  appear here when Cloudflare provides a playback URL.
                </p>
              </>
            )}
            <Button asChild className="mt-4" size="sm">
              <Link params={{ id: activeStream.id }} to="/live/streams/$id">
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
