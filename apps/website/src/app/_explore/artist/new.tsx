import { createFileRoute } from "@tanstack/react-router";

import { ArtistListPage } from "@/components/explore/artist-list-page";

export const Route = createFileRoute("/_explore/artist/new")({
  component: NewArtistsPage,
});

function NewArtistsPage() {
  return (
    <ArtistListPage
      category="new"
      description="Fresh talent just joined the platform"
      title="New Artists"
    />
  );
}
