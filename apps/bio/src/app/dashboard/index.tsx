/* eslint-disable one-var, sort-vars, complexity, no-nested-ternary, unicorn/no-nested-ternary, react/todo */
"use client";

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Check,
  Copy,
  ExternalLink,
  HandCoins,
  LoaderCircle,
  Sparkles,
} from "lucide-react";
import React, { useEffect, useState } from "react";

import {
  buildSoundKitWebUrl,
  getCurrentSessionUser,
  loadBioAnalyticsOverview,
  loadBioArtistEarnings,
  loadBioTips,
  SOUNDKIT_BIO_URL,
} from "@/lib/api";
import type {
  BioAnalyticsOverview,
  BioArtistEarnings,
  BioCurrentUser,
  BioTipsOverview,
} from "@/lib/api";

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

  const username = currentUser?.username ?? "artist",
    bioUrl = `${SOUNDKIT_BIO_URL}/${encodeURIComponent(username)}`,
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
    totalTipsCents = tips?.totalTipsCents ?? 0,
    supporterCount = tips?.supporterCount ?? 0;

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

      {/* Live dashboard summaries */}
      <div className="grid min-w-0 grid-cols-1 gap-6 md:grid-cols-2">
        <DashboardSummaryCard
          description="Verified playback sessions across your catalog."
          icon={<BarChart3 className="size-5 text-primary" />}
          isLoading={isDataLoading}
          items={[
            {
              label: "Verified Plays",
              value: (analytics?.totalPlays ?? 0).toLocaleString(),
            },
            {
              label: "Unique Listeners",
              value: (analytics?.uniqueListeners ?? 0).toLocaleString(),
            },
          ]}
          linkLabel="View analytics"
          linkTo="/dashboard/analytics"
          title="Bio Analytics"
        />
        <DashboardSummaryCard
          description="Fan tips sent directly to your Bio page."
          icon={<HandCoins className="size-5 text-primary" />}
          isLoading={isDataLoading}
          items={[
            { label: "Total Tips", value: formatDollars(totalTipsCents) },
            { label: "Supporters", value: supporterCount.toLocaleString() },
          ]}
          linkLabel="View payments"
          linkTo="/dashboard/payments"
          title="Bio Tips & Payouts"
        />
      </div>

      {earnings ? (
        <p className="text-center text-xs text-muted-foreground">
          Estimated creator earnings this month:{" "}
          {formatDollars(earnings.estimatedThisMonthCents)}
        </p>
      ) : null}
    </div>
  );
}

function DashboardSummaryCard({
  description,
  icon,
  isLoading,
  items,
  linkLabel,
  linkTo,
  title,
}: {
  description: string;
  icon: React.ReactNode;
  isLoading: boolean;
  items: { label: string; value: string }[];
  linkLabel: string;
  linkTo: "/dashboard/analytics" | "/dashboard/payments";
  title: string;
}) {
  return (
    <div className="min-w-0 rounded-3xl border border-border/50 bg-card/40 p-6 shadow-md backdrop-blur-xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 font-semibold text-foreground">
          {icon}
          <span className="truncate">{title}</span>
        </div>
        <Link
          className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-primary hover:underline"
          to={linkTo}
        >
          <span className="hidden sm:inline">{linkLabel}</span>
          <span className="sm:hidden">View</span>
          <ChevronRight className="size-3.5" />
        </Link>
      </div>

      <p className="text-xs text-muted-foreground">{description}</p>

      <div className="grid grid-cols-2 gap-3 pt-2">
        {items.map((item) => (
          <div
            className="min-w-0 rounded-2xl border border-border/40 bg-white/5 p-4 text-center"
            key={item.label}
          >
            <p className="truncate text-xs text-muted-foreground">
              {item.label}
            </p>
            <p className="mt-1 truncate font-playfair text-2xl font-bold text-foreground">
              {isLoading ? "—" : item.value}
            </p>
          </div>
        ))}
      </div>
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

function ChevronRight(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      fill="none"
      height="24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="24"
      {...props}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
