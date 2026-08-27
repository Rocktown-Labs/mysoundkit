import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { NativeMenuList } from "@/components/native-menu-list";
import { NativeSectionScreen } from "@/components/native-section-screen";
import { NAV_THEME } from "@/lib/constants";
import { EXPLORE_MENU_ITEMS } from "@/lib/native-navigation";
import { useExploreTracksQuery } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

export default function ExploreScreen() {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    tracksQuery = useExploreTracksQuery();

  return (
    <NativeSectionScreen
      description="Discover tracks, artists, scenes, and live moments from across SoundKit."
      eyebrow="Discover"
      title="Explore"
    >
      <View style={styles.introCard}>
        <Text selectable style={[styles.introTitle, { color: theme.text }]}>
          Find your next favorite sound.
        </Text>
        <Text selectable style={[styles.introCopy, { color: theme.mutedText }]}>
          Start with the catalog, then follow the scene wherever it leads.
        </Text>
      </View>

      <NativeMenuList items={EXPLORE_MENU_ITEMS} label="Browse SoundKit" />

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          New tracks
        </Text>
        {tracksQuery.isLoading ? (
          <ActivityIndicator color={theme.primary} />
        ) : null}
        {tracksQuery.error ? (
          <Text
            selectable
            style={[styles.message, { color: theme.destructive }]}
          >
            Explore is unavailable right now.
          </Text>
        ) : null}
        {tracksQuery.data?.map((track) => (
          <View
            key={track.id}
            style={[
              styles.trackCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <View
              style={[styles.trackArtwork, { backgroundColor: theme.muted }]}
            >
              <Text style={[styles.trackArtworkText, { color: theme.primary }]}>
                ♫
              </Text>
            </View>
            <View style={styles.trackCopy}>
              <Text
                selectable
                style={[styles.trackTitle, { color: theme.text }]}
              >
                {track.title}
              </Text>
              <Text
                selectable
                style={[styles.artist, { color: theme.mutedText }]}
              >
                {track.artistName}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </NativeSectionScreen>
  );
}

const styles = StyleSheet.create({
  artist: { fontSize: 13 },
  introCard: {
    borderLeftWidth: 3,
    gap: 8,
    paddingLeft: 15,
  },
  introCopy: { fontSize: 14, lineHeight: 21 },
  introTitle: { fontSize: 19, fontWeight: "800" },
  message: { fontSize: 14 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 20, fontWeight: "800" },
  trackArtwork: {
    alignItems: "center",
    borderRadius: 10,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  trackArtworkText: { fontSize: 25 },
  trackCard: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 12,
  },
  trackCopy: { flex: 1, gap: 3 },
  trackTitle: { fontSize: 16, fontWeight: "700" },
});
