import { createFileRoute } from "@tanstack/react-router";

import { NewTrackForm } from "@/components/dashboard/new-track-form";

export const Route = createFileRoute("/dashboard/tracks/$id/edit")({
  component: EditTrackPage,
});

function EditTrackPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-playfair)]">
          Edit Track
        </h1>
        <p className="text-muted-foreground">
          Update your track details and files
        </p>
      </div>
      <NewTrackForm />
    </div>
  );
}
