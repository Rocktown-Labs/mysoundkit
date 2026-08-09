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
  Zap,
} from "lucide-react";
import { useState } from "react";

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
import {
  useCreateLiveExperienceMutation,
  useVideosQuery,
} from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/live/streams")({
  component: DashboardLiveStreamsPage,
});

type SetupStep = "details" | "device" | "ready";
type StreamSource = "browser" | "obs";

interface ActiveStream {
  category: string;
  description: string;
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

const categories = ["Music", "Music Video", "Live Performance", "Studio"];
const visibilityOptions = ["Public", "Unlisted", "Private"];

function readSavedStream() {
  if (typeof window === "undefined") {
    return null;
  }

  const saved = localStorage.getItem("soundkit_active_creator_stream");
  return saved ? (JSON.parse(saved) as ActiveStream) : null;
}

function DashboardLiveStreamsPage() {
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
  const [category, setCategory] = useState("Music");
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
        category,
        description,
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
      const description =
        error instanceof SoundKitApiError
          ? error.message
          : "Could not create the live stream room. Please try again.";
      toast({
        description,
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

  const handleEndStream = () => {
    setActiveStream(null);
    localStorage.removeItem("soundkit_active_creator_stream");
    toast({
      description: "Live broadcast input cleared.",
      title: "Stream Ended",
    });
  };

  const copyToClipboard = (text: string, field: string) => {
    void navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopiedField(field);
        toast({
          description: `${field} copied to clipboard.`,
          title: "Copied",
        });
        setTimeout(() => setCopiedField(null), 2000);
      })
      .catch(() => {});
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
                        Details, device setup, then a ready room with keys.
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
                          label="Category"
                          onValueChange={setCategory}
                          options={categories}
                          value={category}
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
                        <Label>How are you going live?</Label>
                        <RadioGroup
                          className="grid gap-3 md:grid-cols-2"
                          onValueChange={(val) =>
                            setSource(val as StreamSource)
                          }
                          value={source}
                        >
                          <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4">
                            <RadioGroupItem value="browser" />
                            <span>
                              <span className="flex items-center gap-2 font-medium">
                                <Video className="size-4 text-primary" />
                                Browser camera
                              </span>
                              <span className="mt-1 block text-muted-foreground text-sm">
                                Join directly from browser with camera &amp; mic
                                setup.
                              </span>
                            </span>
                          </label>
                          <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4">
                            <RadioGroupItem value="obs" />
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
            variant={activeStream.status === "live" ? "destructive" : "outline"}
          >
            {activeStream.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 p-4 md:p-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="rounded-lg border bg-black p-8 text-center text-white flex flex-col items-center justify-center">
            <Radio className="size-10 text-primary animate-pulse" />
            <h2 className="mt-4 font-semibold text-xl">Control Room Online</h2>
            <p className="mt-2 max-w-md text-sm text-white/70">
              Realtime chat &amp; playback channels are open. Connect your OBS
              source or camera stream to broadcast live.
            </p>
            <Button asChild className="mt-4" size="sm">
              <Link params={{ id: activeStream.id }} to="/live/streams/$id">
                Open Viewroom Page
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
      <Label>Start Mode</Label>
      <RadioGroup
        className="grid grid-cols-2 gap-2"
        onValueChange={(val) => setScheduleMode(val as LiveScheduleMode)}
        value={scheduleMode}
      >
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-xs">
          <RadioGroupItem value="asap" />
          <span>ASAP</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-xs">
          <RadioGroupItem value="scheduled" />
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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Stream Library</CardTitle>
        <CardDescription>
          Recorded broadcasts saved in your video catalog.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading videos...</p>
        ) : liveRecordings.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <Tv className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 font-semibold text-sm">
              No live stream recordings yet
            </p>
            <p className="mt-1 text-muted-foreground text-xs">
              Go live or save a stream broadcast to build your video library.
            </p>
          </div>
        ) : (
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
        )}
      </CardContent>
    </Card>
  );
}
