/* eslint-disable one-var, sort-vars, complexity, no-nested-ternary, unicorn/no-nested-ternary, react/todo */
"use client";

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  BarChart3,
  ExternalLink,
  Globe,
  Headphones,
  LoaderCircle,
  Users,
} from "lucide-react";
import React, { useEffect, useState } from "react";

import {
  buildSoundKitWebUrl,
  getCurrentSessionUser,
  loadBioAnalyticsOverview,
  loadBioAnalyticsSources,
  loadBioAnalyticsTimeseries,
} from "@/lib/api";
import type {
  BioAnalyticsOverview,
  BioAnalyticsSources,
  BioAnalyticsTimeseries,
  BioCurrentUser,
} from "@/lib/api";

export const Route = createFileRoute("/dashboard/analytics")({
  component: BioAnalyticsPage,
});

function BioAnalyticsPage() {
  const [currentUser, setCurrentUser] = useState<BioCurrentUser | null>(null);
  const [overview, setOverview] = useState<BioAnalyticsOverview | null>(null);
  const [timeseries, setTimeseries] = useState<BioAnalyticsTimeseries | null>(
    null
  );
  const [sources, setSources] = useState<BioAnalyticsSources | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

        const [overviewData, timeseriesData, sourcesData] = await Promise.all([
          loadBioAnalyticsOverview(),
          loadBioAnalyticsTimeseries(),
          loadBioAnalyticsSources(),
        ]);
        if (!cancelled) {
          setOverview(overviewData);
          setTimeseries(timeseriesData);
          setSources(sourcesData);
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
    sortedSources = sources?.sources ?? [];

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

      <section className="min-w-0 rounded-3xl border border-border/50 bg-card/40 p-6 shadow-md backdrop-blur-xl sm:p-8 space-y-6">
        <div>
          <h2 className="font-semibold text-lg text-foreground">
            Discovery Sources
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Where verified playback sessions entered your catalog.
          </p>
        </div>

        {sortedSources.length > 0 ? (
          <div className="space-y-4">
            {sortedSources.map((source) => (
              <div className="space-y-2" key={source.sourceType}>
                <div className="flex min-w-0 items-center justify-between gap-3 text-xs font-semibold">
                  <span className="flex min-w-0 items-center gap-2 text-foreground">
                    <Globe className="size-4 shrink-0 text-primary" />
                    <span className="truncate">{source.label}</span>
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {source.count.toLocaleString()} ({source.percentage}%)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, source.percentage)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyData message="Discovery sources will appear after your first verified plays." />
        )}
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
