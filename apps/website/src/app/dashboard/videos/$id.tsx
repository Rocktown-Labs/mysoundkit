import { createFileRoute, Link } from "@tanstack/react-router";
/* oxlint-disable complexity, no-nested-ternary, one-var, sort-vars */
import {
  ArrowLeft,
  BarChart3,
  Clock3,
  Eye,
  Globe2,
  Play,
  Users,
} from "lucide-react";
import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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
import { Progress } from "@/components/ui/progress";
import {
  useVideoAnalyticsQuery,
  useVideoQuery,
} from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/videos/$id")({
  component: DashboardVideoDetailPage,
});

const RANGE_OPTIONS = [
    { label: "7 days", value: "7d" },
    { label: "28 days", value: "28d" },
    { label: "90 days", value: "90d" },
    { label: "12 months", value: "12m" },
  ] as const,
  formatDuration = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60),
      hours = Math.floor(minutes / 60);
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

type VideoRange = (typeof RANGE_OPTIONS)[number]["value"];

function DashboardVideoDetailPage() {
  const { id } = Route.useParams(),
    [range, setRange] = useState<VideoRange>("28d"),
    videoQuery = useVideoQuery(id),
    analyticsQuery = useVideoAnalyticsQuery(id, range),
    video = videoQuery.data,
    analytics = analyticsQuery.data;

  if (videoQuery.isPending) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        Loading video analytics...
      </div>
    );
  }

  if (!video || videoQuery.isError) {
    return (
      <div className="space-y-4">
        <Button asChild={true} variant="ghost">
          <Link to="/dashboard/videos">
            <ArrowLeft className="mr-2 size-4" />
            Back to Videos
          </Link>
        </Button>
        <Card>
          <CardContent className="p-10 text-center">
            <p className="font-semibold">Video unavailable</p>
            <p className="mt-1 text-sm text-muted-foreground">
              We couldn&apos;t load this video or you no longer have access to
              it.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const summary = analytics?.summary,
    locations = analytics?.geography.locations ?? [],
    chartData = analytics?.timeseries ?? [],
    hasData = (summary?.views ?? 0) > 0,
    previewPath =
      video.regionSlug && video.slug
        ? `/videos/${video.regionSlug}/${video.slug}`
        : `/videos/${video.id}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <Button asChild={true} className="-ml-3" variant="ghost">
            <Link to="/dashboard/videos">
              <ArrowLeft className="mr-2 size-4" />
              Back to Videos
            </Link>
          </Button>
          <div className="flex items-start gap-3">
            <div className="hidden size-16 overflow-hidden rounded-xl border border-border/50 sm:block">
              <AppImage
                alt={`${video.title} thumbnail`}
                className="size-full object-cover"
                height={128}
                layout="fixed"
                src={video.thumbnailUrl}
                width={128}
              />
            </div>
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  {video.videoKind.replaceAll("_", " ")}
                </Badge>
                <Badge
                  variant={video.status === "ready" ? "default" : "secondary"}
                >
                  {video.status}
                </Badge>
              </div>
              <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-bold tracking-tight">
                {video.title}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {video.sourceProvider === "mux"
                  ? "SoundKit-hosted video"
                  : "External video source"}
                {video.duration ? ` · ${video.duration}` : ""}
              </p>
            </div>
          </div>
        </div>
        <Button asChild={true} variant="outline">
          <Link to={previewPath} target="_blank" rel="noopener noreferrer">
            <Play className="mr-2 size-4 fill-current" />
            Preview video
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border/40 bg-card/30 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Performance window</p>
          <p className="text-xs text-muted-foreground">
            First-party view sessions, updated from playback activity.
          </p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg bg-muted/40 p-1">
          {RANGE_OPTIONS.map((option) => (
            <Button
              className="h-8 px-3 text-xs"
              key={option.value}
              onClick={() => setRange(option.value)}
              size="sm"
              variant={range === option.value ? "secondary" : "ghost"}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {analyticsQuery.isError ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-5 text-sm text-destructive">
            Analytics are temporarily unavailable. Your video is still live and
            playback tracking will retry on the next visit.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          description="Views after 3 seconds of playback"
          icon={Eye}
          label="Views"
          value={(summary?.views ?? 0).toLocaleString()}
        />
        <MetricCard
          description="Distinct viewers in this video"
          icon={Users}
          label="Unique viewers"
          value={(summary?.uniqueViewers ?? 0).toLocaleString()}
        />
        <MetricCard
          description="Maximum position watched across sessions"
          icon={Clock3}
          label="Watch time"
          value={formatDuration(summary?.totalWatchedSeconds ?? 0)}
        />
        <MetricCard
          description="Viewers reaching 90% of the video"
          icon={BarChart3}
          label="Completion rate"
          value={`${Math.round(summary?.completionRate ?? 0)}%`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Views over time</CardTitle>
          <CardDescription>
            Daily or monthly verified views for the selected window.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {analyticsQuery.isPending ? (
            <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
              Loading chart...
            </div>
          ) : hasData ? (
            <div className="h-72 w-full">
              <ResponsiveContainer height="100%" width="100%">
                <AreaChart data={chartData} margin={{ left: -20, right: 8 }}>
                  <defs>
                    <linearGradient
                      id="video-views-fill"
                      x1="0"
                      x2="0"
                      y1="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="#a798ff"
                        stopOpacity={0.35}
                      />
                      <stop offset="95%" stopColor="#a798ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="hsl(var(--border))"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.75rem",
                    }}
                  />
                  <Area
                    dataKey="views"
                    fill="url(#video-views-fill)"
                    name="Views"
                    stroke="#a798ff"
                    strokeWidth={2}
                    type="monotone"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyAnalyticsState message="No verified view data for this window yet." />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Audience geography</CardTitle>
            <CardDescription>
              {analytics?.geography.level === "region"
                ? "Premium regional detail, protected by a minimum three-viewer cohort."
                : "Country-level audience totals. Premium unlocks state and region detail."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {analyticsQuery.isPending ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Loading audience data...
              </div>
            ) : analytics?.geography.hasEnoughData ? (
              <div className="space-y-4">
                {locations.map((location) => (
                  <div
                    className="space-y-2"
                    key={`${location.label}-${location.countryCode ?? "unknown"}`}
                  >
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <div className="flex min-w-0 items-center gap-2">
                        <Globe2 className="size-4 shrink-0 text-primary" />
                        <span className="truncate font-medium">
                          {location.label}
                        </span>
                      </div>
                      <span className="shrink-0 text-muted-foreground">
                        {location.viewers.toLocaleString()} ·{" "}
                        {location.percentage}%
                      </span>
                    </div>
                    <Progress value={location.percentage} />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyAnalyticsState message="Audience geography appears after at least three verified viewers." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Average watch depth</CardTitle>
            <CardDescription>
              How much of the video viewers reach on average.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <div className="mb-2 flex items-end justify-between gap-3">
                <span className="text-4xl font-bold">
                  {Math.round(summary?.averageWatchPercent ?? 0)}%
                </span>
                <span className="text-xs text-muted-foreground">
                  average watched
                </span>
              </div>
              <Progress value={summary?.averageWatchPercent ?? 0} />
            </div>
            <div className="rounded-xl border border-border/40 bg-muted/20 p-4 text-sm text-muted-foreground">
              {video.sourceProvider === "mux"
                ? "SoundKit records playback milestones from the Mux player and never stores viewer IP addresses."
                : "External players do not expose reliable playback milestones to SoundKit, so analytics remain limited until a hosted player is used."}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  description,
  icon: Icon,
  label,
  value,
}: {
  description: string;
  icon: typeof Eye;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </CardTitle>
        <div className="rounded-xl bg-primary/10 p-2 text-primary">
          <Icon className="size-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-extrabold tracking-tight">{value}</div>
        <p className="mt-1.5 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function EmptyAnalyticsState({ message }: { message: string }) {
  return (
    <div className="flex h-72 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
      <BarChart3 className="size-10 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
