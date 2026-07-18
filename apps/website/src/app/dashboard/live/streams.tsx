import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ExternalLink,
  Radio,
  Video,
  Users,
  Copy,
  Eye,
  EyeOff,
  Tv,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
  Check,
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
import { toast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";
import { useVideosQuery } from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/live/streams")({
  component: DashboardLiveStreamsPage,
});

function DashboardLiveStreamsPage() {
  const videosQuery = useVideosQuery();
  const videos = videosQuery.data ?? [];
  const liveRecordings = videos.filter(
    (video) => video.videoKind === "live_recording"
  );
  const processingVideos = videos.filter(
    (video) => video.status === "processing"
  );

  const [streamTitle, setStreamTitle] = useState("");
  const [activeStream, setActiveStream] = useState<{
    id: string;
    playbackUrl: string;
    rtmpsKey: string;
    rtmpsUrl: string;
    srtKey: string;
    srtUrl: string;
    status: string;
    title: string;
  } | null>(() => {
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

  const handleStartStream = async () => {
    setIsCreatingStream(true);
    try {
      const res = await apiClient.v1.live["cloudflare-stream"].$post({
        json: { title: streamTitle.trim() || "My Live Session" },
      });
      if (res.ok) {
        const stream = await res.json();
        setActiveStream(stream);
        localStorage.setItem(
          "soundkit_active_live_stream",
          JSON.stringify(stream)
        );
        toast({
          description: "OBS broadcasting credentials are ready.",
          title: "Live Input Created",
        });
      } else {
        throw new Error("Failed to create live input");
      }
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
    if (!activeStream) {return;}
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
          title: "Stream Status Updated",
        });
      }
    } catch {
      // Ignore background refresh errors
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleEndStream = () => {
    setActiveStream(null);
    localStorage.removeItem("soundkit_active_live_stream");
    toast({
      description: "Live input has been cleared from dashboard.",
      title: "Live Broadcast Ended",
    });
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast({
      description: `${field} copied to clipboard.`,
      title: "Copied!",
    });
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-bold">
            Creator Streams
          </h1>
          <p className="mt-2 text-muted-foreground text-sm max-w-xl">
            Manage live stream recordings and prepare Cloudflare Stream
            broadcasts.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/live/streams">Open Public Streams</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
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
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        {/* Left Side: Video Library */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Stream Library</CardTitle>
            <CardDescription>
              Real live recordings uploaded or linked in your video catalog.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {videosQuery.isLoading && (
              <p className="text-sm text-muted-foreground">
                Loading stream videos...
              </p>
            )}

            {!videosQuery.isLoading && liveRecordings.length === 0 && (
              <div className="rounded-lg border border-dashed p-8 text-center bg-muted/5">
                <Radio className="mx-auto mb-3 size-8 text-muted-foreground opacity-60" />
                <p className="font-semibold">No live recordings yet</p>
                <p className="mt-1 text-sm text-muted-foreground max-w-xs mx-auto">
                  Start with a verified video upload or start broadcasting
                  below!
                </p>
                <Button asChild className="mt-4">
                  <Link to="/dashboard/videos/new">New Video</Link>
                </Button>
              </div>
            )}

            <div className="space-y-3">
              {liveRecordings.map((video) => (
                <div
                  className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between bg-card/50 hover:bg-card/95 transition-all"
                  key={video.id}
                >
                  <div>
                    <p className="font-semibold">{video.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {video.sourceProvider} - {video.status}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{video.playbackPolicy}</Badge>
                    {video.externalPlaybackUrl && (
                      <Button asChild size="sm" variant="outline">
                        <a
                          href={video.externalPlaybackUrl}
                          target="_blank"
                          rel="noopener noreferrer"
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

        {/* Right Side: Start Stream / Live Broadcast credentials */}
        {activeStream ? (
          <Card className="h-fit border-primary/30 bg-primary/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Badge
                  className={
                    activeStream.status === "connected"
                      ? "bg-green-500/10 text-green-500 border-green-500/20"
                      : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                  }
                  variant="outline"
                >
                  <span
                    className={`size-1.5 rounded-full mr-1.5 ${
                      activeStream.status === "connected"
                        ? "bg-green-500 animate-ping"
                        : "bg-amber-500"
                    }`}
                  />
                  {activeStream.status === "connected"
                    ? "Live Feed Active"
                    : "Waiting for encoder..."}
                </Badge>
                <Button
                  onClick={handleRefreshStream}
                  disabled={isRefreshing}
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                >
                  {isRefreshing ? "Refreshing..." : "Refresh Status"}
                </Button>
              </div>
              <CardTitle className="text-xl font-bold mt-2">
                {activeStream.title}
              </CardTitle>
              <CardDescription>Live Session Stream Credentials</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                  <Tv className="size-3.5" />
                  Broadcaster Feed Preview
                </Label>
                <div className="aspect-video w-full rounded-xl overflow-hidden bg-black border border-border/40 relative flex items-center justify-center">
                  {activeStream.status === "connected" ? (
                    <iframe
                      src={`https://iframe.videodelivery.net/${activeStream.id}`}
                      className="h-full w-full"
                      allow="autoplay; encrypted-media; picture-in-picture;"
                      allowFullScreen
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-4">
                      <LoaderCircle className="size-8 animate-spin text-primary mb-3" />
                      <p className="text-sm font-semibold text-white">
                        Awaiting Video Stream
                      </p>
                      <p className="text-xs text-white/60 max-w-xs mt-1">
                        Paste the RTMPS details into your streaming app (OBS)
                        and start streaming to view the feed.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-muted-foreground">
                    RTMPS URL
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={activeStream.rtmpsUrl}
                      className="bg-background/40 h-9 text-xs border-border/40"
                    />
                    <Button
                      onClick={() =>
                        copyToClipboard(activeStream.rtmpsUrl, "RTMPS URL")
                      }
                      size="icon"
                      variant="outline"
                      className="size-9 shrink-0"
                    >
                      {copiedField === "RTMPS URL" ? (
                        <Check className="size-4 text-green-500" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-muted-foreground">
                    Stream Key
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      type={showStreamKey ? "text" : "password"}
                      value={activeStream.rtmpsKey}
                      className="bg-background/40 h-9 text-xs border-border/40"
                    />
                    <Button
                      onClick={() => setShowStreamKey(!showStreamKey)}
                      size="icon"
                      variant="outline"
                      className="size-9 shrink-0"
                    >
                      {showStreamKey ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </Button>
                    <Button
                      onClick={() =>
                        copyToClipboard(activeStream.rtmpsKey, "Stream Key")
                      }
                      size="icon"
                      variant="outline"
                      className="size-9 shrink-0"
                    >
                      {copiedField === "Stream Key" ? (
                        <Check className="size-4 text-green-500" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-3 border-t border-border/20 pt-4">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-muted-foreground">
                    SRT URL
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={activeStream.srtUrl}
                      className="bg-background/40 h-9 text-xs border-border/40"
                    />
                    <Button
                      onClick={() =>
                        copyToClipboard(activeStream.srtUrl, "SRT URL")
                      }
                      size="icon"
                      variant="outline"
                      className="size-9 shrink-0"
                    >
                      {copiedField === "SRT URL" ? (
                        <Check className="size-4 text-green-500" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleEndStream}
                variant="destructive"
                className="w-full h-10 font-bold"
              >
                End Live Stream
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Radio className="size-5 text-red-500 animate-pulse" />
                Start Live Broadcast
              </CardTitle>
              <CardDescription>
                Create a new Cloudflare Stream live input and start streaming.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="stream-title">Stream Session Title</Label>
                <Input
                  id="stream-title"
                  placeholder="e.g. Late Night Studio Jam"
                  value={streamTitle}
                  onChange={(e) => setStreamTitle(e.target.value)}
                  className="bg-background/50 h-10 text-sm"
                />
              </div>

              <Button
                onClick={handleStartStream}
                disabled={isCreatingStream}
                className="w-full h-10 font-bold bg-primary hover:bg-primary/90 text-white"
              >
                {isCreatingStream ? (
                  <>
                    <LoaderCircle className="mr-2 size-4 animate-spin" />
                    Initializing Live Input...
                  </>
                ) : (
                  <>
                    <Radio className="mr-2 size-4" />
                    Go Live Now
                  </>
                )}
              </Button>

              <div className="rounded-xl border border-border/40 bg-muted/20 p-4 text-xs text-muted-foreground leading-relaxed space-y-2">
                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                  <AlertCircle className="size-3.5 text-primary" />
                  Broadcaster Instructions
                </div>
                <p>
                  SoundKit connects with Cloudflare Stream to deliver lag-free
                  live streaming. We will generate standard RTMPS and SRT URLs
                  you can paste into OBS, Streamlabs, or other encoder softwares
                  to stream directly from your device.
                </p>
              </div>

              <div className="border-t border-border/20 pt-4 flex gap-2">
                <Button asChild className="flex-1" variant="outline" size="sm">
                  <Link to="/dashboard/videos/new">
                    <Video className="mr-2 size-3.5" />
                    Upload Video
                  </Link>
                </Button>
                <Button asChild className="flex-1" variant="outline" size="sm">
                  <a
                    href="https://developers.cloudflare.com/stream/stream-live/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Cloudflare Docs
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Radio;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-5" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-3xl font-bold">
        {value.toLocaleString()}
      </CardContent>
    </Card>
  );
}
