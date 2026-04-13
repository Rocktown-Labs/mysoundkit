import { createFileRoute } from "@tanstack/react-router"
import { DashboardStats } from "@/components/dashboard/dashboard-stats"
import { ProjectsOverview } from "@/components/dashboard/projects-overview"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { UpcomingReleases } from "@/components/dashboard/upcoming-releases"

export const Route = createFileRoute('/dashboard/')({
  component: DashboardPage,
})

function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-[family-name:var(--font-playfair)]">Dashboard</h1>
          <p className="text-muted-foreground">Manage your music projects and collaborations</p>
        </div>
        <QuickActions />
      </div>

      {/* Stats Cards */}
      <DashboardStats />

      {/* Main Content */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <ProjectsOverview />
          <UpcomingReleases />
        </div>
        <div>
          <RecentActivity />
        </div>
      </div>
    </div>
  )
}
