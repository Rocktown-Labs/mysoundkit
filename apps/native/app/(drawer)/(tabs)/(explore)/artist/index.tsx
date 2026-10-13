import { useLocalSearchParams } from "expo-router";

import { ArtistCard } from "@/components/cards/artist-card";
import { NativeCollectionGrid } from "@/components/native-collection-grid";
import { NativePageScreen } from "@/components/native-page-screen";
import { useArtistsQuery } from "@/lib/soundkit-api";

export default function ArtistsScreen() {
  const params = useLocalSearchParams<{ region?: string }>(),
    region = params.region ?? "all",
    regionType =
      region === "all" ? ("global" as const) : ("north-america" as const),
    artists = useArtistsQuery({
      category: "top",
      limit: 24,
      region,
      regionType,
      sort: "rank-asc",
    });

  return (
    <NativePageScreen
      description="Artist profiles and rising talent."
      title="Artists"
    >
      <NativeCollectionGrid
        empty="No artists are live for this view yet."
        items={artists.data ?? []}
        keyForItem={(artist) => artist.username}
        renderItem={(artist) => <ArtistCard artist={artist} />}
        isLoading={artists.isLoading}
      />
    </NativePageScreen>
  );
}
