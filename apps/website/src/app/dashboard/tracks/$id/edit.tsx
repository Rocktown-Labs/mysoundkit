import { createFileRoute } from "@tanstack/react-router";
import { LoaderCircle } from "lucide-react";

import { NewTrackForm } from "@/components/dashboard/new-track-form";
import { useTrackQuery } from "@/lib/soundkit-api-hooks";

export const Route = createFileRoute("/dashboard/tracks/$id/edit")({
  component: EditTrackPage,
});

function EditTrackPage() {
  const { id } = Route.useParams();
  const trackQuery = useTrackQuery(id);
  const track = trackQuery.data;

  if (trackQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground">
        <LoaderCircle className="size-5 animate-spin" />
        Loading track details…
      </div>
    );
  }

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
      <NewTrackForm initialTrack={track ?? null} trackId={id} />
    </div>
  );
}
