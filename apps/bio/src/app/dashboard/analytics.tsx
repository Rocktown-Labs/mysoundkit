/* eslint-disable one-var, sort-vars, complexity, no-nested-ternary, unicorn/no-nested-ternary, react/todo */
"use client";

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  BarChart3,
  Check,
  Compass,
  Copy,
  ExternalLink,
  Globe,
  Headphones,
  Link2,
  LoaderCircle,
  MapPin,
  Share2,
  Users,
} from "lucide-react";
import React, { useEffect, useState } from "react";

import { BioMap } from "@/components/bio-map";
import {
  InstagramIcon,
  TikTokIcon,
  TwitterIcon,
  YoutubeIcon,
} from "@/components/ui/brand-icons";
import {
  buildSoundKitWebUrl,
  getCurrentSessionUser,
  loadBioAnalyticsLocations,
  loadBioAnalyticsOverview,
  loadBioAnalyticsSources,
  loadBioAnalyticsTimeseries,
  toBioShareUrl,
} from "@/lib/api";
import type {
  BioAnalyticsLocations,
  BioAnalyticsOverview,
  BioAnalyticsSources,
  BioAnalyticsTimeseries,
  BioCurrentUser,
} from "@/lib/api";
import type { MapScope } from "@/lib/map-scopes";

export const Route = createFileRoute("/dashboard/analytics")({
  component: BioAnalyticsPage,
});

const getSourceMeta = (st: string, label: string) => {
  const lower = `${st} ${label}`.toLowerCase();
  if (lower.includes("instagram")) {
    return { barColor: "bg-[#E4405F]", icon: InstagramIcon };
  }
  if (lower.includes("tiktok")) {
    return { barColor: "bg-[#25F4EE]", icon: TikTokIcon };
  }
  if (
    lower.includes("twitter") ||
    lower.includes(" x ") ||
    lower.startsWith("x ")
  ) {
    return { barColor: "bg-zinc-200", icon: TwitterIcon };
  }
  if (lower.includes("youtube")) {
    return { barColor: "bg-[#FF0000]", icon: YoutubeIcon };
  }
  if (st === "share" || lower.includes("share")) {
    return { barColor: "bg-emerald-400", icon: Share2 };
  }
  if (st === "artist_profile") {
    return { barColor: "bg-primary", icon: Users };
  }
  if (st === "external_deep_link" || lower.includes("link")) {
    return { barColor: "bg-purple-400", icon: Link2 };
  }
  return { barColor: "bg-blue-400", icon: Globe };
};

function BioAnalyticsPage() {
  const [currentUser, setCurrentUser] = useState<BioCurrentUser | null>(null);
  const [overview, setOverview] = useState<BioAnalyticsOverview | null>(null);
  const [timeseries, setTimeseries] = useState<BioAnalyticsTimeseries | null>(
    null
  );
  const [sources, setSources] = useState<BioAnalyticsSources | null>(null);
  const [locations, setLocations] = useState<BioAnalyticsLocations | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mapScope, setMapScope] = useState<MapScope>("usa");
  const [selectedRegion, setSelectedRegion] = useState("Arkansas");
  const [activeBreakdownTab, setActiveBreakdownTab] = useState<
    "states" | "platforms"
  >("states");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchAnalytics = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const user = await getCurrentSessionUser();
        if (cancelled) {
          return;
        }
        setCurrentUser(user);
        if (!user || user.accountType !== "artist") {
          return;
        }

        const [overviewData, timeseriesData, sourcesData, locationsData] =
          await Promise.all([
            loadBioAnalyticsOverview(),
            loadBioAnalyticsTimeseries(),
            loadBioAnalyticsSources(),
            loadBioAnalyticsLocations(),
          ]);
        if (!cancelled) {
          setOverview(overviewData);
          setTimeseries(timeseriesData);
          setSources(sourcesData);
          setLocations(locationsData);
          if (locationsData.regions.length > 0) {
            setSelectedRegion(locationsData.regions[0].regionName);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "We could not load your analytics."
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void fetchAnalytics();
    return () => {
      cancelled = true;
    };
  }, []);

  const fullAnalyticsUrl = buildSoundKitWebUrl("/dashboard/career/analytics"),
    points = timeseries?.points ?? [],
    maxPointValue = Math.max(1, ...points.map((point) => point.value)),
    username = currentUser?.username ?? "artist",
    bioUrl = toBioShareUrl(username),
    copyBioLink = () => {
      if (typeof window !== "undefined") {
        void navigator.clipboard.writeText(bioUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
      }
    },
    sortedRegions = locations?.regions ?? [],
    maxRegionPlays = Math.max(1, ...sortedRegions.map((r) => r.plays)),
    selectedRegionClean = selectedRegion?.trim().toLowerCase(),
    selectedRegionFound = selectedRegionClean
      ? sortedRegions.find(
          (r) =>
            r.regionName.toLowerCase() === selectedRegionClean ||
            r.regionCode.toLowerCase() === selectedRegionClean
        )
      : null,
    selectedRegionMetrics = selectedRegionClean
      ? (selectedRegionFound ?? {
          countryCode: "US",
          listeners: 0,
          percentage: 0,
          plays: 0,
          regionCode: selectedRegionClean,
          regionName: selectedRegion ?? "",
        })
      : null,
    rawSources = sources?.sources,
    platformBreakdown =
      rawSources && rawSources.length > 0
        ? rawSources.map((source, index) => {
            const meta = getSourceMeta(source.sourceType, source.label);
            return {
              badge:
                index === 0 && source.percentage >= 25 ? "Top Source" : null,
              barColor: meta.barColor,
              count: source.count,
              handle:
                source.sourceType === "artist_profile"
                  ? `@${username}`
                  : source.label,
              icon: meta.icon,
              name: source.label,
              share: source.percentage,
            };
          })
        : [];

  if (isLoading) {
    return <DashboardLoading label="Loading your analytics…" />;
  }

  if (!currentUser || currentUser.accountType !== "artist") {
    return (
      <DashboardMessage description="Sign in with an artist account to view analytics." />
    );
  }

  return (
    <div className="mx-auto min-w-0 w-full max-w-5xl overflow-x-clip px-4 py-8 sm:px-6 sm:py-12 space-y-8">
      <div>
        <Link
          className="group inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          to="/dashboard"
        >
          <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-1" />
          <span>Back to Dashboard</span>
        </Link>
      </div>

      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-playfair text-3xl font-medium text-foreground sm:text-4xl">
            Bio Analytics
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Verified catalog playback and audience discovery from your SoundKit
            account.
          </p>
        </div>

        <a
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-border/60 bg-card/60 px-4 py-2 text-xs font-semibold text-foreground transition-all hover:bg-card"
          href={fullAnalyticsUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          <span>Advanced Web Analytics</span>
          <ExternalLink className="size-3.5" />
        </a>
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AnalyticsStat
          description="30-second verified playback sessions"
          icon={<Headphones className="size-4" />}
          label="Verified Plays"
          value={overview?.totalPlays ?? 0}
        />
        <AnalyticsStat
          description="Streams meeting reward qualification rules"
          icon={<BarChart3 className="size-4" />}
          label="Qualified Streams"
          value={overview?.totalQualifiedStreams ?? 0}
        />
        <AnalyticsStat
          description="Distinct listener accounts reached"
          icon={<Users className="size-4" />}
          label="Unique Listeners"
          value={overview?.uniqueListeners ?? 0}
        />
        <AnalyticsStat
          description="Current artist profile followers"
          icon={<Users className="size-4" />}
          label="Followers"
          value={overview?.totalFollowers ?? 0}
        />
      </div>

      <section className="min-w-0 rounded-3xl border border-border/50 bg-card/40 p-6 shadow-md backdrop-blur-xl sm:p-8 space-y-6">
        <div>
          <h2 className="font-semibold text-lg text-foreground">
            Verified Plays Over Time
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Daily verified playback sessions for the last 7 days.
          </p>
        </div>

        {points.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-7">
            {points.map((point) => (
              <div className="min-w-0 space-y-2" key={point.date}>
                <div className="flex h-32 items-end rounded-xl bg-white/5 p-2">
                  <div
                    aria-label={`${point.value} verified plays on ${point.label}`}
                    className="w-full rounded-lg bg-primary transition-all"
                    style={{
                      height: `${Math.max(4, (point.value / maxPointValue) * 100)}%`,
                    }}
                  />
                </div>
                <p className="truncate text-center font-mono text-[10px] text-muted-foreground">
                  {point.label}
                </p>
                <p className="text-center text-sm font-bold text-foreground">
                  {point.value.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyData message="Verified playback will appear here once fans start listening." />
        )}
      </section>

      {/* Bio Audience Map & Geographic / Platform Attribution Breakdown */}
      <section className="min-w-0 space-y-6 rounded-3xl border border-border/50 bg-card/40 p-5 shadow-md backdrop-blur-xl sm:p-8">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
              <Compass className="size-4" />
              <span>Bio audience map</span>
            </div>
            <h2 className="mt-1 font-playfair text-2xl font-medium text-foreground sm:text-3xl">
              Where your listeners find you
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              Explore the regional discovery corridors connected to your
              SoundKit Bio.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
              <MapPin className="size-3" />
              <span>{selectedRegion || "Global"}</span>
            </span>
          </div>
        </div>

        <BioMap
          mapScope={mapScope}
          onRegionSelect={setSelectedRegion}
          onScopeChange={(scope) => {
            setMapScope(scope);
            setSelectedRegion(
              scope === "usa" ? "Arkansas" : scope === "canada" ? "Ontario" : ""
            );
          }}
          selectedRegion={selectedRegion}
        />

        {/* Actionable Audience Breakdown Panel */}
        <div className="space-y-5 rounded-2xl border border-border/40 bg-white/[0.03] p-5 sm:p-6">
          {/* Header with View Selector Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/40 pb-4">
            <div>
              <h3 className="font-semibold text-base text-foreground">
                {activeBreakdownTab === "states"
                  ? "Regional Plays by State"
                  : "Platform Referrals & Bio Clicks"}
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {activeBreakdownTab === "states"
                  ? "Real-time state and territorial playback distribution from your listeners."
                  : "Social network and external platform referrals driving fans to your bio."}
              </p>
            </div>

            {/* Toggle Switch */}
            <div className="flex items-center gap-1 rounded-xl border border-border/50 bg-white/5 p-1">
              <button
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  activeBreakdownTab === "states"
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveBreakdownTab("states")}
                type="button"
              >
                <MapPin className="size-3.5" />
                <span>Plays by State</span>
              </button>
              <button
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  activeBreakdownTab === "platforms"
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveBreakdownTab("platforms")}
                type="button"
              >
                <Globe className="size-3.5" />
                <span>Platform Referrals</span>
              </button>
            </div>
          </div>

          {activeBreakdownTab === "states" ? (
            <div className="space-y-5">
              {/* Selected State Highlight Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <MapPin className="size-4 text-primary shrink-0" />
                    <h4 className="font-bold text-sm text-foreground truncate">
                      {selectedRegion || "Selected Territory"}
                    </h4>
                    {selectedRegionMetrics &&
                    selectedRegionMetrics.plays > 0 ? (
                      <span className="rounded-full border border-primary/40 bg-primary/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                        Active Market
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selectedRegionMetrics && selectedRegionMetrics.plays > 0
                      ? `${selectedRegionMetrics.plays.toLocaleString()} verified ${
                          selectedRegionMetrics.plays === 1 ? "play" : "plays"
                        } (${selectedRegionMetrics.percentage}% of audience) across ${selectedRegionMetrics.listeners.toLocaleString()} unique ${
                          selectedRegionMetrics.listeners === 1
                            ? "listener"
                            : "listeners"
                        }.`
                      : `No verified plays recorded in ${
                          selectedRegion || "this territory"
                        } yet. Click other states on the map or promote your bio to reach fans here.`}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <div className="text-right">
                    <p className="font-mono text-lg font-bold text-foreground">
                      {(selectedRegionMetrics?.plays ?? 0).toLocaleString()}
                    </p>
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                      Verified Plays
                    </p>
                  </div>
                </div>
              </div>

              {/* Ranked States Leaderboard Chart */}
              {sortedRegions.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground px-1">
                    <span>Ranked Territories</span>
                    <span>Verified Plays (% Audience)</span>
                  </div>
                  <div className="space-y-2">
                    {sortedRegions.map((region, idx) => {
                      const isSelected =
                        selectedRegion?.toLowerCase() ===
                          region.regionName.toLowerCase() ||
                        selectedRegion?.toLowerCase() ===
                          region.regionCode.toLowerCase();
                      return (
                        <button
                          aria-label={`Select ${region.regionName} playback metrics`}
                          className={`group w-full rounded-xl border p-3 text-left transition-all ${
                            isSelected
                              ? "border-primary/50 bg-primary/10 shadow-sm"
                              : "border-border/30 bg-white/[0.02] hover:border-border/60 hover:bg-white/[0.05]"
                          }`}
                          key={region.regionCode}
                          onClick={() => setSelectedRegion(region.regionName)}
                          type="button"
                        >
                          <div className="flex items-center justify-between gap-3 text-xs font-semibold">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="font-mono text-muted-foreground w-4 text-[11px]">
                                #{idx + 1}
                              </span>
                              <span
                                className={`truncate font-bold ${
                                  isSelected
                                    ? "text-primary"
                                    : "text-foreground"
                                }`}
                              >
                                {region.regionName}
                              </span>
                              {region.countryCode &&
                              region.countryCode !== "US" ? (
                                <span className="text-[10px] text-muted-foreground uppercase">
                                  ({region.countryCode})
                                </span>
                              ) : null}
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-mono text-xs font-bold text-foreground">
                                {region.plays.toLocaleString()}{" "}
                                {region.plays === 1 ? "play" : "plays"}
                              </span>
                              <span className="text-muted-foreground text-[11px] ml-1.5">
                                ({region.percentage}%)
                              </span>
                            </div>
                          </div>
                          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isSelected
                                  ? "bg-primary"
                                  : "bg-primary/60 group-hover:bg-primary"
                              }`}
                              style={{
                                width: `${Math.max(
                                  4,
                                  Math.min(
                                    100,
                                    (region.plays / maxRegionPlays) * 100
                                  )
                                )}%`,
                              }}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border/60 bg-white/[0.01] p-6 text-center">
                  <MapPin className="mx-auto size-7 text-muted-foreground/60" />
                  <h4 className="mt-2 text-sm font-semibold text-foreground">
                    No state playback records yet
                  </h4>
                  <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                    Plays will automatically categorize by state and region as
                    listeners tune in from your SoundKit Bio URL.
                  </p>
                  <div className="mt-4 flex justify-center">
                    <button
                      className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-card/60 px-3.5 py-1.5 text-xs font-semibold text-foreground shadow-sm transition-all hover:border-primary/40 hover:bg-card"
                      onClick={copyBioLink}
                      type="button"
                    >
                      {copied ? (
                        <>
                          <Check className="size-3.5 text-emerald-400" />
                          <span>Copied Bio Link</span>
                        </>
                      ) : (
                        <>
                          <Copy className="size-3.5" />
                          <span>Copy Bio Link to Share</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {platformBreakdown.length > 0 ? (
                platformBreakdown.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      className="rounded-2xl border border-border/40 bg-white/[0.03] p-4 transition-colors hover:bg-white/[0.05]"
                      key={item.name}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/5 border border-border/40 text-foreground">
                            <Icon className="size-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm text-foreground truncate">
                                {item.name}
                              </p>
                              {item.badge ? (
                                <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                                  {item.badge}
                                </span>
                              ) : null}
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {item.handle}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-mono text-xs font-bold text-foreground">
                            {item.count.toLocaleString()}{" "}
                            {item.count === 1 ? "play" : "plays"}
                          </span>
                          <span className="text-[11px] text-muted-foreground ml-1.5">
                            ({item.share}%)
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/5">
                        <div
                          className={`h-full rounded-full ${item.barColor} transition-all duration-500`}
                          style={{ width: `${item.share}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-xl border border-dashed border-border/60 bg-white/[0.01] p-6 text-center">
                  <Globe className="mx-auto size-7 text-muted-foreground/60" />
                  <h4 className="mt-2 text-sm font-semibold text-foreground">
                    No platform referral traffic yet
                  </h4>
                  <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                    Add your SoundKit Bio URL to your Instagram, TikTok, and X
                    bios to route fans directly to 24-bit lossless streaming.
                  </p>
                  <div className="mt-4 flex justify-center">
                    <button
                      className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-card/60 px-3.5 py-1.5 text-xs font-semibold text-foreground shadow-sm transition-all hover:border-primary/40 hover:bg-card"
                      onClick={copyBioLink}
                      type="button"
                    >
                      {copied ? (
                        <>
                          <Check className="size-3.5 text-emerald-400" />
                          <span>Copied Bio Link</span>
                        </>
                      ) : (
                        <>
                          <Copy className="size-3.5" />
                          <span>Copy Bio Link to Share</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Conversion Pro-Tip */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-4">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-primary">
                    ★ Boost Regional &amp; Social Conversion
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Pin your SoundKit Bio link in top social channels to convert
                    casual viewers into verified listeners and direct
                    supporters.
                  </p>
                </div>
                <button
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow transition-all hover:opacity-90 active:scale-95"
                  onClick={copyBioLink}
                  type="button"
                >
                  {copied ? (
                    <>
                      <Check className="size-3.5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" />
                      <span>Copy Bio URL</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function AnalyticsStat({
  description,
  icon,
  label,
  value,
}: {
  description: string;
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-border/50 bg-card/40 p-5 shadow-md backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <div className="shrink-0 rounded-xl bg-primary/10 p-2 text-primary">
          {icon}
        </div>
      </div>
      <p className="mt-2 truncate font-playfair text-3xl font-bold text-foreground">
        {value.toLocaleString()}
      </p>
      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function EmptyData({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/60 bg-white/[0.02] p-8 text-center text-xs text-muted-foreground">
      {message}
    </div>
  );
}

function DashboardLoading({ label }: { label: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6 text-sm text-muted-foreground">
      <LoaderCircle className="mr-2 size-4 animate-spin text-primary" />
      {label}
    </div>
  );
}

function DashboardMessage({ description }: { description: string }) {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center px-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <BarChart3 className="size-7" />
      </div>
      <h1 className="mt-5 font-playfair text-3xl font-medium text-foreground">
        Analytics unavailable
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
