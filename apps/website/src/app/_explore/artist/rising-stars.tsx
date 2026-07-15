import { createFileRoute } from "@tanstack/react-router";
import { TrendingUp } from "lucide-react";

import { ArtistListPage } from "@/components/explore/artist-list-page";

export const Route = createFileRoute("/_explore/artist/rising-stars")({
  component: RisingStarsPage,
});

function RisingStarsPage() {
  return (
    <ArtistListPage
      category="rising"
      description="Artists on the rise with growing momentum"
      icon={TrendingUp}
      title="Rising Stars"
    />
  );
}
