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
    <main className="px-4 py-6 md:px-6 lg:px-8">
      <CommunityExperience communityId={communityId} />
    </main>
  );
}
