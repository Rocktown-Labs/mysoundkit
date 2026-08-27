"use client";

import { createFileRoute } from "@tanstack/react-router";

import { BattlePage } from "@/app/_explore/live/battles/$id";
import { LiveExperienceAuthGuard } from "@/components/dashboard/live-experience-auth-guard";

export const Route = createFileRoute(
  "/dashboard/live/battles/join/$roomId/artistview"
)({
  component: ArtistBattleRoomPage,
});

function ArtistBattleRoomPage() {
  const { roomId } = Route.useParams();

  return (
    <LiveExperienceAuthGuard
      actionLabel="enter your assigned live battle room"
      allowAdmin
      featureTitle="Artist Battle Room"
      requiredEntitlement="canCreateLiveBattles"
    >
      <BattlePage artistView roomId={roomId} />
    </LiveExperienceAuthGuard>
  );
}
