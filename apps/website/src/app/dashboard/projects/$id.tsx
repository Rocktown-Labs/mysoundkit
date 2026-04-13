import { createFileRoute } from "@tanstack/react-router"
import { ProjectDetails } from "@/components/dashboard/project-details"
import { ProjectFiles } from "@/components/dashboard/project-files"
import { ProjectActivity } from "@/components/dashboard/project-activity"

export const Route = createFileRoute('/dashboard/projects/$id')({
  component: ProjectDetailPage,
})

function ProjectDetailPage() {
  const { id } = Route.useParams()
  return (
    <div className="space-y-6">
      <ProjectDetails projectId={id} />
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ProjectFiles projectId={id} />
        </div>
        <div>
          <ProjectActivity projectId={id} />
        </div>
      </div>
    </div>
  )
}
