/* oxlint-disable one-var, sort-vars, complexity */
import { Stack, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ArtistCard } from "@/components/cards/artist-card";
import { BattleCard } from "@/components/cards/battle-card";
import { TrackCard } from "@/components/cards/track-card";
import { Container } from "@/components/container";
import { NativeEmptyState } from "@/components/native-collection-grid";
import { NativeRail } from "@/components/native-rail";
import { NativeSection } from "@/components/native-section";
import { NAV_THEME } from "@/lib/constants";
import { genreMetaFor, matchesGenre } from "@/lib/genre-meta";
import {
  useArtistsQuery,
  useBattlesQuery,
  useTracksQuery,
} from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

const GLOBAL_REGION = { region: "all", regionType: "global" } as const;

export default function GenreHubScreen() {
  const { slug: rawSlug } = useLocalSearchParams<{ slug: string }>(),
    slug = rawSlug ?? "",
    meta = genreMetaFor(slug),
    { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    topTracks = useTracksQuery({
      genre: meta.queryGenre,
      limit: 12,
      region: GLOBAL_REGION.region,
      regionType: GLOBAL_REGION.regionType,
      scope: "public",
      sort: "plays-desc",
    }),
    newTracks = useTracksQuery({
      genre: meta.queryGenre,
      limit: 12,
      region: GLOBAL_REGION.region,
      regionType: GLOBAL_REGION.regionType,
      scope: "public",
      sort: "date-desc",
    }),
    topArtists = useArtistsQuery({
      category: "top",
      genre: meta.queryGenre,
      limit: 12,
      region: GLOBAL_REGION.region,
      regionType: GLOBAL_REGION.regionType,
      sort: "rank-asc",
    }),
    battles = useBattlesQuery(GLOBAL_REGION),
    genreBattles = (battles.data ?? []).filter((battle) =>
      matchesGenre(battle.genre, meta.queryGenre)
    );

  return (
    <>
      <Stack.Screen
        options={{
          headerBackTitle: "Genres",
          headerShown: true,
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          title: meta.name,
        }}
      />
      <Container>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          style={{ backgroundColor: theme.background }}
        >
          <View style={styles.header}>
            <Text style={styles.headerEmoji}>{meta.emoji}</Text>
            <Text style={[styles.headerTitle, { color: theme.text }]}>
              {meta.name}
            </Text>
            <Text
              style={[styles.headerDescription, { color: theme.mutedText }]}
            >
              {meta.description}
            </Text>
          </View>

          <View style={styles.sections}>
            <NativeSection
              description="The most-played songs in this genre."
              title={`Top ${meta.name} Tracks`}
            >
              <NativeRail>
                {topTracks.isLoading ? (
                  <ActivityIndicator
                    color={theme.primary}
                    style={styles.loader}
                  />
                ) : null}
                {(topTracks.data ?? []).map((track) => (
                  <TrackCard key={track.id} track={track} />
                ))}
                {!topTracks.isLoading && (topTracks.data ?? []).length === 0 ? (
                  <NativeEmptyState>
                    No {meta.name.toLowerCase()} tracks yet.
                  </NativeEmptyState>
                ) : null}
              </NativeRail>
            </NativeSection>

            <NativeSection
              description="Fresh releases from this genre."
              title={`New ${meta.name} Tracks`}
            >
              <NativeRail>
                {newTracks.isLoading ? (
                  <ActivityIndicator
                    color={theme.primary}
                    style={styles.loader}
                  />
                ) : null}
                {(newTracks.data ?? []).map((track) => (
                  <TrackCard key={track.id} track={track} />
                ))}
                {!newTracks.isLoading && (newTracks.data ?? []).length === 0 ? (
                  <NativeEmptyState>
                    No new {meta.name.toLowerCase()} tracks yet.
                  </NativeEmptyState>
                ) : null}
              </NativeRail>
            </NativeSection>

            <NativeSection
              description="The artists defining this sound."
              title={`Top ${meta.name} Artists`}
            >
              <NativeRail>
                {topArtists.isLoading ? (
                  <ActivityIndicator
                    color={theme.primary}
                    style={styles.loader}
                  />
                ) : null}
                {(topArtists.data ?? []).map((artist) => (
                  <ArtistCard artist={artist} key={artist.id} />
                ))}
                {!topArtists.isLoading &&
                (topArtists.data ?? []).length === 0 ? (
                  <NativeEmptyState>
                    No {meta.name.toLowerCase()} artists yet.
                  </NativeEmptyState>
                ) : null}
              </NativeRail>
            </NativeSection>

            <NativeSection
              description="Live and upcoming matchups."
              title={`${meta.name} Battles`}
            >
              <NativeRail>
                {battles.isLoading ? (
                  <ActivityIndicator
                    color={theme.primary}
                    style={styles.loader}
                  />
                ) : null}
                {genreBattles.map((battle) => (
                  <BattleCard battle={battle} key={battle.id} />
                ))}
                {!battles.isLoading && genreBattles.length === 0 ? (
                  <NativeEmptyState>
                    No {meta.name.toLowerCase()} battles scheduled.
                  </NativeEmptyState>
                ) : null}
              </NativeRail>
            </NativeSection>
          </View>
        </ScrollView>
      </Container>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 24,
    paddingBottom: 48,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  header: {
    alignItems: "center",
    gap: 6,
  },
  headerDescription: {
    fontSize: 14,
    textAlign: "center",
  },
  headerEmoji: {
    fontSize: 44,
    lineHeight: 52,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.6,
    textAlign: "center",
  },
  loader: { padding: 16 },
  sections: { gap: 26 },
});
