import { createFileRoute } from "@tanstack/react-router";
import { Music, FolderOpen, Users, Sparkles } from "lucide-react";

import { ProjectsOverview } from "@/components/dashboard/projects-overview";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import { UpcomingReleases } from "@/components/dashboard/upcoming-releases";
import { Button } from "@/components/ui/button";
import {
  useMeQuery,
  useProjectsQuery,
  useTracksQuery,
} from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardPage,
});

function DashboardPage() {
  const meQuery = useMeQuery();
  const tracksQuery = useTracksQuery();
  const projectsQuery = useProjectsQuery();
  const displayName =
    meQuery.data?.user.displayName ??
    meQuery.data?.user.username ??
    "SoundKit Artist";
  const firstName = displayName.split(" ")[0] ?? displayName;
  const tracks = tracksQuery.data ?? [];
  const projects = projectsQuery.data ?? [];
  const collaboratorCount = Math.max(
    ...tracks.map((track) => track.collaboratorCount),
    ...projects.map((project) => project.collaboratorCount),
    0
  );
  const upcomingReleases = projects.filter((project) => {
    if (!project.releaseDate) {
      return false;
    }

    return new Date(project.releaseDate).getTime() >= Date.now();
  });
  const projectTypeCounts: Record<string, number> = {};
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
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-primary font-semibold text-sm uppercase tracking-wider">
            <Sparkles className="size-4 fill-current" />
            <span>Artist Dashboard</span>
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

          {/* Quick Tips / Upgrade Card */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/5 to-transparent border border-primary/20 relative overflow-hidden group">
            <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-primary/20 rounded-full blur-3xl group-hover:bg-primary/30 transition-colors" />
            <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              Pro Artist Tip
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Verified music videos get 3x more engagement from the global
              SoundKit community. Link your YouTube or upload directly via Mux.
            </p>
            <Button
              size="sm"
              className="w-full bg-primary/10 hover:bg-primary/20 text-primary border-none shadow-none"
            >
              Explore Pro Features
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
