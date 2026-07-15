import { createFileRoute } from "@tanstack/react-router";
import { Trophy } from "lucide-react";

import { ArtistListPage } from "@/components/explore/artist-list-page";

export const Route = createFileRoute("/_explore/artist/top")({
  component: TopArtistsPage,
});

function TopArtistsPage() {
  return (
    <ArtistListPage
      category="top"
      description="Most popular artists right now"
      icon={Trophy}
      title="Top Artists This Month"
    />
  );
}
