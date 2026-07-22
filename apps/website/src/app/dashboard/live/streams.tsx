import { createFileRoute, Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  Captions,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  LoaderCircle,
  MessageSquare,
  Mic2,
  Radio,
  ShieldCheck,
  Swords,
  Tv,
  Users,
  Video,
  Wand2,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";
import { useVideosQuery } from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/live/streams")({
  component: DashboardLiveStreamsPage,
});

type LiveFlow = "battle" | "party" | "stream";
type SetupStep = "details" | "features" | "ready";

interface ActiveStream {
  category: string;
  description: string;
  flow: LiveFlow;
  id: string;
  playbackUrl: string;
  realtime: RealtimeOptions;
  rtmpsKey: string;
  rtmpsUrl: string;
  srtKey: string;
  srtUrl: string;
  status: string;
  title: string;
  visibility: string;
}

interface RealtimeOptions {
  backstageVoice: boolean;
  captions: boolean;
  chat: boolean;
  recording: boolean;
}

const flowOptions = [
  {
    description: "Head-to-head live matchup with voting and host controls.",
    icon: Swords,
    label: "Battle",
    value: "battle",
  },
  {
    description: "Listening party with chat, guests, and audience moments.",
    icon: Users,
    label: "Party",
    value: "party",
  },
  {
    description: "Standard music stream, premiere, or live performance.",
    icon: Radio,
    label: "Stream",
    value: "stream",
  },
] satisfies {
  description: string;
  icon: LucideIcon;
  label: string;
  value: LiveFlow;
}[];

const categories = [
  "Music",
  "Music Video",
  "Live Performance",
  "Battle",
  "Listening Party",
];

const visibilityOptions = ["Public", "Unlisted", "Private"];

const defaultRealtime: RealtimeOptions = {
  backstageVoice: true,
  captions: true,
  chat: true,
  recording: true,
};

function DashboardLiveStreamsPage() {
  const videosQuery = useVideosQuery();
  const videos = videosQuery.data ?? [];
  const liveRecordings = videos.filter(
    (video) => video.videoKind === "live_recording"
  );
  const processingVideos = videos.filter(
    (video) => video.status === "processing"
  );

  const [setupStep, setSetupStep] = useState<SetupStep>("details");
  const [flow, setFlow] = useState<LiveFlow>("stream");
  const [streamTitle, setStreamTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Music");
  const [visibility, setVisibility] = useState("Public");
  const [realtime, setRealtime] = useState<RealtimeOptions>(defaultRealtime);
  const [activeStream, setActiveStream] = useState<ActiveStream | null>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("soundkit_active_live_stream");
      return saved ? JSON.parse(saved) : null;
    }
    return null;
  });
  const [isCreatingStream, setIsCreatingStream] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showStreamKey, setShowStreamKey] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const selectedFlow = flowOptions.find((option) => option.value === flow);
  const canCreate = streamTitle.trim().length > 0;

  const handleStartStream = async () => {
    setIsCreatingStream(true);
    try {
      const res = await apiClient.v1.live["cloudflare-stream"].$post({
        json: { title: streamTitle.trim() || "My Live Session" },
      });
      if (!res.ok) {
        throw new Error("Failed to create live input");
      }

      const stream = await res.json();
      const nextStream: ActiveStream = {
        ...stream,
        category,
        description,
        flow,
        realtime,
        visibility,
      };
      setActiveStream(nextStream);
      localStorage.setItem(
        "soundkit_active_live_stream",
        JSON.stringify(nextStream)
      );
      setSetupStep("ready");
      toast({
        description: "Stream control room and encoder credentials are ready.",
        title: "Live input created",
      });
    } catch {
      toast({
        description:
          "Could not create Cloudflare live input. Please try again.",
        title: "Error starting stream",
        variant: "destructive",
      });
    } finally {
      setIsCreatingStream(false);
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
          "soundkit_active_live_stream",
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
    localStorage.removeItem("soundkit_active_live_stream");
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
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-bold">
            Live Studio
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
            Create battles, parties, and streams, then manage encoder keys,
            chat, realtime features, health, and recordings from one workspace.
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
          value={realtime.chat ? "Ready" : "Off"}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <main className="space-y-6">
          <FlowPicker selectedFlow={flow} onSelect={setFlow} />

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
            <CreateStreamWizard
              canCreate={canCreate}
              category={category}
              description={description}
              flow={flow}
              isCreatingStream={isCreatingStream}
              onCategoryChange={setCategory}
              onCreate={handleStartStream}
              onDescriptionChange={setDescription}
              onRealtimeChange={(key, value) =>
                setRealtime((current) => ({ ...current, [key]: value }))
              }
              onStepChange={setSetupStep}
              onTitleChange={setStreamTitle}
              onVisibilityChange={setVisibility}
              realtime={realtime}
              selectedFlow={selectedFlow}
              setupStep={setupStep}
              streamTitle={streamTitle}
              visibility={visibility}
            />
          )}

          <StreamLibrary
            isLoading={videosQuery.isLoading}
            liveRecordings={liveRecordings}
          />
        </main>

        <aside className="space-y-4">
          <RealtimePanel realtime={activeStream?.realtime ?? realtime} />
          <ChatPreview activeStream={activeStream} />
        </aside>
      </div>
    </div>
  );
}

function FlowPicker({
  onSelect,
  selectedFlow,
}: {
  onSelect: (flow: LiveFlow) => void;
  selectedFlow: LiveFlow;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {flowOptions.map((option) => {
        const Icon = option.icon;
        const isSelected = selectedFlow === option.value;
        return (
          <button
            type="button"
            className={`rounded-lg border p-4 text-left transition ${
              isSelected
                ? "border-primary bg-primary/10"
                : "bg-card hover:bg-muted/50"
            }`}
            key={option.value}
            onClick={() => onSelect(option.value)}
          >
            <div className="mb-3 flex items-center justify-between">
              <Icon className="size-5 text-primary" />
              {isSelected && <CheckCircle2 className="size-4 text-primary" />}
            </div>
            <p className="font-semibold">{option.label}</p>
            <p className="mt-1 text-muted-foreground text-sm">
              {option.description}
            </p>
          </button>
        );
      })}
    </div>
  );
}

function CreateStreamWizard({
  canCreate,
  category,
  description,
  flow,
  isCreatingStream,
  onCategoryChange,
  onCreate,
  onDescriptionChange,
  onRealtimeChange,
  onStepChange,
  onTitleChange,
  onVisibilityChange,
  realtime,
  selectedFlow,
  setupStep,
  streamTitle,
  visibility,
}: {
  canCreate: boolean;
  category: string;
  description: string;
  flow: LiveFlow;
  isCreatingStream: boolean;
  onCategoryChange: (value: string) => void;
  onCreate: () => void;
  onDescriptionChange: (value: string) => void;
  onRealtimeChange: (key: keyof RealtimeOptions, value: boolean) => void;
  onStepChange: (step: SetupStep) => void;
  onTitleChange: (value: string) => void;
  onVisibilityChange: (value: string) => void;
  realtime: RealtimeOptions;
  selectedFlow?: (typeof flowOptions)[number];
  setupStep: SetupStep;
  streamTitle: string;
  visibility: string;
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="size-5 text-primary" />
              Create {selectedFlow?.label ?? "Stream"}
            </CardTitle>
            <CardDescription>
              Details first, then audience features, then the control room.
            </CardDescription>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            {(["details", "features", "ready"] as const).map((step, index) => (
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
        </div>
      </CardHeader>
      <CardContent className="space-y-6 p-4 md:p-6">
        {setupStep === "details" && (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="stream-title">Title</Label>
                <Input
                  id="stream-title"
                  onChange={(event) => onTitleChange(event.target.value)}
                  placeholder="Late Night Studio Jam"
                  value={streamTitle}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stream-description">Description</Label>
                <Textarea
                  className="min-h-32 resize-none"
                  id="stream-description"
                  onChange={(event) => onDescriptionChange(event.target.value)}
                  placeholder="Tell viewers what is happening tonight."
                  value={description}
                />
              </div>
            </div>
            <div className="space-y-4">
              <FieldSelect
                label="Category"
                onValueChange={onCategoryChange}
                options={categories}
                value={category}
              />
              <FieldSelect
                label="Visibility"
                onValueChange={onVisibilityChange}
                options={visibilityOptions}
                value={visibility}
              />
              <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                <p className="font-medium">Music-first defaults</p>
                <p className="mt-1 text-muted-foreground">
                  SoundKit skips kids-audience settings and keeps the workflow
                  focused on music, music videos, battles, and parties.
                </p>
              </div>
            </div>
          </div>
        )}

        {setupStep === "features" && (
          <div className="grid gap-4 md:grid-cols-2">
            <FeatureToggle
              checked={realtime.chat}
              description="Audience chat panel for streams, battles, and parties."
              icon={MessageSquare}
              label="Realtime chat"
              onCheckedChange={(checked) => onRealtimeChange("chat", checked)}
            />
            <FeatureToggle
              checked={realtime.backstageVoice}
              description="Host and guest audio room before going live."
              icon={Mic2}
              label="Backstage voice"
              onCheckedChange={(checked) =>
                onRealtimeChange("backstageVoice", checked)
              }
            />
            <FeatureToggle
              checked={realtime.captions}
              description="Prepare RealtimeKit transcription and captions."
              icon={Captions}
              label="Captions"
              onCheckedChange={(checked) =>
                onRealtimeChange("captions", checked)
              }
            />
            <FeatureToggle
              checked={realtime.recording}
              description="Save the session into the live recording library."
              icon={ShieldCheck}
              label="Recording"
              onCheckedChange={(checked) =>
                onRealtimeChange("recording", checked)
              }
            />
          </div>
        )}

        {setupStep === "ready" && (
          <div className="rounded-lg border bg-muted/30 p-5">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="size-5 text-primary" />
              {selectedFlow?.label ?? "Stream"} is ready to create
            </div>
            <p className="mt-2 text-muted-foreground text-sm">
              SoundKit will create the Cloudflare Stream live input now. The
              RealtimeKit feature selections are preserved with the session so
              the meeting-token backend can attach chat, voice, and captions.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
          <Badge variant="outline">
            {flowOptions.find((option) => option.value === flow)?.label}
          </Badge>
          <div className="flex gap-2">
            {setupStep !== "details" && (
              <Button
                onClick={() =>
                  onStepChange(setupStep === "ready" ? "features" : "details")
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
                onClick={onCreate}
              >
                {isCreatingStream ? (
                  <>
                    <LoaderCircle className="mr-2 size-4 animate-spin" />
                    Creating
                  </>
                ) : (
                  <>
                    <Radio className="mr-2 size-4" />
                    Create Control Room
                  </>
                )}
              </Button>
            ) : (
              <Button
                disabled={setupStep === "details" && !canCreate}
                onClick={() =>
                  onStepChange(setupStep === "details" ? "features" : "ready")
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
  const isConnected = activeStream.status === "connected";

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <StatusBadge isConnected={isConnected} />
              <Badge variant="outline">{activeStream.category}</Badge>
              <Badge variant="outline">{activeStream.visibility}</Badge>
            </div>
            <CardTitle>{activeStream.title}</CardTitle>
            <CardDescription>
              {activeStream.description || "No description added."}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              disabled={isRefreshing}
              onClick={onRefresh}
              size="sm"
              variant="outline"
            >
              {isRefreshing ? "Refreshing" : "Refresh"}
            </Button>
            <Button onClick={onEnd} size="sm" variant="destructive">
              End
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-4 md:p-6">
        <div className="aspect-video overflow-hidden rounded-lg border bg-black">
          {isConnected ? (
            <iframe
              allow="autoplay; encrypted-media; picture-in-picture;"
              allowFullScreen
              className="h-full w-full"
              src={`https://iframe.videodelivery.net/${activeStream.id}`}
              title={activeStream.title}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center text-white">
              <LoaderCircle className="mb-3 size-8 animate-spin text-primary" />
              <p className="font-semibold">Connect your encoder to go live</p>
              <p className="mt-1 max-w-sm text-sm text-white/60">
                Copy the RTMPS or SRT credentials into OBS, Streamlabs, or your
                live encoder. The preview appears here when Cloudflare detects
                the feed.
              </p>
            </div>
          )}
        </div>

        <Tabs defaultValue="settings">
          <TabsList>
            <TabsTrigger value="settings">Stream settings</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="health">Stream health</TabsTrigger>
          </TabsList>
          <TabsContent className="space-y-4" value="settings">
            <CredentialField
              copiedField={copiedField}
              field="RTMPS URL"
              onCopy={onCopy}
              value={activeStream.rtmpsUrl}
            />
            <CredentialField
              copiedField={copiedField}
              field="Stream Key"
              isSecret
              onCopy={onCopy}
              showSecret={showStreamKey}
              toggleShowSecret={toggleShowStreamKey}
              value={activeStream.rtmpsKey}
            />
            <CredentialField
              copiedField={copiedField}
              field="SRT URL"
              onCopy={onCopy}
              value={activeStream.srtUrl}
            />
          </TabsContent>
          <TabsContent className="grid gap-3 md:grid-cols-3" value="analytics">
            <ControlMetric label="Viewers waiting" value="0" />
            <ControlMetric label="Likes" value="0" />
            <ControlMetric label="Chat messages" value="0" />
          </TabsContent>
          <TabsContent className="space-y-3" value="health">
            <HealthRow
              label="Cloudflare ingest"
              status={isConnected ? "Connected" : "Waiting"}
            />
            <HealthRow label="Realtime chat" status="Ready" />
            <HealthRow label="Recording" status="Armed" />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function StreamLibrary({
  isLoading,
  liveRecordings,
}: {
  isLoading: boolean;
  liveRecordings: {
    externalPlaybackUrl?: string | null;
    id: string;
    playbackPolicy: string;
    sourceProvider?: string | null;
    status: string;
    title: string;
  }[];
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
        {isLoading && (
          <p className="text-muted-foreground text-sm">
            Loading stream videos...
          </p>
        )}

        {!isLoading && liveRecordings.length === 0 && (
          <div className="rounded-lg border border-dashed bg-muted/20 p-8 text-center">
            <Radio className="mx-auto mb-3 size-8 text-muted-foreground opacity-60" />
            <p className="font-semibold">No live recordings yet</p>
            <p className="mx-auto mt-1 max-w-xs text-muted-foreground text-sm">
              Create a stream control room or upload a finished live recording.
            </p>
            <Button asChild className="mt-4">
              <Link to="/dashboard/videos/new">New Video</Link>
            </Button>
          </div>
        )}

        <div className="space-y-3">
          {liveRecordings.map((video) => (
            <div
              className="flex flex-col gap-4 rounded-lg border bg-card/50 p-4 transition hover:bg-card/95 sm:flex-row sm:items-center sm:justify-between"
              key={video.id}
            >
              <div>
                <p className="font-semibold">{video.title}</p>
                <p className="text-muted-foreground text-sm">
                  {video.sourceProvider} - {video.status}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{video.playbackPolicy}</Badge>
                {video.externalPlaybackUrl && (
                  <Button asChild size="sm" variant="outline">
                    <a
                      href={video.externalPlaybackUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      <ExternalLink className="mr-2 size-4" />
                      Open
                    </a>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function RealtimePanel({ realtime }: { realtime: RealtimeOptions }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Tv className="size-4 text-primary" />
          RealtimeKit layer
        </CardTitle>
        <CardDescription>
          Planned meeting UI for chat, voice, captions, and audience tools.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <RealtimeRow
          enabled={realtime.chat}
          icon={MessageSquare}
          label="Chat"
        />
        <RealtimeRow
          enabled={realtime.backstageVoice}
          icon={Mic2}
          label="Backstage voice"
        />
        <RealtimeRow
          enabled={realtime.captions}
          icon={Captions}
          label="Captions"
        />
        <RealtimeRow
          enabled={realtime.recording}
          icon={ShieldCheck}
          label="Recording"
        />
        <div className="rounded-lg border bg-muted/30 p-3 text-muted-foreground text-xs">
          Backend follow-up: create RealtimeKit meetings and participant tokens,
          then mount the Cloudflare UI Kit in this panel.
        </div>
      </CardContent>
    </Card>
  );
}

function ChatPreview({ activeStream }: { activeStream: ActiveStream | null }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="size-4 text-primary" />
          Top chat
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        <div className="min-h-60 rounded-lg border bg-muted/20 p-4">
          <div className="rounded-md bg-background p-3 text-sm shadow-sm">
            <p className="font-medium">Welcome to live chat</p>
            <p className="mt-1 text-muted-foreground text-xs">
              Guard the music community and pin important host updates during
              {activeStream ? ` ${activeStream.title}` : " the stream"}.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Input disabled placeholder="Chat..." />
          <Button disabled size="icon" variant="outline">
            <MessageSquare className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FeatureToggle({
  checked,
  description,
  icon: Icon,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  description: string;
  icon: LucideIcon;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
      <div className="flex gap-3">
        <Icon className="mt-0.5 size-5 text-primary" />
        <div>
          <p className="font-medium">{label}</p>
          <p className="mt-1 text-muted-foreground text-sm">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
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
    <div className="space-y-2">
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

function CredentialField({
  copiedField,
  field,
  isSecret = false,
  onCopy,
  showSecret = false,
  toggleShowSecret,
  value,
}: {
  copiedField: string | null;
  field: string;
  isSecret?: boolean;
  onCopy: (text: string, field: string) => void;
  showSecret?: boolean;
  toggleShowSecret?: () => void;
  value: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="font-bold text-muted-foreground text-xs uppercase">
        {field}
      </Label>
      <div className="flex gap-2">
        <Input
          className="font-mono text-xs"
          readOnly
          type={isSecret && !showSecret ? "password" : "text"}
          value={value}
        />
        {isSecret && toggleShowSecret && (
          <Button onClick={toggleShowSecret} size="icon" variant="outline">
            {showSecret ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </Button>
        )}
        <Button
          onClick={() => onCopy(value, field)}
          size="icon"
          variant="outline"
        >
          {copiedField === field ? (
            <Check className="size-4 text-green-500" />
          ) : (
            <Copy className="size-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

function StatusBadge({ isConnected }: { isConnected: boolean }) {
  return (
    <Badge
      className={
        isConnected
          ? "border-green-500/20 bg-green-500/10 text-green-600"
          : "border-amber-500/20 bg-amber-500/10 text-amber-600"
      }
      variant="outline"
    >
      <span
        className={`mr-1.5 size-1.5 rounded-full ${
          isConnected ? "animate-ping bg-green-500" : "bg-amber-500"
        }`}
      />
      {isConnected ? "Live feed active" : "Waiting for encoder"}
    </Badge>
  );
}

function ControlMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="mt-2 font-bold text-2xl">{value}</p>
    </div>
  );
}

function HealthRow({ label, status }: { label: string; status: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <AlertCircle className="size-4 text-primary" />
        <span className="font-medium text-sm">{label}</span>
      </div>
      <Badge variant="outline">{status}</Badge>
    </div>
  );
}

function RealtimeRow({
  enabled,
  icon: Icon,
  label,
}: {
  enabled: boolean;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <span className="font-medium text-sm">{label}</span>
      </div>
      <Badge variant={enabled ? "default" : "outline"}>
        {enabled ? "On" : "Off"}
      </Badge>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
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
      <CardContent className="font-bold text-3xl">
        {typeof value === "number" ? value.toLocaleString() : value}
      </CardContent>
    </Card>
  );
}
