import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  Award,
  CircleDollarSign,
  Compass,
  Crown,
  Globe2,
  Headphones,
  Info,
  MapPin,
  Music,
  PlayCircle,
  Radio,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { canonicalGenreName } from "@/lib/music-genres";
import {
  useAnalyticsAudienceQuery,
  useAnalyticsLiveImpactQuery,
  useAnalyticsLocationsQuery,
  useAnalyticsOverviewQuery,
  useAnalyticsSourcesQuery,
  useAnalyticsTimeseriesQuery,
  useAnalyticsTracksQuery,
} from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/career/analytics")({
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const [timeseriesMetric, setTimeseriesMetric] = useState<
      "plays" | "qualified_streams" | "unique_listeners"
    >("plays"),
    [timeseriesRange, setTimeseriesRange] = useState<
      "7d" | "28d" | "90d" | "12m"
    >("7d"),
    overviewQuery = useAnalyticsOverviewQuery(),
    timeseriesQuery = useAnalyticsTimeseriesQuery(
      timeseriesMetric,
      timeseriesRange
    ),
    tracksQuery = useAnalyticsTracksQuery(),
    audienceQuery = useAnalyticsAudienceQuery(),
    sourcesQuery = useAnalyticsSourcesQuery(),
    locationsQuery = useAnalyticsLocationsQuery(),
    liveImpactQuery = useAnalyticsLiveImpactQuery(),
    overview = overviewQuery.data,
    timeseries = timeseriesQuery.data,
    tracks = tracksQuery.data?.tracks ?? [],
    audience = audienceQuery.data,
    sources = sourcesQuery.data?.sources ?? [],
    locations = locationsQuery.data?.locations ?? [],
    liveImpact = liveImpactQuery.data,
    hasLocationData = locationsQuery.data?.hasEnoughData ?? false;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
            <Activity className="size-3.5" />
            Verified Catalog Telemetry
          </div>
          <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-bold mt-1">
            Artist Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Persisted playback metrics, qualified Creator Reward streams, and
            audience discovery data.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="font-semibold">
          <Link to="/dashboard/tracks">Manage Catalog</Link>
        </Button>
      </div>

      {/* Top 4 Primary KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. Plays */}
        <Card className="border-border/40 bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              30s+ Plays
            </CardTitle>
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Headphones className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight">
              {(overview?.totalPlays ?? 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
              <span>≥ 30s verified playback sessions</span>
            </p>
          </CardContent>
        </Card>

        {/* 2. Qualified Streams */}
        <Card className="border-border/40 bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Qualified Streams
            </CardTitle>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <Crown className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight text-amber-400">
              {(overview?.totalQualifiedStreams ?? 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
              <span>Premium listens meeting reward qualification rules</span>
            </p>
          </CardContent>
        </Card>

        {/* 3. Unique Listeners */}
        <Card className="border-border/40 bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Unique Listeners
            </CardTitle>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <Users className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight text-emerald-400">
              {(overview?.uniqueListeners ?? 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
              <span>Distinct listener accounts reached</span>
            </p>
          </CardContent>
        </Card>

        {/* 4. Estimated Earnings */}
        <Card className="border-border/40 bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <div className="flex items-center gap-1.5">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Month-to-Date
              </CardTitle>
              <Badge
                variant="outline"
                className="text-[10px] py-0 px-1 border-primary/30 text-primary"
              >
                Estimated
              </Badge>
            </div>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
              <CircleDollarSign className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight text-purple-400">
              ${((overview?.estimatedEarningsCents ?? 0) / 100).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
              <Link
                to="/dashboard/career/payments"
                className="text-primary hover:underline flex items-center gap-0.5"
              >
                Creator Rewards & Sales →
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Primary Listening Over Time Chart */}
      <Card className="border-border/40 bg-card/50">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg font-bold">
              Listening Over Time
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Exact event aggregation across all catalog tracks. Zero-filled for
              inactive dates.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Metric Switcher */}
            <Tabs
              value={timeseriesMetric}
              onValueChange={(val) =>
                setTimeseriesMetric(
                  val as "plays" | "qualified_streams" | "unique_listeners"
                )
              }
            >
              <TabsList className="bg-muted/60 h-8">
                <TabsTrigger value="plays" className="text-xs px-2.5">
                  Plays
                </TabsTrigger>
                <TabsTrigger
                  value="qualified_streams"
                  className="text-xs px-2.5"
                >
                  Qualified Streams
                </TabsTrigger>
                <TabsTrigger
                  value="unique_listeners"
                  className="text-xs px-2.5"
                >
                  Unique Listeners
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Range Switcher */}
            <Tabs
              value={timeseriesRange}
              onValueChange={(val) =>
                setTimeseriesRange(val as "7d" | "28d" | "90d" | "12m")
              }
            >
              <TabsList className="bg-muted/60 h-8">
                <TabsTrigger value="7d" className="text-xs px-2">
                  7D
                </TabsTrigger>
                <TabsTrigger value="28d" className="text-xs px-2">
                  28D
                </TabsTrigger>
                <TabsTrigger value="90d" className="text-xs px-2">
                  90D
                </TabsTrigger>
                <TabsTrigger value="12m" className="text-xs px-2">
                  12M
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] w-full pt-4">
            {timeseriesQuery.isError ? (
              <div className="flex h-full items-center justify-center text-xs text-destructive">
                Unable to load listening analytics. Please try again.
              </div>
            ) : timeseries && timeseries.points.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={timeseries.points}
                  margin={{ bottom: 0, left: -20, right: 10, top: 10 }}
                >
                  <defs>
                    <linearGradient
                      id="chartGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="var(--chart-1)"
                        stopOpacity={0.4}
                      />
                      <stop
                        offset="95%"
                        stopColor="var(--chart-1)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    stroke="#71717a"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#71717a"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) {
                        return null;
                      }
                      const data = payload[0]?.payload as {
                        date: string;
                        label: string;
                        value: number;
                      };
                      return (
                        <div className="rounded-lg border border-border/50 bg-background/95 p-2 shadow-xl backdrop-blur-sm text-xs">
                          <div className="font-semibold">{data.date}</div>
                          <div className="text-primary mt-0.5">
                            {data.value.toLocaleString()}{" "}
                            {timeseriesMetric === "qualified_streams"
                              ? "Qualified Streams"
                              : timeseriesMetric === "unique_listeners"
                                ? "Unique Listeners"
                                : "Plays"}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#chartGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                Not enough data yet for this time range.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Track Performance Breakdown */}
      <Card className="border-border/40 bg-card/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold">
                Track Performance
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Per-track breakdown of verified plays, completion rates,
                qualification ratios, and rewards.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="font-mono text-xs">
              {tracks.length} {tracks.length === 1 ? "Track" : "Tracks"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {tracksQuery.isError ? (
            <div className="py-12 text-center text-xs text-destructive">
              Unable to load track analytics. Please try again.
            </div>
          ) : tracks.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No tracks uploaded yet.{" "}
              <Link
                to="/dashboard/tracks/new"
                className="text-primary hover:underline"
              >
                Upload your first track →
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/40 text-muted-foreground pb-2">
                    <th className="py-2.5 font-semibold">Track</th>
                    <th className="py-2.5 font-semibold text-right">Plays</th>
                    <th className="py-2.5 font-semibold text-right">
                      Qualified Streams
                    </th>
                    <th className="py-2.5 font-semibold text-right">
                      Unique Listeners
                    </th>
                    <th className="py-2.5 font-semibold text-right">
                      Qualification Rate
                    </th>
                    <th className="py-2.5 font-semibold text-right">
                      Avg Listen %
                    </th>
                    <th className="py-2.5 font-semibold text-right">
                      Completion Rate
                    </th>
                    <th className="py-2.5 font-semibold text-right">
                      Est. Rewards
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {tracks.map((t) => (
                    <tr
                      key={t.trackId}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-3 pr-4 font-medium">
                        <div className="flex items-center gap-2.5 min-w-[200px]">
                          <div className="size-8 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                            {t.coverArtUrl ? (
                              <AppImage
                                src={t.coverArtUrl}
                                alt={t.title}
                                layout="constrained"
                                width={32}
                                height={32}
                                className="size-full object-cover"
                              />
                            ) : (
                              <Music className="size-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold truncate text-foreground">
                              {t.title}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {canonicalGenreName(t.genre)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-semibold">
                        {t.plays.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-semibold text-amber-400">
                        {t.qualifiedStreams.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-muted-foreground">
                        {t.uniqueListeners.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right font-mono">
                        <Badge
                          variant="outline"
                          className="text-[10px] py-0 border-amber-500/30 text-amber-400"
                        >
                          {t.qualificationRate}%
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-right font-mono">
                        {t.averageListenPercent}%
                      </td>
                      <td className="py-3 px-3 text-right font-mono">
                        {t.completionRate}%
                      </td>
                      <td className="py-3 pl-3 text-right font-mono font-bold text-purple-400">
                        ${(t.estimatedEarningsCents / 100).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audience, Discovery & Live Impact Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* 1. Audience Demographics & Retention */}
        <Card className="border-border/40 bg-card/50">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Users className="size-4 text-primary" />
              Audience & Loyalty
            </CardTitle>
            <CardDescription className="text-xs">
              Measured listener return rates and catalog discovery depth.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">
                  Returning Listener Rate
                </span>
                <span className="font-bold font-mono">
                  {audience?.returningListenerRate ?? 0}%
                </span>
              </div>
              <Progress
                value={audience?.returningListenerRate ?? 0}
                className="h-1.5"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-xl border border-border/30 bg-muted/20 text-center">
                <div className="text-xl font-bold font-mono text-emerald-400">
                  {audience?.newListeners ?? 0}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  New Listeners
                </div>
              </div>
              <div className="p-3 rounded-xl border border-border/30 bg-muted/20 text-center">
                <div className="text-xl font-bold font-mono text-primary">
                  {audience?.returningListeners ?? 0}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Returning Listeners
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-border/20 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Catalog Depth:</span>
                <span className="font-semibold">
                  {audience?.catalogDepth ?? 0} tracks / listener
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">
                  Funded Supporters:
                </span>
                <span className="font-semibold text-amber-400">
                  {audience?.premiumSupporters ?? 0} funded members
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. Discovery Sources */}
        <Card className="border-border/40 bg-card/50">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Compass className="size-4 text-primary" />
              Discovery Sources
            </CardTitle>
            <CardDescription className="text-xs">
              Where listeners discover and play your tracks.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {sources.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No discovery source sessions recorded yet.
              </div>
            ) : (
              sources.map((s) => (
                <div key={s.sourceType} className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-foreground font-medium">
                      {s.label}
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {s.count.toLocaleString()} ({s.percentage}%)
                    </span>
                  </div>
                  <Progress value={s.percentage} className="h-1.5" />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* 3. Live Impact & Geography */}
        <Card className="border-border/40 bg-card/50">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Zap className="size-4 text-amber-500" />
              Live Impact
            </CardTitle>
            <CardDescription className="text-xs">
              Audience acquisition through Battles and Listening Parties.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl border border-border/30 bg-muted/20 text-center">
                <div className="text-xl font-bold font-mono text-amber-400">
                  {liveImpact?.listenersReached ?? 0}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Live Listeners Reached
                </div>
              </div>
              <div className="p-3 rounded-xl border border-border/30 bg-muted/20 text-center">
                <div className="text-xl font-bold font-mono text-primary">
                  {liveImpact?.tracksPlayedInLive ?? 0}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Live Track Plays
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-border/20">
              <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <Globe2 className="size-3.5 text-primary" />
                Audience Geography
              </h4>
              {hasLocationData ? (
                <div className="space-y-2">
                  {locations.slice(0, 3).map((loc, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-muted-foreground truncate max-w-[150px]">
                        {loc.city ? `${loc.city}, ` : ""}
                        {loc.regionCode || loc.countryCode}
                      </span>
                      <span className="font-mono">
                        {loc.listeners} ({loc.percentage}%)
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-muted/30 border border-border/30 text-[11px] text-muted-foreground leading-relaxed">
                  <Info className="size-3.5 inline mr-1 text-primary" />
                  Not enough location data yet. Minimum sample threshold
                  required to protect listener privacy.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
