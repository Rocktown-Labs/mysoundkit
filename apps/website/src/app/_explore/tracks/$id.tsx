import { createFileRoute } from "@tanstack/react-router";

import { TrackDetailPage } from "@/components/explore/track-detail-page";

export const Route = createFileRoute("/_explore/tracks/$id")({
  component: LegacyTrackPage,
});

function LegacyTrackPage() {
  const { id } = Route.useParams();

  return <TrackDetailPage lookupId={id} />;
}
