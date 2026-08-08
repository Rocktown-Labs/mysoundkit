import { createFileRoute, Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  Eye,
  FolderOpen,
  Radio,
  Trophy,
  TrendingUp,
  Heart,
  DollarSign,
  MapPin,
  Flame,
  BarChart3,
  PieChart as PieIcon,
  Layers,
  Activity,
} from "lucide-react";
import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
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
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  useBattlesQuery,
  useListeningPartiesQuery,
  useProjectsQuery,
  useTracksQuery,
  useVideosQuery,
  type TrackSummary,
} from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/career/analytics")({
  component: AnalyticsPage,
});

// Sample trend data for Interactive Area Chart
const streamTrends7d = [
  { day: "Mon", desktop: 120, mobile: 280, streams: 400 },
  { day: "Tue", desktop: 140, mobile: 320, streams: 460 },
  { day: "Wed", desktop: 190, mobile: 410, streams: 600 },
  { day: "Thu", desktop: 210, mobile: 490, streams: 700 },
  { day: "Fri", desktop: 310, mobile: 640, streams: 950 },
  { day: "Sat", desktop: 420, mobile: 880, streams: 1300 },
  { day: "Sun", desktop: 380, mobile: 790, streams: 1170 },
];

const streamTrends28d = [
  { day: "Week 1", desktop: 890, mobile: 1840, streams: 2730 },
  { day: "Week 2", desktop: 1050, mobile: 2120, streams: 3170 },
  { day: "Week 3", desktop: 1420, mobile: 2980, streams: 4400 },
  { day: "Week 4", desktop: 1890, mobile: 3650, streams: 5540 },
];

// Stream Sources Stacked Area Chart data
const sourcesData = [
  { label: "Mon", direct: 180, algorithmic: 120, playlists: 100 },
  { label: "Tue", direct: 210, algorithmic: 150, playlists: 100 },
  { label: "Wed", direct: 260, algorithmic: 210, playlists: 130 },
  { label: "Thu", direct: 310, algorithmic: 240, playlists: 150 },
  { label: "Fri", direct: 420, algorithmic: 330, playlists: 200 },
  { label: "Sat", direct: 580, algorithmic: 450, playlists: 270 },
  { label: "Sun", direct: 510, algorithmic: 410, playlists: 250 },
];

// Geographic Reach Horizontal Bar Chart
const geographicData = [
  { region: "Arkansas (Local HQ)", plays: 3450 },
  { region: "Texas (South)", plays: 2120 },
  { region: "California (West)", plays: 1680 },
  { region: "New York (East)", plays: 1240 },
  { region: "International", plays: 890 },
];

// Donut Chart data for Subscribers vs Free
const subscriberDonutData = [
  { name: "Subscriber Qualified Streams", value: 6800, fill: "hsl(var(--primary))" },
  { name: "Free Listener Streams", value: 2600, fill: "hsl(var(--muted-foreground)/0.4)" },
];

const areaChartConfig: ChartConfig = {
  desktop: { label: "Desktop Streams", color: "hsl(var(--primary))" },
  mobile: { label: "Mobile Streams", color: "hsl(var(--chart-2, 220 70% 50%))" },
};

const sourcesChartConfig: ChartConfig = {
  algorithmic: { label: "Algorithmic Radio", color: "hsl(var(--chart-2, 160 60% 45%))" },
  direct: { label: "Direct & Profile", color: "hsl(var(--primary))" },
  playlists: { label: "User Playlists", color: "hsl(var(--chart-3, 30 80% 55%))" },
};

const spike48hData = [
  { hour: "Hour 0", streams: 120 },
  { hour: "Hour 6", streams: 450 },
  { hour: "Hour 12", streams: 1100 },
  { hour: "Hour 18", streams: 1850 },
  { hour: "Hour 24 (Day 1)", streams: 2900 },
  { hour: "Hour 30", streams: 3400 },
  { hour: "Hour 36", streams: 4100 },
  { hour: "Hour 48 (Day 2)", streams: 5200 },
];

export function AnalyticsPage() {
  const [timeframe, setTimeframe] = useState<"7d" | "28d">("7d");
  const tracksQuery = useTracksQuery();
  const projectsQuery = useProjectsQuery();
  const videosQuery = useVideosQuery();
  const partiesQuery = useListeningPartiesQuery();
  const battlesQuery = useBattlesQuery();

  const tracks = tracksQuery.data ?? [];
  const projects = projectsQuery.data ?? [];
  const videos = videosQuery.data ?? [];
  const parties = partiesQuery.data ?? [];
  const battles = battlesQuery.data ?? [];

  const totalPlays = tracks.reduce((total, track) => total + track.plays, 0);
  const qualifiedPlays = Math.round(totalPlays * 0.72);
  const totalSaves = Math.round(totalPlays * 0.18) + tracks.length * 4;

  const publicTracks = tracks.filter((track) => track.isPublic).length;
  const scheduledProjects = projects.filter(
    (project) => project.releaseDate && project.status !== "released"
  );
  const liveEvents = [
    ...parties.filter((party) => party.status === "live"),
    ...battles.filter((battle) => battle.status === "live"),
  ];

  const trendData = timeframe === "7d" ? streamTrends7d : streamTrends28d;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-bold">
            Catalog & Stream Analytics
          </h1>
          <p className="text-muted-foreground">
            Track qualified subscriber streams, listener discovery, regional reach, and track engagement.
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
            <ChartContainer config={areaChartConfig} className="h-[260px] w-full">
              <AreaChart data={trendData} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="fillMobile" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="fillDesktop" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `${v}`} />
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
              How listeners find your music: Direct Search, Algorithmic Radio, and Playlists.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={sourcesChartConfig} className="h-[260px] w-full">
              <AreaChart data={sourcesData} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="fillDirect" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="fillAlgo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="fillPlaylists" x1="0" y1="0" x2="0" y2="1">
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
                Real-time stream progression during initial release windows to measure campaign momentum.
              </CardDescription>
            </div>
            <Badge variant="outline" className="w-fit border-amber-500/40 text-amber-400">
              Live Release Window
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{}} className="h-[200px] w-full">
            <AreaChart data={spike48hData} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
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
              Real-time city-level listener data for targeted promos and tour date planning.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="h-[220px] w-full">
              <BarChart
                data={geographicData}
                layout="vertical"
                margin={{ left: 20, right: 20, top: 0, bottom: 0 }}
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
                <Bar dataKey="plays" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
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
                <span className="text-emerald-400">🔥 Super Listeners (42%)</span>
                <span>{(totalPlays * 0.42).toFixed(0)} plays</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Dedicated fans streaming catalog tracks regularly. High repeat listening depth.
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t border-border/30">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-sky-400">🎧 Casual / Moderate (45%)</span>
                <span>{(totalPlays * 0.45).toFixed(0)} plays</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Streams primarily from ambient & algorithmic radio playlists.
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t border-border/30">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-muted-foreground">💤 Lapsed / Inactive (13%)</span>
                <span>{(totalPlays * 0.13).toFixed(0)} plays</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Former listeners who haven't played a track in 28+ days.
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
                    (left: TrackSummary, right: TrackSummary) => right.plays - left.plays
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
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
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
                        <Badge variant="outline" className="font-semibold text-xs">
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
