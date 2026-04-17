import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { NewProjectForm } from "@/components/dashboard/new-project-form";

export const Route = createFileRoute("/dashboard/projects/new")({
  component: NewProjectPage,
});

function NewProjectPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back Navigation */}
      <Link
        to="/dashboard/projects"
        className="inline-flex items-center space-x-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to Projects</span>
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-playfair)]">
          Create New Project
        </h1>
        <p className="text-muted-foreground">
          Set up a new music collaboration project
        </p>
      </div>

      {/* Form */}
      <NewProjectForm />
    </div>
  );
}
