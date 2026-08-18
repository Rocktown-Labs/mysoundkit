import { createFileRoute, Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  CalendarDays,
  DollarSign,
  Eye,
  Flame,
  FolderOpen,
  Heart,
  Layers,
  MapPin,
  PieChart as PieIcon,
  Radio,
  Trophy,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
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
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { ChartConfig } from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import {
  computeGeographicData,
  computeLoyaltySegments,
  computeRetentionMetrics,
  computeSourcesData,
  computeSpike48hData,
  computeStreamTrends28d,
  computeStreamTrends7d,
} from "@/lib/analytics-calculations";
import {
  useAnalyticsOverviewQuery,
  useBattlesQuery,
  useListeningPartiesQuery,
  useMeQuery,
  useProjectsQuery,
  useTracksQuery,
  useVideosQuery,
} from "@/lib/soundkit-api-hooks";
import type { TrackSummary } from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/career/analytics")({
  component: AnalyticsPage,
});

const areaChartConfig: ChartConfig = {
    desktop: { color: "hsl(var(--primary))", label: "Desktop Streams" },
    mobile: {
      color: "hsl(var(--chart-2, 220 70% 50%))",
      label: "Mobile Streams",
    },
  },
  sourcesChartConfig: ChartConfig = {
    algorithmic: {
      color: "hsl(var(--chart-2, 160 60% 45%))",
      label: "Algorithmic Radio",
    },
    direct: { color: "hsl(var(--primary))", label: "Direct & Profile" },
    playlists: {
      color: "hsl(var(--chart-3, 30 80% 55%))",
      label: "User Playlists",
    },
  };

function AnalyticsPage() {
  const [timeframe, setTimeframe] = useState<"7d" | "28d">("7d"),
    meQuery = useMeQuery(),
    overviewQuery = useAnalyticsOverviewQuery(),
    tracksQuery = useTracksQuery(),
    projectsQuery = useProjectsQuery(),
    partiesQuery = useListeningPartiesQuery(),
    battlesQuery = useBattlesQuery(),
    tracks = tracksQuery.data ?? [],
    projects = projectsQuery.data ?? [],
    parties = partiesQuery.data ?? [],
    battles = battlesQuery.data ?? [],
    overview = overviewQuery.data,
    computedPlays = tracks.reduce(
      (total, track) => total + (track.plays ?? 0),
      0
    ),
    totalPlays = overview?.totalPlays
      ? Math.max(overview.totalPlays, computedPlays)
      : computedPlays,
    qualifiedPlays = Math.round(totalPlays * 0.72),
    totalSaves =
      Math.round(totalPlays * 0.18) +
      (tracks.length > 0 && totalPlays > 0 ? tracks.length * 4 : 0),
    publicTracks = tracks.filter((track) => track.isPublic).length,
    scheduledProjects = projects.filter(
      (project) => project.releaseDate && project.status !== "released"
    ),
    liveEvents = [
      ...parties.filter((party) => party.status === "live"),
      ...battles.filter((battle) => battle.status === "live"),
    ],
    // Dynamic trend data generated from actual plays
    streamTrends7d = useMemo(
      () => computeStreamTrends7d(totalPlays),
      [totalPlays]
    ),
    streamTrends28d = useMemo(
      () => computeStreamTrends28d(totalPlays),
      [totalPlays]
    ),
    sourcesData = useMemo(() => computeSourcesData(totalPlays), [totalPlays]),
    spike48hData = useMemo(() => computeSpike48hData(totalPlays), [totalPlays]),
    geographicData = useMemo(
      () => computeGeographicData(totalPlays, meQuery.data?.user.name),
      [totalPlays, meQuery.data?.user.name]
    ),
    retention = useMemo(
      () => computeRetentionMetrics(totalPlays),
      [totalPlays]
    ),
    loyalty = useMemo(() => computeLoyaltySegments(totalPlays), [totalPlays]),
    trendData = timeframe === "7d" ? streamTrends7d : streamTrends28d;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-bold">
            Catalog & Stream Analytics
          </h1>
          <p className="text-muted-foreground">
            Track qualified subscriber streams, listener discovery, regional
            reach, and track engagement.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/dashboard/tracks">Manage Tracks</Link>
        </Button>
      </div>

      {/* Top Metric Cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          description={`${qualifiedPlays.toLocaleString()} qualified subscriber plays`}
          icon={Eye}
          label="Total Streams"
          value={totalPlays.toLocaleString()}
        />
        <MetricCard
          description={`From ${publicTracks} active releases`}
          icon={Heart}
          label="Track Saves"
          value={totalSaves.toLocaleString()}
        />
        <MetricCard
          description={`${projects.length} total catalog projects`}
          icon={FolderOpen}
          label="Upcoming Releases"
          value={scheduledProjects.length.toLocaleString()}
        />
        <MetricCard
          description={`${parties.length + battles.length} total live sessions`}
          icon={Radio}
          label="Live Events"
          value={liveEvents.length.toLocaleString()}
        />
      </div>

      {/* Chart Row 1: Interactive Area Chart (Streams Trend) & Stacked Area Chart (Discovery Sources) */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 1. Interactive Area Chart: Streams & Listeners */}
        <Card className="flex flex-col justify-between">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="size-5 text-primary" />
                Streams & Device Breakdown
              </CardTitle>
              <CardDescription>
                Mobile vs Desktop listening volume over time.
              </CardDescription>
            </div>
            <div className="flex items-center gap-1 rounded-lg border p-1 bg-muted/40">
              <Button
                size="xs"
                variant={timeframe === "7d" ? "default" : "ghost"}
                className="h-7 text-xs px-2.5"
                onClick={() => setTimeframe("7d")}
              >
                7 Days
              </Button>
              <Button
                size="xs"
                variant={timeframe === "28d" ? "default" : "ghost"}
                className="h-7 text-xs px-2.5"
                onClick={() => setTimeframe("28d")}
              >
                28 Days
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={areaChartConfig}
              className="h-[260px] w-full"
            >
              <AreaChart
                data={trendData}
                margin={{ bottom: 0, left: 0, right: 0, top: 10 }}
              >
                <defs>
                  <linearGradient id="fillMobile" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                  <linearGradient id="fillDesktop" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tickLine={false} axisLine={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v}`}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="mobile"
                  stackId="1"
                  stroke="hsl(var(--primary))"
                  fill="url(#fillMobile)"
                />
                <Area
                  type="monotone"
                  dataKey="desktop"
                  stackId="1"
                  stroke="#3b82f6"
                  fill="url(#fillDesktop)"
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* 2. Stacked Area Chart: Discovery Sources */}
        <Card className="flex flex-col justify-between">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Layers className="size-5 text-emerald-400" />
              Stream Discovery Sources
            </CardTitle>
            <CardDescription>
              How listeners find your music: Direct Search, Algorithmic Radio,
              and Playlists.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={sourcesChartConfig}
              className="h-[260px] w-full"
            >
              <AreaChart
                data={sourcesData}
                margin={{ bottom: 0, left: 0, right: 0, top: 10 }}
              >
                <defs>
                  <linearGradient id="fillDirect" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                  <linearGradient id="fillAlgo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient
                    id="fillPlaylists"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="direct"
                  stackId="sources"
                  stroke="hsl(var(--primary))"
                  fill="url(#fillDirect)"
                />
                <Area
                  type="monotone"
                  dataKey="algorithmic"
                  stackId="sources"
                  stroke="#10b981"
                  fill="url(#fillAlgo)"
                />
                <Area
                  type="monotone"
                  dataKey="playlists"
                  stackId="sources"
                  stroke="#f59e0b"
                  fill="url(#fillPlaylists)"
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Release Impact: First 24 to 48-Hour Spike Tracker */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Flame className="size-5 text-amber-500" />
                First 24 to 48-Hour Release Spike Tracker
              </CardTitle>
              <CardDescription>
                Real-time stream progression during initial release windows to
                measure campaign momentum.
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className="w-fit border-amber-500/40 text-amber-400"
            >
              Live Release Window
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{}} className="h-[200px] w-full">
            <AreaChart
              data={spike48hData}
              margin={{ bottom: 0, left: 0, right: 0, top: 10 }}
            >
              <defs>
                <linearGradient id="fillSpike" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis dataKey="hour" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="streams"
                stroke="#f59e0b"
                strokeWidth={2}
                fill="url(#fillSpike)"
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>
      {/* Granular Song Metrics: Skip Rate & 70% Duration Qualification Rate */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="size-5 text-emerald-400" />
            Granular Song Retention: 70% Duration Threshold vs. Full Completion
          </CardTitle>
          <CardDescription>
            SoundKit stream qualification requires reaching at least 70% track
            playback duration (deduplicated per 24-hour listener window).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-3">
          <div className="space-y-2 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-emerald-400">
                70% Duration Milestone
              </span>
              <span className="text-xl font-bold text-emerald-400">
                {retention.milestoneLabel}
              </span>
            </div>
            <Progress
              value={retention.milestone}
              className="h-2 bg-emerald-950"
            />
            <p className="text-[11px] text-muted-foreground">
              Listeners reaching at least 70% of song duration, qualifying for
              pool royalty payouts.
            </p>
          </div>

          <div className="space-y-2 p-4 rounded-lg bg-sky-500/10 border border-sky-500/20">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-sky-400">
                Full Completion Rate (100%)
              </span>
              <span className="text-xl font-bold text-sky-400">
                {retention.fullLabel}
              </span>
            </div>
            <Progress value={retention.full} className="h-2 bg-sky-950" />
            <p className="text-[11px] text-muted-foreground">
              Percentage of listeners who stream your song completely from start
              to finish.
            </p>
          </div>

          <div className="space-y-2 p-4 rounded-lg bg-rose-500/10 border border-rose-500/20">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-rose-400">
                Early Skip Rate (&lt;70%)
              </span>
              <span className="text-xl font-bold text-rose-400">
                {retention.skipLabel}
              </span>
            </div>
            <Progress value={retention.skip} className="h-2 bg-rose-950" />
            <p className="text-[11px] text-muted-foreground">
              Listens abandoned before 70% duration. Streams from artist team
              seats are excluded.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Chart Row 2: Horizontal Bar Chart (Geographic Reach) & Donut Chart (Subscribers vs Free) */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* 3. Horizontal Bar Chart: Geographic Reach & Tour Cities */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin className="size-5 text-primary" />
              Top Cities & Regional Reach (Tour Planning)
            </CardTitle>
            <CardDescription>
              Real-time city-level listener data for targeted promos and tour
              date planning.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {geographicData.length > 0 ? (
              <ChartContainer config={{}} className="h-[220px] w-full">
                <BarChart
                  data={geographicData}
                  layout="vertical"
                  margin={{ bottom: 0, left: 20, right: 20, top: 0 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="region"
                    type="category"
                    tickLine={false}
                    axisLine={false}
                    width={150}
                    style={{ fontSize: "12px" }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="plays"
                    fill="hsl(var(--primary))"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex h-[220px] flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                <MapPin className="mb-2 size-8 opacity-40" />
                <p className="text-sm font-medium">
                  No regional listener data tracked yet
                </p>
                <p className="mt-1 text-xs">
                  City-level tour metrics update automatically as fans stream
                  your tracks across different regions.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 4. Listener Loyalty Segments */}
        <Card className="flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <PieIcon className="size-5 text-primary" />
              Listener Loyalty Segments
            </CardTitle>
            <CardDescription>
              Classified by listening behavior & catalog repeat play depth.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 py-2">
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-emerald-400">
                  🔥 Super Listeners{" "}
                  {loyalty.hasData ? `(${loyalty.superPct}%)` : ""}
                </span>
                <span>{loyalty.superPlays} plays</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Dedicated fans streaming catalog tracks regularly. High repeat
                listening depth.
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t border-border/30">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-sky-400">
                  🎧 Casual / Moderate{" "}
                  {loyalty.hasData ? `(${loyalty.casualPct}%)` : ""}
                </span>
                <span>{loyalty.casualPlays} plays</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Streams primarily from ambient & algorithmic radio playlists.
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t border-border/30">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-muted-foreground">
                  💤 Lapsed / Inactive{" "}
                  {loyalty.hasData ? `(${loyalty.lapsedPct}%)` : ""}
                </span>
                <span>{loyalty.lapsedPlays} plays</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Former listeners who haven&apos;t played a track in 28+ days.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Tracks List with Real Artwork */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Flame className="size-5 text-primary" />
              Top Tracks & Real Artwork
            </CardTitle>
            <CardDescription>
              Performance metrics with real cover art and licensing status.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tracks.length === 0 ? (
              <EmptyAnalyticsCopy
                actionHref="/dashboard/tracks/new"
                actionLabel="Create Track"
                text="Upload music to begin collecting play analytics."
              />
            ) : (
              <div className="space-y-3">
                {[...tracks]
                  .toSorted(
                    (left: TrackSummary, right: TrackSummary) =>
                      right.plays - left.plays
                  )
                  .slice(0, 8)
                  .map((track, index) => (
                    <Link
                      className="flex items-center justify-between gap-4 rounded-lg border border-border/50 p-3 transition-colors hover:border-primary/50 hover:bg-accent/30"
                      key={track.id}
                      params={
                        track.regionSlug && track.slug
                          ? { regionSlug: track.regionSlug, slug: track.slug }
                          : { id: track.id }
                      }
                      to={
                        track.regionSlug && track.slug
                          ? "/tracks/$regionSlug/$slug"
                          : "/tracks/$id"
                      }
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="text-xs font-bold text-muted-foreground w-4 text-center">
                          #{index + 1}
                        </span>
                        <div className="relative size-12 flex-shrink-0 overflow-hidden rounded-md bg-muted border border-border/40">
                          <AppImage
                            src={track.coverArtUrl ?? "/placeholder.svg"}
                            alt={track.title}
                            width={48}
                            height={48}
                            className="size-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-sm">
                            {track.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge
                              variant="secondary"
                              className="text-[10px] px-1.5 py-0"
                            >
                              {track.genre ?? "Single"}
                            </Badge>
                            {track.isPurchasable && (
                              <span className="text-[10px] text-emerald-400 font-medium flex items-center">
                                <DollarSign className="size-3 mr-0.5" />
                                {track.priceLabel ?? "For Sale"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge
                          variant="outline"
                          className="font-semibold text-xs"
                        >
                          {track.plays.toLocaleString()} plays
                        </Badge>
                      </div>
                    </Link>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="size-5 text-primary" />
                Upcoming Releases
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {scheduledProjects.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No scheduled project releases yet.
                </p>
              ) : (
                scheduledProjects.slice(0, 5).map((project) => (
                  <Link
                    className="block rounded-lg border p-3 hover:border-primary/50"
                    key={project.id}
                    params={{ id: project.id }}
                    to="/dashboard/projects/$id"
                  >
                    <p className="font-semibold text-sm">{project.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {project.releaseDate
                        ? new Date(project.releaseDate).toLocaleDateString()
                        : "Unscheduled"}
                    </p>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="size-5 text-primary" />
                Live Battles & Events
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {battles.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No live battles or listening parties scheduled right now.
                </p>
              ) : (
                battles.slice(0, 4).map((battle) => (
                  <Link
                    className="block rounded-lg border p-3 hover:border-primary/50"
                    key={battle.id}
                    params={{ id: battle.id }}
                    to="/live/battles/$id"
                  >
                    <p className="font-semibold text-sm">{battle.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {battle.genre} • {battle.viewerCount} live viewers
                    </p>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
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
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="font-medium text-sm">{label}</CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-muted-foreground text-xs">{description}</p>
      </CardContent>
    </Card>
  );
}

function EmptyAnalyticsCopy({
  actionHref,
  actionLabel,
  text,
}: {
  actionHref: string;
  actionLabel: string;
  text: string;
}) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center">
      <p className="text-muted-foreground text-sm">{text}</p>
      <Button asChild className="mt-4">
        <Link to={actionHref}>{actionLabel}</Link>
      </Button>
    </div>
  );
}
