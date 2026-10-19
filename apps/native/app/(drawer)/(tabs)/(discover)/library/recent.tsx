/* oxlint-disable one-var, sort-vars, sort-keys, complexity */
import { Ionicons } from "@expo/vector-icons";
import { Link, Stack, useRouter } from "expo-router";
import { useMemo } from "react";
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
import { useAudioPlayerContext } from "@/contexts/audio-player-context";
import type { PlayerTrack } from "@/lib/player-queue";
import { resolveApiUrl, useLibraryRecentQuery } from "@/lib/soundkit-api";
import type { LibraryRecentTrack } from "@/lib/soundkit-api";

function parseDurationToSeconds(duration: string) {
  const parts = duration.split(":").map(Number);
  if (parts.length === 2) {
    return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
  }
  return 0;
}

function formatRelativeTime(dateString: string) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) {
    return "Just now";
  }
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
  });
}

const SORT_COLUMNS: readonly LibrarySortColumn<LibraryRecentTrack>[] = [
  {
    getValue: (row) => row.title.toLowerCase(),
    id: "title",
    label: "Song Name",
  },
  {
    getValue: (row) => row.artist.toLowerCase(),
    id: "artist",
    label: "Artist",
  },
  {
    getValue: (row) => row.timesPlayed,
    id: "timesPlayed",
    label: "Times Played",
  },
  {
    getValue: (row) => new Date(row.lastPlayed).getTime() || 0,
    id: "lastPlayed",
    label: "Last Played",
  },
  {
    getValue: (row) => parseDurationToSeconds(row.duration),
    id: "duration",
    label: "Duration",
  },
];

export default function RecentlyPlayedScreen() {
  const router = useRouter();
  const { playTrack } = useAudioPlayerContext();
  const { data: recentSongs = [], isLoading } = useLibraryRecentQuery();

  const playableTracks: PlayerTrack[] = useMemo(
    () =>
      recentSongs.map((song) => ({
        artist: song.artist,
        cover: song.cover,
        duration: null,
        id: song.id,
        src:
          resolveApiUrl(`/v1/tracks/${encodeURIComponent(song.id)}/playback`) ??
          "",
        title: song.title,
        trackHref: `/tracks/${song.id}`,
      })),
    [recentSongs]
  );

  const handlePlayRow = (song: LibraryRecentTrack) => {
    const targetIndex = playableTracks.findIndex((t) => t.id === song.id);
    if (targetIndex === -1) {
      return;
    }
    const target = playableTracks[targetIndex];
    const queueAfter = playableTracks.slice(targetIndex + 1);
    if (target) {
      playTrack(target, queueAfter);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerBackTitle: "Library",
          headerShown: true,
          headerStyle: { backgroundColor: "#060606" },
          headerTintColor: "#FFFFFF",
          title: "Recently Played",
        }}
      />
      <Container>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                router.push("/library" as never);
              }}
              style={styles.backRow}
            >
              <Ionicons color="#B8A3FF" name="arrow-back" size={16} />
              <Text style={styles.backText}>Back to Library</Text>
            </Pressable>
            <View style={styles.titleRow}>
              <View style={styles.titleTextCol}>
                <Text style={styles.title}>Recently Played</Text>
                <Text style={styles.subtitle}>
                  Your listening history ({recentSongs.length} songs)
                </Text>
              </View>
            </View>
          </View>

          {isLoading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color="#B8A3FF" />
              <Text style={styles.loadingText}>Loading listening history…</Text>
            </View>
          ) : null}

          {!isLoading && recentSongs.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons color="#8F8F8F" name="time-outline" size={36} />
              <Text style={styles.emptyTitle}>No listening history yet</Text>
              <Text style={styles.emptyDesc}>
                Start listening to tracks and your history will appear here.
              </Text>
              <Link asChild href="/music">
                <Pressable style={styles.browseBtn}>
                  <Text style={styles.browseBtnText}>Discover Music</Text>
                </Pressable>
              </Link>
            </View>
          ) : null}

          {!isLoading && recentSongs.length > 0 ? (
            <LibraryDataTable
              data={recentSongs}
              emptyMessage="No recent songs match your filter."
              filterPlaceholder="Filter recent songs..."
              getArtist={(row) => row.artist}
              getBadges={(row) => [
                {
                  color: "#B8A3FF",
                  icon: "play",
                  label: `${row.timesPlayed}x played`,
                },
              ]}
              getCoverUrl={(row) => row.cover}
              getId={(row) => row.id}
              getPrimaryMeta={(row) => row.duration}
              getSecondaryMeta={(row) => formatRelativeTime(row.lastPlayed)}
              getTitle={(row) => row.title}
              itemCountLabel="track(s)"
              onArtistPress={(row) => {
                if (row.artistSlug) {
                  router.push(`/artist/${row.artistSlug}` as never);
                }
              }}
              onPlayPress={(row) => {
                handlePlayRow(row);
              }}
              onRowPress={(row) => {
                router.push(`/tracks/${row.id}` as never);
              }}
              searchKeys={(row) => [row.title, row.artist]}
              sortColumns={SORT_COLUMNS}
            />
          ) : null}
        </ScrollView>
      </Container>
    </>
  );
}

const styles = StyleSheet.create({
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
    paddingBottom: 48,
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  emptyCard: {
    alignItems: "center",
    backgroundColor: "#060606",
    borderColor: "#212121",
    borderRadius: 18,
    borderStyle: "dashed",
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 36,
  },
  emptyDesc: {
    color: "#8F8F8F",
    fontSize: 13,
    textAlign: "center",
  },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  header: {
    gap: 10,
  },
  iconBadge: {
    alignItems: "center",
    backgroundColor: "rgba(59, 130, 246, 0.14)",
    borderRadius: 12,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  loadingCard: {
    alignItems: "center",
    backgroundColor: "#111111",
    borderColor: "#212121",
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    paddingVertical: 36,
  },
  loadingText: {
    color: "#8F8F8F",
    fontSize: 13,
  },
  subtitle: {
    color: "#8F8F8F",
    fontSize: 13,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  titleTextCol: {
    flex: 1,
    gap: 2,
  },
});
