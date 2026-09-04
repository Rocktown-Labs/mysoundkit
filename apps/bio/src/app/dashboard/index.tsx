/* eslint-disable one-var, sort-vars, complexity, no-nested-ternary, unicorn/no-nested-ternary, react/todo */
"use client";

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Globe,
  HandCoins,
  Link2,
  LoaderCircle,
  Music,
  Share2,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import {
  InstagramIcon,
  TikTokIcon,
  TwitterIcon,
  YoutubeIcon,
} from "@/components/ui/brand-icons";
import {
  buildSoundKitWebUrl,
  getCurrentSessionUser,
  loadBioAnalyticsOverview,
  loadBioAnalyticsSources,
  loadBioArtistEarnings,
  loadBioTips,
  toBioShareUrl,
} from "@/lib/api";
import type {
  BioAnalyticsOverview,
  BioAnalyticsSources,
  BioArtistEarnings,
  BioCurrentUser,
  BioTipsOverview,
} from "@/lib/api";

export const Route = createFileRoute("/dashboard/")({
  component: BioArtistDashboard,
});

const formatDollars = (amountCents: number) =>
  `$${(amountCents / 100).toFixed(2)}`;

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
    return { barColor: "bg-primary", icon: UserRound };
  }
  if (st === "external_deep_link" || lower.includes("link")) {
    return { barColor: "bg-purple-400", icon: Link2 };
  }
  return { barColor: "bg-blue-400", icon: Globe };
};

function BioArtistDashboard() {
  const [currentUser, setCurrentUser] = useState<BioCurrentUser | null>(null);
  const [analytics, setAnalytics] = useState<BioAnalyticsOverview | null>(null);
  const [earnings, setEarnings] = useState<BioArtistEarnings | null>(null);
  const [tips, setTips] = useState<BioTipsOverview | null>(null);
  const [sourcesData, setSourcesData] = useState<BioAnalyticsSources | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
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
        const [overview, artistEarnings, tipOverview, sources] =
          await Promise.all([
            loadBioAnalyticsOverview(),
            loadBioArtistEarnings(),
            loadBioTips(),
            loadBioAnalyticsSources(),
          ]);
        if (!cancelled) {
          setAnalytics(overview);
          setEarnings(artistEarnings);
          setTips(tipOverview);
          setSourcesData(sources);
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

  const username = currentUser?.username ?? "artist",
    bioUrl = toBioShareUrl(username),
    fullWebDashboardUrl = buildSoundKitWebUrl("/dashboard"),
    copyBioLink = () => {
      if (typeof window !== "undefined") {
        void navigator.clipboard.writeText(bioUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
      }
    },
    sources = sourcesData?.sources,
    platformBreakdown = useMemo(() => {
      if (!sources || sources.length === 0) {
        return [];
      }
      return sources.map((source, index) => {
        const meta = getSourceMeta(source.sourceType, source.label);
        return {
          badge: index === 0 && source.percentage >= 25 ? "Top Source" : null,
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
      });
    }, [sources, username]);

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
    <div className="mx-auto min-w-0 w-full max-w-7xl overflow-x-clip px-4 py-8 sm:px-6 lg:px-8 sm:py-12 space-y-8">
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

        <section className="min-w-0 space-y-6 rounded-3xl border border-border/50 bg-card/40 p-5 shadow-md backdrop-blur-xl sm:p-7">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
                <Globe className="size-4" />
                <span>Link-In-Bio Traffic</span>
              </div>
              <h2 className="mt-1 font-playfair text-2xl font-medium text-foreground sm:text-3xl">
                Social Referrals &amp; Audience Breakdown
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                Where fans click to reach your SoundKit Bio from your social
                profiles.
              </p>
            </div>
            <Link
              className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
              to="/dashboard/analytics"
            >
              <span>Audience Map &amp; Full Stats</span>
              <ChevronRight className="size-3.5" />
            </Link>
          </div>

          <div className="space-y-3.5">
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
              <div className="rounded-2xl border border-dashed border-border/60 bg-white/[0.02] p-8 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-border/40 bg-white/5 text-muted-foreground">
                  <Globe className="size-6" />
                </div>
                <h3 className="mt-3 text-sm font-semibold text-foreground">
                  No referral traffic recorded yet
                </h3>
                <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                  Share your SoundKit Bio URL on social platforms and link
                  aggregators to start tracking referral sources and plays.
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

          {/* Bio Optimization Pro-Tip Banner */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-4">
            <div className="space-y-1">
              <p className="text-xs font-bold text-primary">
                ★ Maximize Your Link-In-Bio Conversions
              </p>
              <p className="text-xs text-muted-foreground">
                Paste your URL in Instagram, TikTok, and X bios to route fans
                directly to 24-bit lossless streaming and tips.
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
