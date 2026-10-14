import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Container } from "@/components/container";
import { NAV_THEME } from "@/lib/constants";
import { useLibraryPlaylistsQuery } from "@/lib/soundkit-api";
import type { PlaylistSummary } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

function PlaylistNestedCard({ playlist }: { playlist: PlaylistSummary }) {
  return (
    <Link asChild href={`/library/playlists/${playlist.id}`}>
      <Pressable
        accessibilityHint="Opens the playlist"
        accessibilityLabel={playlist.title}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.playlistBox,
          pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
        ]}
      >
        <View style={styles.playlistIconBox}>
          <Ionicons color="#B8A3FF" name="albums-outline" size={20} />
        </View>

        <View style={styles.playlistHeaderCopy}>
          <Text style={styles.playlistTitle}>{playlist.title}</Text>
          <Text style={styles.playlistMeta}>
            {playlist.trackCount}{" "}
            {playlist.trackCount === 1 ? "track" : "tracks"}
            {playlist.description ? ` • ${playlist.description}` : ""}
          </Text>
        </View>

        <Ionicons color="#8F8F8F" name="chevron-forward" size={18} />
      </Pressable>
    </Link>
  );
}

export default function PlaylistsScreen() {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    { data: playlists = [], isLoading } = useLibraryPlaylistsQuery();

  return (
    <Container>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Link href="/library" asChild>
            <Pressable style={styles.backRow}>
              <Ionicons color="#B8A3FF" name="arrow-back" size={18} />
              <Text style={styles.backText}>My SoundKit</Text>
            </Pressable>
          </Link>
          <View style={styles.titleRow}>
            <Ionicons color="#B8A3FF" name="list-outline" size={26} />
            <Text style={[styles.title, { color: theme.text }]}>Playlists</Text>
          </View>
          <Text style={[styles.subtitle, { color: theme.mutedText }]}>
            Custom collections and nested track listings
          </Text>
        </View>

        {isLoading && (
          <View style={[styles.stateBox, { borderColor: "#212121" }]}>
            <Text style={{ color: theme.mutedText }}>Loading playlists…</Text>
          </View>
        )}
        {!isLoading && playlists.length > 0 && (
          <View style={styles.list}>
            {playlists.map((playlist) => (
              <PlaylistNestedCard key={playlist.id} playlist={playlist} />
            ))}
          </View>
        )}
        {!isLoading && playlists.length === 0 && (
          <View style={[styles.stateBox, { borderColor: "#212121" }]}>
            <Ionicons color="#8F8F8F" name="list-outline" size={36} />
            <Text style={styles.emptyTitle}>No playlists yet</Text>
            <Text style={styles.emptyDesc}>
              Create custom playlists to organize your favorite music.
            </Text>
            <Link href="/music" asChild>
              <Pressable style={styles.browseBtn}>
                <Text style={styles.browseBtnText}>Browse Music</Text>
              </Pressable>
            </Link>
          </View>
        )}
      </ScrollView>
    </Container>
  );
}

const styles = StyleSheet.create({
  backRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginBottom: 4,
  },
  backText: {
    color: "#B8A3FF",
    fontSize: 13,
    fontWeight: "700",
  },
  browseBtn: {
    backgroundColor: "#B8A3FF",
    borderRadius: 12,
    marginTop: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  browseBtnText: {
    color: "#000000",
    fontSize: 13,
    fontWeight: "800",
  },
  content: {
    gap: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  emptyDesc: {
    color: "#8F8F8F",
    fontSize: 13,
    textAlign: "center",
  },
  emptyTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  header: {
    gap: 6,
  },
  list: {
    gap: 12,
  },
  playlistBox: {
    backgroundColor: "#060606",
    borderColor: "#212121",
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    overflow: "hidden",
    padding: 14,
  },
  playlistHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  playlistIconBox: {
    alignItems: "center",
    backgroundColor: "#212121",
    borderRadius: 10,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  playlistMeta: {
    color: "#8F8F8F",
    fontSize: 12,
  },
  playlistTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  stateBox: {
    alignItems: "center",
    borderRadius: 18,
    borderStyle: "dashed",
    borderWidth: 1,
    gap: 8,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 36,
  },
  subtitle: {
    fontSize: 14,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
});
