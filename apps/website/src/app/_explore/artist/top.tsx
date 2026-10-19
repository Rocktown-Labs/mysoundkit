import { createFileRoute } from "@tanstack/react-router";

import { ArtistListPage } from "@/components/explore/artist-list-page";

export const Route = createFileRoute("/_explore/artist/top")({
  component: TopArtistsPage,
});

function TopArtistsPage() {
  return (
    <ArtistListPage
      category="top"
      description="Most popular artists right now"
      title="Top Artists This Month"
    />
  );
}
