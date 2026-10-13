import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { TrackCard } from "@/components/cards/track-card";
import {
  NativeCollectionGrid,
  NativeEmptyState,
} from "@/components/native-collection-grid";
import { NativePageScreen } from "@/components/native-page-screen";
import { NativeRail } from "@/components/native-rail";
import { NativeSection } from "@/components/native-section";
import { NAV_THEME } from "@/lib/constants";
import {
  useGenresQuery,
  useTracksInfiniteQuery,
  useTracksQuery,
} from "@/lib/soundkit-api";
import type { TrackSummary } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

const styles = StyleSheet.create({
    sectionGap: { gap: 28 },
    sortText: { fontSize: 13 },
  }),
  SORT_OPTIONS = ["plays-desc", "date-desc", "title-asc"] as const,
  SORT_LABELS: Record<(typeof SORT_OPTIONS)[number], string> = {
    "date-desc": "Newest",
    "plays-desc": "Most played",
    "title-asc": "A–Z",
  };

export default function TracksScreen() {
  const params = useLocalSearchParams<{ region?: string; sort?: string }>(),
    region = params.region ?? "all",
    regionType =
      region === "all" ? ("global" as const) : ("north-america" as const),
    { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    [sort, setSort] = useState<string>(params.sort ?? "plays-desc"),
    tracks = useTracksInfiniteQuery({
      limit: 24,
      region,
      regionType,
      scope: "public",
      sort,
    }),
    allTracks = tracks.data?.pages.flat() ?? [],
    genres = useGenresQuery(),
    featured = useTracksQuery({
      limit: 12,
      region,
      regionType,
      scope: "public",
      sort: "plays-desc",
    }),
    cycleSort = () => {
      const index = SORT_OPTIONS.indexOf(sort as (typeof SORT_OPTIONS)[number]);
      setSort(SORT_OPTIONS[(index + 1) % SORT_OPTIONS.length]);
    };

  return (
    <NativePageScreen
      description="Browse songs by sound, scene, and region."
      title="Songs"
    >
      <View style={styles.sectionGap}>
        <NativeSection
          description="Tap to cycle the sort order."
          title="Sort"
          viewAllHref={undefined}
        >
          <Text
            accessibilityRole="button"
            onPress={cycleSort}
            style={[styles.sortText, { color: theme.primary }]}
          >
            {SORT_LABELS[sort as (typeof SORT_OPTIONS)[number]] ?? sort}
          </Text>
        </NativeSection>

        <NativeSection title="Featured Songs">
          <NativeRail>
            {(featured.data ?? []).map((track) => (
              <TrackCard key={track.id} track={track} />
            ))}
            {featured.data?.length === 0 ? (
              <NativeEmptyState>No songs found.</NativeEmptyState>
            ) : null}
          </NativeRail>
        </NativeSection>

        {(genres.data ?? []).map((genre) => (
          <GenreRail
            key={genre.id}
            genre={genre}
            region={region}
            regionType={regionType}
            sort={sort}
          />
        ))}

        <NativeSection title="All Songs">
          <NativeCollectionGrid
            empty="No songs found for the selected filters."
            fetchMore={
              tracks.hasNextPage ? () => void tracks.fetchNextPage() : undefined
            }
            hasMore={tracks.hasNextPage}
            isFetchingMore={tracks.isFetchingNextPage}
            isLoading={tracks.isLoading}
            items={allTracks}
            keyForItem={(track) => track.id}
            renderItem={(track) => <TrackCard track={track} />}
          />
        </NativeSection>
      </View>
    </NativePageScreen>
  );
}

function GenreRail({
  genre,
  region,
  regionType,
  sort,
}: {
  genre: { id: string; name: string; slug: string };
  region: string;
  regionType: "global" | "north-america";
  sort: string;
}) {
  const genreTracks = useTracksQuery({
    genre: genre.slug,
    limit: 12,
    region,
    regionType,
    scope: "public",
    sort,
  });

  if (!genreTracks.isLoading && (genreTracks.data ?? []).length === 0) {
    return null;
  }

  return (
    <NativeSection description="Top songs from this genre." title={genre.name}>
      <NativeRail>
        {(genreTracks.data ?? []).map((track) => (
          <TrackCard key={track.id} track={track} />
        ))}
      </NativeRail>
    </NativeSection>
  );
}
