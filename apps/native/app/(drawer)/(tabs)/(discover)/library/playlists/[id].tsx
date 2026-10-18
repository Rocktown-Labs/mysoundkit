/* oxlint-disable one-var, sort-vars, no-nested-ternary */
/* eslint-disable one-var, sort-vars, no-nested-ternary */
import { Ionicons } from "@expo/vector-icons";
import { Link, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Container } from "@/components/container";
import { LibraryDataTable } from "@/components/library-data-table";
import type { LibrarySortColumn } from "@/components/library-data-table";
import { NativeImage } from "@/components/native-image";
import { PlaylistItemsModal } from "@/components/playlist-items-modal";
import { useAudioPlayerContext } from "@/contexts/audio-player-context";
import { NAV_THEME } from "@/lib/constants";
import type { PlayerTrack } from "@/lib/player-queue";
import {
  resolveApiUrl,
  useAddPlaylistItemsMutation,
  useLibraryPlaylistQuery,
  useRemovePlaylistTrackMutation,
} from "@/lib/soundkit-api";
import type { PlaylistDetail } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

type PlaylistTrackRow = PlaylistDetail["tracks"][number];

const SORT_COLUMNS: readonly LibrarySortColumn<PlaylistTrackRow>[] = [
  {
    getValue: (item) => item.title,
    id: "title",
    label: "Song Name",
  },
  {
    getValue: (item) => item.artist,
    id: "artist",
    label: "Artist",
  },
  {
    getValue: (item) => item.duration,
    id: "duration",
    label: "Duration",
  },
  {
    getValue: () => "Recently",
    id: "addedAt",
    label: "Date Added",
  },
];

export default function PlaylistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    playlistId = id ?? "",
    router = useRouter(),
    { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    [addModalOpen, setAddModalOpen] = useState(false),
    [removingTrackId, setRemovingTrackId] = useState<null | string>(null),
    playlistQuery = useLibraryPlaylistQuery(playlistId),
    addItemsMutation = useAddPlaylistItemsMutation(playlistId),
    removeTrackMutation = useRemovePlaylistTrackMutation(playlistId),
    { playTrack } = useAudioPlayerContext(),
    { data } = playlistQuery,
    tracks = data?.tracks ?? [],
    existingTrackIds = new Set(tracks.map((track) => track.id)),
    playableTracks: PlayerTrack[] = tracks.map((track) => ({
      artist: track.artist,
      cover: track.cover,
      duration: null,
      id: track.id,
      src:
        resolveApiUrl(`/v1/tracks/${encodeURIComponent(track.id)}/playback`) ??
        "",
      title: track.title,
      trackHref: `/tracks/${track.id}`,
    })),
    canPlayAll =
      playableTracks.length > 0 &&
      playableTracks.every((track) => track.src.length > 0),
    heroCover = tracks[0]?.cover ?? null,
    handlePlayTrackAtIndex = (item: PlaylistTrackRow) => {
      const targetIndex = playableTracks.findIndex((t) => t.id === item.id);
      if (targetIndex === -1) {
        return;
      }
      const target = playableTracks[targetIndex],
        queueAfter = playableTracks.slice(targetIndex + 1);
      if (target) {
        playTrack(target, queueAfter);
      }
    },
    handleSaveItems = async (payload: {
      description: string;
      projectIds: string[];
      title: string;
      trackIds: string[];
    }) => {
      await addItemsMutation.mutateAsync({
        projectIds: payload.projectIds,
        trackIds: payload.trackIds,
      });
      setAddModalOpen(false);
    },
    handleRemoveTrack = (trackId: string) => {
      setRemovingTrackId(trackId);
      removeTrackMutation.mutate(trackId, {
        onSettled: () => {
          setRemovingTrackId(null);
        },
      });
    };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <Container>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          style={{ backgroundColor: theme.background }}
        >
          <Link asChild href="/library/playlists">
            <Pressable accessibilityRole="button" style={styles.backRow}>
              <Ionicons color="#B8A3FF" name="arrow-back" size={18} />
              <Text style={styles.backText}>Back to Playlists</Text>
            </Pressable>
          </Link>

          {playlistQuery.isLoading ? (
            <ActivityIndicator color={theme.primary} style={styles.loader} />
          ) : null}

          {!playlistQuery.isLoading && data === undefined ? (
            <View style={[styles.emptyBox, { borderColor: theme.border }]}>
              <Ionicons color="#8F8F8F" name="list-outline" size={36} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                This playlist could not be found.
              </Text>
            </View>
          ) : null}

          {!playlistQuery.isLoading && data !== undefined ? (
            <>
              {/* Hero Card matching web /library/playlists/$id */}
              <View style={styles.heroRow}>
                <View style={styles.coverBox}>
                  {heroCover ? (
                    <NativeImage
                      contentFit="cover"
                      source={heroCover}
                      style={styles.coverImg}
                    />
                  ) : (
                    <Ionicons
                      color="#8F8F8F"
                      name="musical-notes-outline"
                      size={40}
                    />
                  )}
                </View>

                <View style={styles.heroCopy}>
                  <Text style={styles.eyebrow}>PLAYLIST</Text>
                  <Text
                    numberOfLines={2}
                    style={[styles.title, { color: theme.text }]}
                  >
                    {data.playlist.title}
                  </Text>
                  <Text
                    numberOfLines={2}
                    style={[styles.meta, { color: theme.mutedText }]}
                  >
                    {data.playlist.description || "No description provided."} •{" "}
                    {tracks.length} {tracks.length === 1 ? "track" : "tracks"}
                  </Text>

                  <View style={styles.heroActions}>
                    <Pressable
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
                        styles.playAllBtn,
                        !canPlayAll && styles.btnDisabled,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Ionicons color="#171717" name="play" size={15} />
                      <Text style={styles.playAllText}>Play All</Text>
                    </Pressable>

                    <Pressable
                      accessibilityLabel="Add Songs"
                      accessibilityRole="button"
                      onPress={() => setAddModalOpen(true)}
                      style={({ pressed }) => [
                        styles.addSongsBtn,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Ionicons color="#f4f4f5" name="add" size={16} />
                      <Text style={styles.addSongsText}>Add Songs</Text>
                    </Pressable>
                  </View>
                </View>
              </View>

              {/* TanStack-style Playlist Track Table */}
              <LibraryDataTable
                data={tracks}
                emptyMessage='No songs in this playlist yet. Tap "Add Song" to get started.'
                filterPlaceholder="Filter songs..."
                getArtist={(item) => item.artist}
                getBadges={(item) =>
                  item.genre ? [{ label: item.genre }] : []
                }
                getCoverUrl={(item) => item.cover}
                getId={(item) => item.id}
                getPrimaryMeta={(item) => item.duration}
                getSecondaryMeta={() => "Recently"}
                getTitle={(item) => item.title}
                itemCountLabel="track(s)"
                onArtistPress={(item) => {
                  if (item.artistSlug) {
                    router.push(`/artist/${item.artistSlug}`);
                  }
                }}
                onPlayPress={(item) => handlePlayTrackAtIndex(item)}
                onRowPress={(item) => router.push(`/tracks/${item.id}`)}
                renderRowActions={(item) => (
                  <Pressable
                    accessibilityLabel={`Remove ${item.title}`}
                    accessibilityRole="button"
                    disabled={removingTrackId === item.id}
                    onPress={() => {
                      handleRemoveTrack(item.id);
                    }}
                    style={styles.removeBtn}
                  >
                    {removingTrackId === item.id ? (
                      <ActivityIndicator color="#e05d4d" size="small" />
                    ) : (
                      <Ionicons
                        color="#e05d4d"
                        name="trash-outline"
                        size={16}
                      />
                    )}
                  </Pressable>
                )}
                searchKeys={(item) => [item.title, item.artist, item.genre]}
                sortColumns={SORT_COLUMNS}
                toolbarAction={{
                  icon: "add",
                  label: "Add Song",
                  onPress: () => setAddModalOpen(true),
                }}
              />
            </>
          ) : null}
        </ScrollView>

        <PlaylistItemsModal
          existingTrackIds={existingTrackIds}
          isSaving={addItemsMutation.isPending}
          mode="add-to-existing"
          onClose={() => setAddModalOpen(false)}
          onSave={handleSaveItems}
          visible={addModalOpen}
        />
      </Container>
    </>
  );
}

const styles = StyleSheet.create({
  addSongsBtn: {
    alignItems: "center",
    backgroundColor: "#141417",
    borderColor: "#27272a",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  addSongsText: {
    color: "#f4f4f5",
    fontSize: 13,
    fontWeight: "700",
  },
  backRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  backText: {
    color: "#B8A3FF",
    fontSize: 13,
    fontWeight: "700",
  },
  btnDisabled: {
    opacity: 0.4,
  },
  content: {
    gap: 20,
    paddingBottom: 48,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  coverBox: {
    alignItems: "center",
    backgroundColor: "#0b0b0d",
    borderColor: "#212121",
    borderRadius: 14,
    borderWidth: 1,
    height: 112,
    justifyContent: "center",
    overflow: "hidden",
    width: 112,
  },
  coverImg: {
    height: "100%",
    width: "100%",
  },
  emptyBox: {
    alignItems: "center",
    backgroundColor: "#060606",
    borderRadius: 18,
    borderStyle: "dashed",
    borderWidth: 1,
    gap: 8,
    paddingVertical: 36,
  },
  emptyTitle: { fontSize: 15, fontWeight: "700" },
  eyebrow: {
    color: "#8F8F8F",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  heroActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
  },
  heroCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  heroRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 16,
  },
  loader: { marginTop: 48 },
  meta: { fontSize: 13, lineHeight: 18 },
  playAllBtn: {
    alignItems: "center",
    backgroundColor: "#B8A3FF",
    borderRadius: 10,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  playAllText: {
    color: "#171717",
    fontSize: 13,
    fontWeight: "800",
  },
  removeBtn: {
    alignItems: "center",
    backgroundColor: "rgba(224, 93, 77, 0.12)",
    borderColor: "rgba(224, 93, 77, 0.3)",
    borderRadius: 8,
    borderWidth: 1,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
});
