/* oxlint-disable one-var, sort-vars, sort-keys, complexity, eqeqeq, no-eq-null, no-nested-ternary, prefer-string-replace-all */
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Container } from "@/components/container";
import { LibraryItemRow } from "@/components/library-item-row";
import { useAudioPlayerContext } from "@/contexts/audio-player-context";
import { NAV_THEME } from "@/lib/constants";
import type { PlayerTrack } from "@/lib/player-queue";
import { resolveApiUrl, useLibraryPlaylistQuery } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

export default function PlaylistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    playlist = useLibraryPlaylistQuery(id ?? ""),
    { data } = playlist,
    { playTrack } = useAudioPlayerContext(),
    tracks = data?.tracks ?? [],
    playableTracks: PlayerTrack[] = tracks.map((track) => ({
      artist: track.artist,
      cover: track.cover,
      duration: null,
      id: track.id,
      // Playlist rows carry catalog titles; streaming sources resolve through
      // the guarded playback URL for the track id.
      src:
        resolveApiUrl(`/v1/tracks/${encodeURIComponent(track.id)}/playback`) ??
        "",
      title: track.title,
      trackHref: `/tracks/${track.id}`,
    })),
    canPlayAll =
      playableTracks.length > 0 &&
      playableTracks.every((track) => track.src.length > 0);

  return (
    <>
      <Stack.Screen
        options={{
          headerBackTitle: "Playlists",
          headerShown: true,
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          title: data?.playlist.title ?? "Playlist",
        }}
      />
      <Container>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          style={{ backgroundColor: theme.background }}
        >
          {playlist.isLoading ? (
            <ActivityIndicator color={theme.primary} style={styles.loader} />
          ) : (data == null ? (
            <View style={[styles.emptyBox, { borderColor: theme.border }]}>
              <Ionicons color="#8F8F8F" name="list-outline" size={36} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                This playlist could not be found.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.header}>
                <View style={styles.iconBox}>
                  <Ionicons color="#B8A3FF" name="albums-outline" size={26} />
                </View>
                <View style={styles.headerCopy}>
                  <Text style={[styles.title, { color: theme.text }]}>
                    {data.playlist.title}
                  </Text>
                  <Text style={[styles.meta, { color: theme.mutedText }]}>
                    {data.playlist.trackCount}{" "}
                    {data.playlist.trackCount === 1 ? "track" : "tracks"}
                    {data.playlist.description
                      ? ` • ${data.playlist.description}`
                      : ""}
                  </Text>
                </View>
              </View>

              <Pressable
                accessibilityHint="Plays the whole playlist"
                accessibilityLabel="Play All"
                accessibilityRole="button"
                disabled={!canPlayAll}
                onPress={() => {
                  const [first, ...rest] = playableTracks;
                  if (first) {
                    playTrack(first, rest);
                  }
                }}
                style={({ pressed }) => [
                  styles.playAllButton,
                  !canPlayAll && styles.playAllDisabled,
                  pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
                ]}
              >
                <Ionicons color="#171717" name="play" size={17} />
                <Text style={styles.playAllText}>Play All</Text>
              </Pressable>

              {tracks.length > 0 ? (
                <View style={styles.list}>
                  {tracks.map((track, index) => (
                    <LibraryItemRow
                      badge={track.duration}
                      href={`/tracks/${track.id}`}
                      imageUrl={track.cover}
                      index={index}
                      key={track.id}
                      subtitle={track.artist}
                      title={track.title}
                    />
                  ))}
                </View>
              ) : (
                <View style={[styles.emptyBox, { borderColor: theme.border }]}>
                  <Ionicons
                    color="#8F8F8F"
                    name="musical-notes-outline"
                    size={36}
                  />
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>
                    No tracks in this playlist yet.
                  </Text>
                </View>
              )}
            </>
          ))}
        </ScrollView>
      </Container>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 18,
    paddingBottom: 48,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  emptyBox: {
    alignItems: "center",
    borderRadius: 18,
    borderStyle: "dashed",
    borderWidth: 1,
    gap: 8,
    paddingVertical: 36,
  },
  emptyTitle: { fontSize: 15, fontWeight: "700" },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
  },
  headerCopy: { flex: 1, gap: 4 },
  iconBox: {
    alignItems: "center",
    backgroundColor: "rgba(184, 163, 255, 0.14)",
    borderRadius: 16,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  list: { gap: 8 },
  loader: { marginTop: 48 },
  meta: { fontSize: 13 },
  playAllButton: {
    alignItems: "center",
    backgroundColor: "#B8A3FF",
    borderRadius: 999,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    paddingVertical: 13,
  },
  playAllDisabled: { opacity: 0.4 },
  playAllText: {
    color: "#171717",
    fontSize: 14,
    fontWeight: "800",
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
});
