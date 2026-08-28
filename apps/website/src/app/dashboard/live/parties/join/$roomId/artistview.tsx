"use client";

import { createFileRoute } from "@tanstack/react-router";

import { ListeningPartyPage } from "@/app/_explore/live/parties/$id";
import { LiveExperienceAuthGuard } from "@/components/dashboard/live-experience-auth-guard";

export const Route = createFileRoute(
  "/dashboard/live/parties/join/$roomId/artistview"
)({
  component: ArtistListeningPartyRoomPage,
});

function ArtistListeningPartyRoomPage() {
  const { roomId } = Route.useParams();

  return (
    <LiveExperienceAuthGuard
      actionLabel="enter your listening party artist room"
      allowAdmin
      allowFreeArtist
      featureTitle="Artist Listening Party Room"
      requiredEntitlement="canHostLiveStreams"
    >
      <ListeningPartyPage artistView roomId={roomId} />
    </LiveExperienceAuthGuard>
  );
}
