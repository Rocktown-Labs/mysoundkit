import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { NativeSectionScreen } from "@/components/native-section-screen";
import { NAV_THEME } from "@/lib/constants";
import { useDiscoverTopArtistsQuery } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

export default function ArtistsScreen() {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    topArtists = useDiscoverTopArtistsQuery({
      region: "all",
      regionType: "global",
    });

  return (
    <NativeSectionScreen
      description="Meet the artists shaping SoundKit — rising talent and community favorites."
      eyebrow="Community"
      title="Artists"
    >
      <View style={styles.list}>
        {topArtists.isLoading ? (
          <View style={[styles.emptyCard, { borderColor: theme.border }]}>
            <Text
              selectable
              style={[styles.emptyText, { color: theme.mutedText }]}
            >
              Loading artists…
            </Text>
          </View>
        ) : null}
        {!topArtists.isLoading && (topArtists.data ?? []).length === 0 ? (
          <View style={[styles.emptyCard, { borderColor: theme.border }]}>
            <Text
              selectable
              style={[styles.emptyText, { color: theme.mutedText }]}
            >
              No artists to show yet — check back soon.
            </Text>
          </View>
        ) : null}
        {topArtists.isLoading
          ? null
          : (topArtists.data ?? []).map((artist) => (
              <Link href="/artist" asChild key={artist.id}>
                <Pressable
                  accessibilityLabel={`Artist ${artist.name}`}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.artistRow,
                    {
                      backgroundColor: pressed ? theme.muted : theme.card,
                      borderColor: theme.border,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <View
                    style={[styles.avatar, { backgroundColor: theme.primary }]}
                  >
                    <Text
                      style={[
                        styles.avatarInitials,
                        { color: theme.primaryForeground },
                      ]}
                    >
                      {artist.name
                        .split(" ")
                        .map((part) => part.charAt(0).toUpperCase())
                        .slice(0, 2)
                        .join("")}
                    </Text>
                  </View>
                  <View style={styles.artistCopy}>
                    <View style={styles.nameRow}>
                      <Text
                        numberOfLines={1}
                        selectable
                        style={[styles.artistName, { color: theme.text }]}
                      >
                        {artist.name}
                      </Text>
                      {artist.verified ? (
                        <Ionicons
                          color={theme.primary}
                          name="checkmark-circle"
                          size={16}
                        />
                      ) : null}
                    </View>
                    <Text
                      numberOfLines={1}
                      style={[styles.artistMeta, { color: theme.mutedText }]}
                    >
                      {[artist.location, artist.genre]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  </View>
                  <Ionicons
                    color={theme.mutedText}
                    name="chevron-forward"
                    size={18}
                  />
                </Pressable>
              </Link>
            ))}
      </View>
    </NativeSectionScreen>
  );
}

const styles = StyleSheet.create({
  artistCopy: { flex: 1, gap: 2 },
  artistMeta: { fontSize: 12 },
  artistName: { fontSize: 15, fontWeight: "700" },
  artistRow: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 64,
    padding: 12,
  },
  avatar: {
    alignItems: "center",
    borderRadius: 999,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  avatarInitials: { fontSize: 13, fontWeight: "800" },
  emptyCard: {
    borderRadius: 14,
    borderStyle: "dashed",
    borderWidth: 1,
    padding: 18,
  },
  emptyText: { fontSize: 13, textAlign: "center" },
  list: { gap: 8 },
  nameRow: { alignItems: "center", flexDirection: "row", gap: 4 },
});
