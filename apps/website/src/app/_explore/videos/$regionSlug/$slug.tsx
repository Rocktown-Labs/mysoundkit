import { createFileRoute } from "@tanstack/react-router";

import { VideoDetailPage } from "@/components/explore/video-detail-page";

export const Route = createFileRoute("/_explore/videos/$regionSlug/$slug")({
  component: RegionSlugVideoPage,
});

function RegionSlugVideoPage() {
  const { slug } = Route.useParams();

  return <VideoDetailPage lookupId={slug} />;
}
