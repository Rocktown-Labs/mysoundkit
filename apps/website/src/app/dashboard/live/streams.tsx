"use client";

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  Captions,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  LoaderCircle,
  MessageSquare,
  Mic2,
  MonitorUp,
  Radio,
  ShieldCheck,
  Tv,
  Users,
  Video,
} from "lucide-react";
import { useState } from "react";

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
import { apiClient } from "@/lib/api";
import {
  liveExperienceConfigs,
  realtimeKitAlwaysOn,
} from "@/lib/live-experience";
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
  const [source, setSource] = useState<StreamSource>("browser");
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
    } catch {
      toast({
        description:
          "Could not create the RealtimeKit stream room. Please try again.",
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
      // Status refresh is optional and should not interrupt the control room.
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleEndStream = () => {
    setActiveStream(null);
    localStorage.removeItem("soundkit_active_creator_stream");
    toast({
      description: "Live input has been cleared from dashboard.",
      title: "Live broadcast ended",
    });
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast({
      description: `${field} copied to clipboard.`,
      title: "Copied",
    });
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-bold">
            Live Streams
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Create a one-creator stream with RealtimeKit chat, browser or OBS
            setup, health checks, and audience analytics.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/live/streams">Open Public Streams</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
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
          value="Always on"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
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
              toggleShowStreamKey={() => setShowStreamKey((value) => !value)}
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
                  <StepTabs onStepChange={setSetupStep} setupStep={setupStep} />
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
                          onChange={(event) =>
                            setStreamTitle(event.target.value)
                          }
                          placeholder="Late Night Studio Jam"
                          value={streamTitle}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="stream-description">Description</Label>
                        <Textarea
                          className="min-h-32 resize-none"
                          id="stream-description"
                          onChange={(event) =>
                            setDescription(event.target.value)
                          }
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
                        onValueChange={(value) =>
                          setSource(value as StreamSource)
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
                              Join from SoundKit after camera and mic setup.
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
                              Create stream keys and send video from OBS.
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
                      Stream room is ready to create
                    </div>
                    <p className="mt-2 text-muted-foreground text-sm">
                      SoundKit will create the live input and prepare a
                      RealtimeKit-themed room with chat, captions, recording,
                      and stream analytics.
                    </p>
                  </div>
                )}

                <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <Badge variant="outline">
                    {source === "obs" ? "OBS setup" : "Browser setup"}
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
                            Creating
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

        <aside className="flex flex-col gap-4">
          <RealtimeConstantsPanel />
          <AnalyticsPanel />
        </aside>
      </div>
    </div>
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
                ? "Send video from OBS or your encoder."
                : "Join with browser camera when the room opens."}
            </CardDescription>
          </div>
          <Badge variant="outline">{activeStream.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 p-4 md:p-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="rounded-lg border bg-black p-8 text-center text-white">
            <Radio className="mx-auto size-10 text-primary" />
            <h2 className="mt-4 font-semibold text-xl">
              Connect your stream source
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-white/60">
              RealtimeKit chat is ready. Start sending browser or encoder video
              when you are ready to go live.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <CredentialRow
              field="RTMPS URL"
              onCopy={onCopy}
              value={activeStream.rtmpsUrl}
            />
            <CredentialRow
              field="Stream key"
              onCopy={onCopy}
              value={visibleKey}
            />
            <Button
              onClick={toggleShowStreamKey}
              type="button"
              variant="outline"
            >
              {showStreamKey ? (
                <EyeOff className="mr-2 size-4" />
              ) : (
                <Eye className="mr-2 size-4" />
              )}
              {showStreamKey ? "Hide Key" : "Show Key"}
            </Button>
            {copiedField && (
              <p className="text-primary text-sm">{copiedField} copied.</p>
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
            >
              {isRefreshing ? "Refreshing..." : "Refresh Status"}
            </Button>
            <Button onClick={onEnd} type="button" variant="destructive">
              End Stream
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
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs">{field}</p>
          <p className="truncate font-mono text-sm">{value}</p>
        </div>
        <Button
          onClick={() => onCopy(value, field)}
          size="icon"
          type="button"
          variant="outline"
        >
          <Copy className="size-4" />
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
          className={`rounded-md border px-3 py-2 font-medium capitalize ${
            setupStep === step ? "border-primary bg-primary/10" : ""
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
  onValueChange: (value: string) => void;
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
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
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
  setScheduleMode: (mode: LiveScheduleMode) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>Start</Label>
      <RadioGroup
        className="grid gap-3"
        onValueChange={(value) => setScheduleMode(value as LiveScheduleMode)}
        value={scheduleMode}
      >
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3">
          <RadioGroupItem value="asap" />
          <span className="text-sm">ASAP</span>
        </label>
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3">
          <RadioGroupItem value="scheduled" />
          <span className="text-sm">Scheduled</span>
        </label>
      </RadioGroup>
    </div>
  );
}

function ChecklistCard({ items, title }: { items: string[]; title: string }) {
  return (
    <Card className="bg-muted/20">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {items.map((item) => (
          <div className="flex items-start gap-2 text-sm" key={item}>
            <CheckCircle2 className="mt-0.5 size-4 text-primary" />
            <span className="text-muted-foreground">{item}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function RealtimeConstantsPanel() {
  const iconByKey = {
    backstageVoice: Mic2,
    captions: Captions,
    chat: MessageSquare,
    recording: ShieldCheck,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">RealtimeKit Layer</CardTitle>
        <CardDescription>
          These features are platform defaults, not creator toggles.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {Object.entries(realtimeKitAlwaysOn).map(([key]) => {
          const Icon = iconByKey[key as keyof typeof iconByKey];
          return (
            <div
              className="flex items-center justify-between rounded-lg border p-3"
              key={key}
            >
              <span className="flex items-center gap-2 capitalize">
                <Icon className="size-4 text-primary" />
                {formatRealtimeLabel(key)}
              </span>
              <Badge>On</Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function formatRealtimeLabel(value: string) {
  return value
    .replaceAll(/(?<capitalLetter>[A-Z])/gu, " $<capitalLetter>")
    .trim();
}

function AnalyticsPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="size-5 text-primary" />
          Stream Analytics
        </CardTitle>
        <CardDescription>
          The API should return the details creators need while live.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        {["Viewer count", "Latency", "Retention", "Chat velocity"].map(
          (metric) => (
            <div
              className="flex items-center justify-between rounded-lg border p-3"
              key={metric}
            >
              <span>{metric}</span>
              <Badge variant="outline">Ready</Badge>
            </div>
          )
        )}
      </CardContent>
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
          Live recordings uploaded or linked in your video catalog.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading videos...</p>
        ) : (liveRecordings.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <Tv className="mx-auto size-10 text-muted-foreground" />
            <p className="mt-3 font-semibold">No live recordings yet</p>
            <p className="mt-1 text-muted-foreground text-sm">
              Create a stream control room or upload a finished live recording.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {liveRecordings.map((video) => (
              <div
                className="flex items-center justify-between rounded-lg border p-4"
                key={video.id}
              >
                <div>
                  <p className="font-medium">{video.title}</p>
                  <p className="text-muted-foreground text-sm">
                    {video.updatedAt
                      ? new Date(video.updatedAt).toLocaleDateString()
                      : "Recently updated"}
                  </p>
                </div>
                <Badge variant="outline">Recording</Badge>
              </div>
            ))}
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
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-5" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-3xl font-bold">{value}</CardContent>
    </Card>
  );
}
