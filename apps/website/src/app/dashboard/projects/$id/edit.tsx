import { createFileRoute } from "@tanstack/react-router";
import { LoaderCircle } from "lucide-react";

import { NewProjectForm } from "@/components/dashboard/new-project-form";
import { useProjectQuery } from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/projects/$id/edit")({
  component: EditProjectPage,
});

function EditProjectPage() {
  const { id } = Route.useParams(),
    projectQuery = useProjectQuery(id),
    project = projectQuery.data;

  if (projectQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground">
        <LoaderCircle className="size-5 animate-spin" />
        Loading project details…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-playfair)]">
          Edit Project
        </h1>
        <p className="text-muted-foreground">
          Update your project details and artwork
        </p>
      </div>
      <NewProjectForm initialProject={project ?? null} projectId={id} />
    </div>
  );
}
