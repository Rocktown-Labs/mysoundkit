import { createFileRoute } from "@tanstack/react-router";

import { TrackDetailPage } from "@/components/explore/track-detail-page";

export const Route = createFileRoute("/_explore/tracks/$regionSlug/$slug")({
  component: RegionSlugTrackPage,
});

function RegionSlugTrackPage() {
  const { slug } = Route.useParams();

  return <TrackDetailPage lookupId={slug} />;
}
