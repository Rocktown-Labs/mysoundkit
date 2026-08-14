import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, FolderOpen, Music, Sparkles, Users } from "lucide-react";

import { ProjectsOverview } from "@/components/dashboard/projects-overview";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import { UpcomingReleases } from "@/components/dashboard/upcoming-releases";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { API_V1_URL } from "@/lib/api";
import {
  useMeEntitlementsQuery,
  useMeQuery,
  useProjectsQuery,
  useTracksQuery,
} from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardPage,
});

function DashboardPage() {
  const meQuery = useMeQuery(),
   entitlementsQuery = useMeEntitlementsQuery(),
   tracksQuery = useTracksQuery(),
   projectsQuery = useProjectsQuery(),
   entitlements = entitlementsQuery.data,
   isPremium = Boolean(entitlements?.isPremium),
   sellerStatusQuery = useQuery({
    enabled: isPremium,
    queryFn: async () => {
      const response = await fetch(`${API_V1_URL}/seller/status`, {
        credentials: "include",
      });
      if (!response.ok) {
        return null;
      }
      return (await response.json()) as { onboardingStatus: string };
    },
    queryKey: ["seller", "status"],
  }),
   needsPaymentsSetup =
    isPremium && sellerStatusQuery.data?.onboardingStatus !== "enabled",
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
      {needsPaymentsSetup ? (
        <Alert className="border-primary/30 bg-primary/5">
          <BadgeCheck className="size-4" />
          <AlertTitle>Finish setting up artist payments</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>
              Connect with Stripe before fans can purchase your releases or send
              tips.
            </span>
            <Button asChild size="sm">
              <Link to="/dashboard/career/payments">Set up payments</Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

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
          <Link to="/dashboard/billing">Manage Premium</Link>
        ) : (
          <Link to="/pricing">Explore Premium</Link>
        )}
      </Button>
    </div>
  );
}
