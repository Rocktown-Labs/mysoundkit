/* eslint-disable one-var, sort-vars, complexity, no-nested-ternary, unicorn/no-nested-ternary, react/todo */
"use client";

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Check,
  Compass,
  Copy,
  ExternalLink,
  HandCoins,
  LoaderCircle,
  MapPin,
  Music,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { BioMap } from "@/components/bio-map";
import {
  buildSoundKitWebUrl,
  getCurrentSessionUser,
  loadBioAnalyticsOverview,
  loadBioArtistEarnings,
  loadBioTips,
  loadRegionArtists,
  toBioShareUrl,
} from "@/lib/api";
import type {
  BioAnalyticsOverview,
  BioArtistEarnings,
  BioCurrentUser,
  BioTipsOverview,
} from "@/lib/api";
import { exploreRegionSlug, regionTypeForMapScope } from "@/lib/explore-region";
import type { MapScope } from "@/lib/map-scopes";

export const Route = createFileRoute("/dashboard/")({
  component: BioArtistDashboard,
});

const formatDollars = (amountCents: number) =>
  `$${(amountCents / 100).toFixed(2)}`;

function BioArtistDashboard() {
  const [currentUser, setCurrentUser] = useState<BioCurrentUser | null>(null);
  const [analytics, setAnalytics] = useState<BioAnalyticsOverview | null>(null);
  const [earnings, setEarnings] = useState<BioArtistEarnings | null>(null);
  const [tips, setTips] = useState<BioTipsOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [mapScope, setMapScope] = useState<MapScope>("usa");
  const [selectedRegion, setSelectedRegion] = useState("Arkansas");
  const [regionalArtists, setRegionalArtists] = useState<
    { id: string; name: string; username: string }[]
  >([]);
  const [isRegionLoading, setIsRegionLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchDashboard = async () => {
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

        setIsDataLoading(true);
        const [overview, artistEarnings, tipOverview] = await Promise.all([
          loadBioAnalyticsOverview(),
          loadBioArtistEarnings(),
          loadBioTips(),
        ]);
        if (!cancelled) {
          setAnalytics(overview);
          setEarnings(artistEarnings);
          setTips(tipOverview);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "We could not load your dashboard data."
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsDataLoading(false);
        }
      }
    };

    void fetchDashboard();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadArtists = async () => {
      setIsRegionLoading(true);
      try {
        const slug = exploreRegionSlug(selectedRegion),
          apiRegion = selectedRegion
            ? mapScope === "usa"
              ? `us-${slug}`
              : slug
            : mapScope === "global"
              ? "all"
              : mapScope,
          artists = await loadRegionArtists(
            apiRegion,
            regionTypeForMapScope(mapScope)
          );
        if (!cancelled) {
          setRegionalArtists(
            artists.map(({ id, name, username }) => ({ id, name, username }))
          );
        }
      } catch {
        if (!cancelled) {
          setRegionalArtists([]);
        }
      } finally {
        if (!cancelled) {
          setIsRegionLoading(false);
        }
      }
    };

    void loadArtists();
    return () => {
      cancelled = true;
    };
  }, [mapScope, selectedRegion]);

  const username = currentUser?.username ?? "artist",
    bioUrl = toBioShareUrl(username),
    fullWebDashboardUrl = buildSoundKitWebUrl("/dashboard"),
    copyBioLink = () => {
      if (typeof window !== "undefined") {
        void navigator.clipboard.writeText(bioUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
      }
    };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6 text-sm text-muted-foreground">
        <LoaderCircle className="mr-2 size-4 animate-spin text-primary" />
        Loading your Bio dashboard…
      </div>
    );
  }

  if (!currentUser) {
    return (
      <DashboardMessage
        actionHref={buildSoundKitWebUrl("/login")}
        actionLabel="Sign in to continue"
        description="Sign in with your SoundKit account to access your artist Bio dashboard."
        title="Your Bio dashboard is private"
      />
    );
  }

  if (currentUser.accountType !== "artist") {
    return (
      <DashboardMessage
        actionHref={buildSoundKitWebUrl("/dashboard")}
        actionLabel="Open SoundKit dashboard"
        description="Bio dashboards are for artist accounts. Use your SoundKit dashboard to manage this listener account."
        title="This is a fan account"
      />
    );
  }

  const isClaimed = Boolean(currentUser.onboardingCompletedAt),
    totalTipsCents = tips?.totalTipsCents ?? 0;

  return (
    <div className="mx-auto min-w-0 w-full max-w-5xl overflow-x-clip px-4 py-8 sm:px-6 sm:py-12 space-y-8">
      {/* Welcome Header */}
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
            Artist Bio Hub
          </span>
          <h1 className="mt-2 break-words font-playfair text-3xl font-medium text-foreground sm:text-4xl">
            Welcome back, {currentUser.displayName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your link in bio, check tips, and monitor page performance.
          </p>
        </div>

        <Link
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-border/60 bg-card/60 px-4 py-2 text-xs font-semibold text-foreground shadow-sm transition-all hover:border-primary/40 hover:bg-card"
          params={{ username }}
          to="/$username"
        >
          <span>View Public Bio</span>
          <ExternalLink className="size-3.5" />
        </Link>
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      {/* Setup or claimed-account status */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/40 bg-card/60 p-6 shadow-xl backdrop-blur-xl sm:p-8">
        <div className="flex min-w-0 flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-primary">
              <Sparkles className="size-4" />
              <span>{isClaimed ? "Artist Bio is live" : "Finish setup"}</span>
            </div>
            <h2 className="font-playfair text-2xl font-medium text-foreground sm:text-3xl">
              {isClaimed
                ? `Your soundkit.bio/${username} page is ready`
                : "Finish setting up your artist account"}
            </h2>
            <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
              {isClaimed
                ? "Your claimed profile is connected to this account. Manage your catalog, payouts, and creator tools from SoundKit Web."
                : "Your Bio link is reserved. Complete artist onboarding on SoundKit Web to publish your profile and connect your catalog."}
            </p>
          </div>

          <a
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:scale-105 hover:opacity-90 active:scale-95"
            href={fullWebDashboardUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            <span>{isClaimed ? "Manage on SoundKit" : "Complete setup"}</span>
            <ArrowRight className="size-4" />
          </a>
        </div>
      </div>

      {/* Shareable Bio Link Card */}
      <div className="rounded-3xl border border-border/50 bg-card/40 p-6 shadow-md backdrop-blur-xl sm:p-8 space-y-4">
        <h3 className="font-semibold text-base text-foreground">
          Your Official Bio Link
        </h3>
        <p className="text-xs text-muted-foreground">
          Paste this link in your Instagram, TikTok, and X profiles.
        </p>

        <div className="flex min-w-0 flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-border/60 bg-white/5 px-4 py-3 font-mono text-xs text-primary sm:text-sm">
            <span className="block truncate">{bioUrl}</span>
          </div>

          <button
            className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-white/10 px-6 font-semibold text-xs text-foreground transition-all hover:bg-white/15"
            onClick={copyBioLink}
            type="button"
          >
            {copied ? (
              <>
                <Check className="size-4 text-primary" />
                <span className="font-bold text-primary">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="size-4" />
                <span>Copy Link</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Bio activity summary */}
      <section className="space-y-6">
        <div className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4">
          <DashboardStatCard
            icon={<BarChart3 className="size-4" />}
            isLoading={isDataLoading}
            label="Bio plays"
            value={analytics?.totalPlays ?? 0}
          />
          <DashboardStatCard
            icon={<Music className="size-4" />}
            isLoading={isDataLoading}
            label="Listeners"
            value={analytics?.uniqueListeners ?? 0}
          />
          <DashboardStatCard
            icon={<UserRound className="size-4" />}
            isLoading={isDataLoading}
            label="Followers"
            value={analytics?.totalFollowers ?? 0}
          />
          <DashboardStatCard
            icon={<HandCoins className="size-4" />}
            isLoading={isDataLoading}
            label="Tips"
            value={formatDollars(totalTipsCents)}
          />
        </div>

        <section className="min-w-0 space-y-5 rounded-3xl border border-border/50 bg-card/40 p-5 shadow-md sm:p-7">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
                <Compass className="size-4" />
                <span>Bio audience</span>
              </div>
              <h2 className="mt-1 font-playfair text-2xl font-medium text-foreground sm:text-3xl">
                Where your listeners find you
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                Explore the artists and listeners connected to your Bio
                discovery regions.
              </p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {selectedRegion || "Global"}
            </span>
          </div>

          <BioMap
            mapScope={mapScope}
            onRegionSelect={setSelectedRegion}
            onScopeChange={(scope) => {
              setMapScope(scope);
              setSelectedRegion(
                scope === "usa"
                  ? "Arkansas"
                  : scope === "canada"
                    ? "Ontario"
                    : ""
              );
            }}
            selectedRegion={selectedRegion}
          />

          <div className="rounded-2xl border border-border/40 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {selectedRegion
                  ? `Artists in ${selectedRegion}`
                  : "Artists in this view"}
              </h3>
              {isRegionLoading ? (
                <LoaderCircle className="size-4 animate-spin text-primary" />
              ) : (
                <span className="text-xs text-muted-foreground">
                  {regionalArtists.length} found
                </span>
              )}
            </div>
            {regionalArtists.length > 0 ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {regionalArtists.slice(0, 6).map((artist) => (
                  <Link
                    className="flex min-w-0 items-center gap-2 rounded-xl border border-border/40 px-3 py-2 text-xs transition-colors hover:border-primary/40 hover:bg-white/5"
                    key={artist.id}
                    params={{ username: artist.username }}
                    to="/$username"
                  >
                    <MapPin className="size-3 shrink-0 text-primary" />
                    <span className="truncate font-semibold text-foreground">
                      {artist.name}
                    </span>
                  </Link>
                ))}
              </div>
            ) : isRegionLoading ? null : (
              <p className="mt-3 text-xs text-muted-foreground">
                No artists are listed in this region yet.
              </p>
            )}
          </div>
        </section>
      </section>

      {earnings ? (
        <p className="text-center text-xs text-muted-foreground">
          Estimated creator earnings this month:{" "}
          {formatDollars(earnings.estimatedThisMonthCents)}
        </p>
      ) : null}
    </div>
  );
}

function DashboardStatCard({
  icon,
  isLoading,
  label,
  value,
}: {
  icon: ReactNode;
  isLoading: boolean;
  label: string;
  value: number | string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-border/50 bg-card/40 p-4 shadow-md sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {icon}
        </span>
      </div>
      <p className="mt-3 truncate font-playfair text-2xl font-bold text-foreground sm:text-3xl">
        {isLoading
          ? "—"
          : typeof value === "number"
            ? value.toLocaleString()
            : value}
      </p>
    </div>
  );
}

function DashboardMessage({
  actionHref,
  actionLabel,
  description,
  title,
}: {
  actionHref: string;
  actionLabel: string;
  description: string;
  title: string;
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center px-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Sparkles className="size-7" />
      </div>
      <h1 className="mt-5 font-playfair text-3xl font-medium text-foreground">
        {title}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      <a
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-md transition-opacity hover:opacity-90"
        href={actionHref}
      >
        <span>{actionLabel}</span>
        <ArrowRight className="size-3.5" />
      </a>
    </div>
  );
}
