import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { NewProjectForm } from "@/components/dashboard/new-project-form";

export const Route = createFileRoute("/dashboard/projects/new")({
  component: NewProjectPage,
});

function NewProjectPage() {
  return <NewProjectForm />;
}
