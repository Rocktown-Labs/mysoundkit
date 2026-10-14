import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
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
import { LibraryItemRow } from "@/components/library-item-row";
import { NAV_THEME } from "@/lib/constants";
import {
  useLibraryPlaylistQuery,
  useLibraryPlaylistsQuery,
} from "@/lib/soundkit-api";
import type { PlaylistSummary } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

function PlaylistNestedCard({
  isExpanded,
  onToggle,
  playlist,
}: {
  isExpanded: boolean;
  onToggle: () => void;
  playlist: PlaylistSummary;
}) {
  const { data: detail, isLoading } = useLibraryPlaylistQuery(
    isExpanded ? playlist.id : ""
  );

  return (
    <View style={styles.playlistBox}>
      {/* Playlist header row */}
      <Pressable onPress={onToggle} style={styles.playlistHeaderRow}>
        <View style={styles.playlistIconBox}>
          <Ionicons color="#c084fc" name="albums-outline" size={20} />
        </View>

        <View style={styles.playlistHeaderCopy}>
          <Text style={styles.playlistTitle}>{playlist.title}</Text>
          <Text style={styles.playlistMeta}>
            {playlist.trackCount}{" "}
            {playlist.trackCount === 1 ? "track" : "tracks"}
            {playlist.description ? ` • ${playlist.description}` : ""}
          </Text>
        </View>

        <Ionicons
          color="#a1a1aa"
          name={isExpanded ? "chevron-up" : "chevron-down"}
          size={18}
        />
      </Pressable>

      {/* Nested tracks list when expanded */}
      {isExpanded ? (
        <View style={styles.nestedTracksBox}>
          {isLoading && (
            <ActivityIndicator
              color="#c084fc"
              size="small"
              style={{ marginVertical: 12 }}
            />
          )}
          {!isLoading && detail?.tracks && detail.tracks.length > 0 && (
            <View style={styles.nestedTracksList}>
              {detail.tracks.map((track, idx) => (
                <LibraryItemRow
                  badge={track.duration}
                  href={`/tracks/${track.id}`}
                  imageUrl={track.cover}
                  index={idx}
                  key={track.id}
                  subtitle={track.artist}
                  title={track.artistSlug ? `${track.artist} - Track` : "Track"}
                />
              ))}
            </View>
          )}
          {!isLoading && (!detail?.tracks || detail.tracks.length === 0) && (
            <Text style={styles.emptyPlaylistText}>
              No tracks in this playlist yet.
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

export default function PlaylistsScreen() {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    { data: playlists = [], isLoading } = useLibraryPlaylistsQuery(),
    [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <Container>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Link href="/library" asChild>
            <Pressable style={styles.backRow}>
              <Ionicons color="#c084fc" name="arrow-back" size={18} />
              <Text style={styles.backText}>My SoundKit</Text>
            </Pressable>
          </Link>
          <View style={styles.titleRow}>
            <Ionicons color="#c084fc" name="list-outline" size={26} />
            <Text style={[styles.title, { color: theme.text }]}>Playlists</Text>
          </View>
          <Text style={[styles.subtitle, { color: theme.mutedText }]}>
            Custom collections and nested track listings
          </Text>
        </View>

        {isLoading && (
          <View style={[styles.stateBox, { borderColor: "#27272a" }]}>
            <Text style={{ color: theme.mutedText }}>Loading playlists…</Text>
          </View>
        )}
        {!isLoading && playlists.length > 0 && (
          <View style={styles.list}>
            {playlists.map((playlist) => (
              <PlaylistNestedCard
                isExpanded={expandedId === playlist.id}
                key={playlist.id}
                onToggle={() =>
                  setExpandedId(expandedId === playlist.id ? null : playlist.id)
                }
                playlist={playlist}
              />
            ))}
          </View>
        )}
        {!isLoading && playlists.length === 0 && (
          <View style={[styles.stateBox, { borderColor: "#27272a" }]}>
            <Ionicons color="#71717a" name="list-outline" size={36} />
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
    color: "#c084fc",
    fontSize: 13,
    fontWeight: "700",
  },
  browseBtn: {
    backgroundColor: "#c084fc",
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
    color: "#a1a1aa",
    fontSize: 13,
    textAlign: "center",
  },
  emptyPlaylistText: {
    color: "#71717a",
    fontSize: 12,
    fontStyle: "italic",
    paddingVertical: 8,
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
  nestedTracksBox: {
    borderTopColor: "#27272a",
    borderTopWidth: 1,
    paddingTop: 10,
  },
  nestedTracksList: {
    gap: 8,
  },
  playlistBox: {
    backgroundColor: "#121215",
    borderColor: "#27272a",
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
  playlistHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  playlistIconBox: {
    alignItems: "center",
    backgroundColor: "#27272a",
    borderRadius: 10,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  playlistMeta: {
    color: "#a1a1aa",
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
