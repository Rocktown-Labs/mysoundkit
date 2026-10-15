/* oxlint-disable one-var, sort-vars, eqeqeq, no-eq-null, no-negated-condition */
import { useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ArtistCard } from "@/components/cards/artist-card";
import { Container } from "@/components/container";
import { NAV_THEME } from "@/lib/constants";
import { useArtistsInfiniteQuery } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

export default function ArtistsScreen() {
  const params = useLocalSearchParams<{
      category?: "new" | "rising" | "top";
      region?: string;
    }>(),
    region = params.region ?? "all",
    regionType =
      region === "all" ? ("global" as const) : ("north-america" as const),
    category = params.category ?? "top",
    { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    artists = useArtistsInfiniteQuery({
      category,
      limit: 24,
      region,
      regionType,
      sort: "rank-asc",
    }),
    items = artists.data?.pages.flat() ?? [];

  return (
    <Container>
      <FlatList
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.content}
        data={items}
        keyExtractor={(artist) => artist.username}
        ListEmptyComponent={
          artists.isLoading ? (
            <ActivityIndicator color={theme.primary} />
          ) : (
            <Text style={{ color: theme.mutedText }}>
              No artists are live for this view yet.
            </Text>
          )
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>Artists</Text>
            <Text style={[styles.description, { color: theme.mutedText }]}>
              Artist profiles and rising talent.
            </Text>
          </View>
        }
        numColumns={2}
        onEndReached={() => {
          if (artists.hasNextPage && !artists.isFetchingNextPage) {
            void artists.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.6}
        renderItem={({ item }) => <ArtistCard artist={item} />}
      />
    </Container>
  );
}

const styles = StyleSheet.create({
  content: { gap: 18, padding: 20, paddingBottom: 48 },
  description: { fontSize: 15 },
  header: { gap: 6, paddingBottom: 8 },
  row: { gap: 12 },
  title: { fontSize: 32, fontWeight: "800" },
});
