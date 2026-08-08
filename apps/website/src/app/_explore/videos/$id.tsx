import { createFileRoute } from "@tanstack/react-router";

import { VideoDetailPage } from "@/components/explore/video-detail-page";

export const Route = createFileRoute("/_explore/videos/$id")({
  component: LegacyVideoPage,
});

function LegacyVideoPage() {
  const { id } = Route.useParams();

  return <VideoDetailPage lookupId={id} />;
}
