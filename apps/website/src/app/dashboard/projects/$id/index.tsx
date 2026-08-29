import { createFileRoute } from "@tanstack/react-router";

import { ProjectActivity } from "@/components/dashboard/project-activity";
import { ProjectDetails } from "@/components/dashboard/project-details";
import { ProjectFiles } from "@/components/dashboard/project-files";

export const Route = createFileRoute("/dashboard/projects/$id/")({
  component: ProjectDetailPage,
});

function ProjectDetailPage() {
  const { id } = Route.useParams();
  return (
    <div className="space-y-6">
      <ProjectDetails projectId={id} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ProjectFiles projectId={id} />
        </div>
        <div>
          <ProjectActivity projectId={id} />
        </div>
      </div>
    </div>
  );
}
