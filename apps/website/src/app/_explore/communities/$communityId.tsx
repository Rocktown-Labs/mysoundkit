/* eslint-disable unicorn/filename-case */
import { createFileRoute } from "@tanstack/react-router";

import { CommunityExperience } from "@/components/community/community-experience";

export const Route = createFileRoute("/_explore/communities/$communityId")({
  component: CommunityDetailPage,
  ssr: false,
});

function CommunityDetailPage() {
  const { communityId } = Route.useParams();
  return (
    <main className="h-full min-h-0 w-full">
      <CommunityExperience backTo="/communities" communityId={communityId} />
    </main>
  );
}
