import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  Check,
  Copy,
  ExternalLink,
  FolderOpen,
  Music,
  Share2,
  Sparkles,
  Users,
} from "lucide-react";
import { useState } from "react";

import { PremiumActivationCard } from "@/components/billing/premium-activation-card";
import { ProjectsOverview } from "@/components/dashboard/projects-overview";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import { UpcomingReleases } from "@/components/dashboard/upcoming-releases";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useMeEntitlementsQuery,
  useMeQuery,
  useProjectsQuery,
  useTracksQuery,
} from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardPage,
  validateSearch: (
    search: Record<string, unknown>
  ): { upgraded?: boolean } => ({
    upgraded:
      search.upgraded === "1" || search.upgraded === true ? true : undefined,
  }),
});

function DashboardPage() {
  const { upgraded } = Route.useSearch(),
    meQuery = useMeQuery(),
    entitlementsQuery = useMeEntitlementsQuery(),
    tracksQuery = useTracksQuery(),
    projectsQuery = useProjectsQuery(),
    entitlements = entitlementsQuery.data,
    isPremium = Boolean(entitlements?.isPremium),
    activePlanLabel = entitlements?.activePlanCode
      ? entitlements.activePlanCode.replaceAll("_", " ")
      : "SoundKit Free",
    displayName =
      meQuery.data?.user.displayName ??
      meQuery.data?.user.username ??
      "SoundKit Artist",
    firstName = displayName.split(" ")[0] ?? displayName,
    tracks = tracksQuery.data ?? [],
    projects = projectsQuery.data ?? [],
    collaboratorCount = Math.max(
      ...tracks.map((track) => track.collaboratorCount),
      ...projects.map((project) => project.collaboratorCount),
      0
    ),
    upcomingReleases = projects.filter((project) => {
      if (!project.releaseDate) {
        return false;
      }

      return new Date(project.releaseDate).getTime() >= Date.now();
    }),
    projectTypeCounts: Record<string, number> = {};
  for (const project of projects) {
    projectTypeCounts[project.projectType] =
      (projectTypeCounts[project.projectType] ?? 0) + 1;
  }
  const dashboardStats = [
    {
      description: tracksQuery.isLoading
        ? "Loading your catalog"
        : "From your track library",
      icon: Music,
      title: "Total Tracks",
      value: String(tracks.length),
    },
    {
      description: `${projectTypeCounts.album ?? 0} Albums, ${projectTypeCounts.ep ?? 0} EPs`,
      icon: FolderOpen,
      title: "Active Projects",
      value: String(projects.length),
    },
    {
      description: "Credited across tracks and projects",
      icon: Users,
      title: "Collaborators",
      value: String(collaboratorCount),
    },
    {
      description: "Scheduled projects",
      icon: Sparkles,
      title: "Upcoming Releases",
      value: String(upcomingReleases.length),
    },
  ];

  return (
    <div className="space-y-8 pb-8">
      {upgraded ? <PremiumActivationCard accountType="artist" /> : null}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-primary font-semibold text-sm uppercase tracking-wider">
            <Sparkles className="size-4 fill-current" />
            <span>Artist Dashboard</span>
            {isPremium ? (
              <Badge variant="outline" className="gap-1 normal-case">
                <BadgeCheck className="size-3.5 text-primary" />
                SoundKit Premium
              </Badge>
            ) : null}
          </div>
          <h1 className="text-4xl font-bold font-[family-name:var(--font-playfair)] tracking-tight">
            Welcome back,{" "}
            <span className="text-foreground/80">{firstName}</span>
          </h1>
          <p className="text-muted-foreground">
            You have {collaboratorCount} active collaborators and{" "}
            {upcomingReleases.length} upcoming releases in your catalog.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <QuickActions />
        </div>
      </div>

      {meQuery.data?.user.accountType === "artist" ? (
        <BioLinkCard username={meQuery.data.user.username} />
      ) : null}

      {/* Stats Cards */}
      <StatsGrid stats={dashboardStats} />

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column - 8/12 */}
        <div className="lg:col-span-8 space-y-6">
          <ProjectsOverview
            isLoading={projectsQuery.isLoading}
            projects={projects}
          />
          <UpcomingReleases projects={projects} />
        </div>

        {/* Right Column - 4/12 */}
        <div className="lg:col-span-4 space-y-6">
          <RecentActivity projects={projects} tracks={tracks} />

          <PremiumStatusCard
            activePlanLabel={activePlanLabel}
            isPremium={isPremium}
          />
        </div>
      </div>
    </div>
  );
}

function BioLinkCard({ username }: { username: string }) {
  const [copied, setCopied] = useState(false),
    [shared, setShared] = useState(false),
    bioUrl = `https://soundkit.bio/${encodeURIComponent(username)}`,
    copyBioLink = async () => {
      try {
        await navigator.clipboard.writeText(bioUrl);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2200);
      } catch {
        setCopied(false);
      }
    },
    shareBioLink = async () => {
      if (typeof navigator.share === "function") {
        try {
          await navigator.share({
            title: "My SoundKit Bio",
            url: bioUrl,
          });
          setShared(true);
          window.setTimeout(() => setShared(false), 2200);
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }
        }
      }

      await copyBioLink();
    };

  return (
    <section className="space-y-4 rounded-3xl border border-border/50 bg-card/40 p-6 shadow-md backdrop-blur-xl sm:p-8">
      <div>
        <h2 className="font-semibold text-base text-foreground">
          Your Official Bio Link
        </h2>
        <p className="mt-2 text-xs text-muted-foreground">
          Paste this link in your Instagram, TikTok, and X profiles.
        </p>
      </div>

      <div className="flex min-w-0 flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <a
          className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-border/60 bg-white/5 px-4 py-3 font-mono text-xs text-primary transition-colors hover:border-primary/50 sm:text-sm"
          href={bioUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          <span className="block truncate">{bioUrl}</span>
        </a>
        <button
          aria-label={copied ? "Bio link copied" : "Copy Bio link"}
          className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-white/10 px-6 font-semibold text-xs text-foreground transition-colors hover:bg-white/15"
          onClick={copyBioLink}
          type="button"
        >
          {copied ? (
            <>
              <Check aria-hidden="true" className="size-4 text-primary" />
              <span className="font-bold text-primary">Copied!</span>
            </>
          ) : (
            <>
              <Copy aria-hidden="true" className="size-4" />
              <span>Copy Link</span>
            </>
          )}
        </button>
        <button
          aria-label={shared ? "Bio link shared" : "Share Bio link"}
          className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 px-5 font-semibold text-xs text-primary transition-colors hover:border-primary/50 hover:bg-primary/20"
          onClick={shareBioLink}
          type="button"
        >
          {shared ? (
            <>
              <Check aria-hidden="true" className="size-4" />
              <span className="font-bold">Shared!</span>
            </>
          ) : (
            <>
              <Share2 aria-hidden="true" className="size-4" />
              <span>Share Link</span>
            </>
          )}
        </button>
      </div>

      <a
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        href={bioUrl}
        rel="noopener noreferrer"
        target="_blank"
      >
        <span>View your Bio link</span>
        <ExternalLink aria-hidden="true" className="size-3.5" />
      </a>
    </section>
  );
}

function PremiumStatusCard({
  activePlanLabel,
  isPremium,
}: {
  activePlanLabel: string;
  isPremium: boolean;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent p-6">
      <div className="absolute top-[-20%] right-[-10%] h-32 w-32 rounded-full bg-primary/20 blur-3xl transition-colors group-hover:bg-primary/30" />
      <h3 className="mb-2 flex items-center gap-2 font-bold text-lg">
        {isPremium ? (
          <BadgeCheck className="size-5 text-primary" />
        ) : (
          <Sparkles className="size-5 text-primary" />
        )}
        {isPremium ? "Premium Active" : "Pro Artist Tip"}
      </h3>
      <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
        {isPremium
          ? `${activePlanLabel} is active on this account. Your premium artist tools are available across live, video, and release workflows.`
          : "Verified music videos get more engagement from the global SoundKit community. Upgrade when you are ready to unlock premium artist workflows."}
      </p>
      <Button
        asChild
        size="sm"
        className="w-full border-none bg-primary/10 text-primary shadow-none hover:bg-primary/20"
      >
        {isPremium ? (
          <Link to="/library/settings">Manage Premium</Link>
        ) : (
          <Link to="/pricing">Explore Premium</Link>
        )}
      </Button>
    </div>
  );
}
