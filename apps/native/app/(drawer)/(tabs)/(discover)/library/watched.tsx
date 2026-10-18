/* oxlint-disable one-var, sort-vars, sort-keys, complexity */
import { Ionicons } from "@expo/vector-icons";
import { Link, Stack, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Container } from "@/components/container";
import { LibraryDataTable } from "@/components/library-data-table";
import type { LibrarySortColumn } from "@/components/library-data-table";
import { useLibraryWatchedQuery } from "@/lib/soundkit-api";
import type { LibraryWatchedItem } from "@/lib/soundkit-api";

function parseDurationToSeconds(duration: string) {
  const parts = duration.split(":").map(Number);
  if (parts.length === 2) {
    return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
  }
  if (parts.length === 3) {
    return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
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

function getWatchHref(item: LibraryWatchedItem) {
  switch (item.type) {
    case "battle": {
      return `/live/battles/${item.id}`;
    }
    case "stream": {
      return `/live/streams/${item.id}`;
    }
    case "party": {
      return `/live/parties/${item.id}`;
    }
    case "community": {
      return "/communities";
    }
    default: {
      return `/videos/${item.id}`;
    }
  }
}

const SORT_COLUMNS: readonly LibrarySortColumn<LibraryWatchedItem>[] = [
  {
    getValue: (row) => row.title.toLowerCase(),
    id: "title",
    label: "Title",
  },
  {
    getValue: (row) => row.creator.toLowerCase(),
    id: "creator",
    label: "Creator",
  },
  {
    getValue: (row) => parseDurationToSeconds(row.duration),
    id: "duration",
    label: "Duration",
  },
  {
    getValue: (row) => new Date(row.watchedAt).getTime() || 0,
    id: "watchedAt",
    label: "Last Watched",
  },
];

export default function RecentlyWatchedScreen() {
  const router = useRouter();
  const { data: watchedVideos = [], isLoading } = useLibraryWatchedQuery();

  const handleWatchRow = (item: LibraryWatchedItem) => {
    router.push(getWatchHref(item) as never);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerBackTitle: "Library",
          headerShown: true,
          headerStyle: { backgroundColor: "#060606" },
          headerTintColor: "#FFFFFF",
          title: "Recently Watched",
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
              <View style={styles.iconBadge}>
                <Ionicons color="#06B6D4" name="videocam-outline" size={24} />
              </View>
              <View style={styles.titleTextCol}>
                <Text style={styles.title}>Recently Watched</Text>
                <Text style={styles.subtitle}>
                  Video content you&apos;ve viewed ({watchedVideos.length}{" "}
                  videos)
                </Text>
              </View>
            </View>
          </View>

          {isLoading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color="#B8A3FF" />
              <Text style={styles.loadingText}>Loading video history…</Text>
            </View>
          ) : null}

          {!isLoading && watchedVideos.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons color="#8F8F8F" name="videocam-outline" size={36} />
              <Text style={styles.emptyTitle}>No watch history yet</Text>
              <Text style={styles.emptyDesc}>
                Watch battles, live streams, and music videos to see your
                history here.
              </Text>
              <Link asChild href="/live">
                <Pressable style={styles.browseBtn}>
                  <Text style={styles.browseBtnText}>Explore Live</Text>
                </Pressable>
              </Link>
            </View>
          ) : null}

          {!isLoading && watchedVideos.length > 0 ? (
            <LibraryDataTable
              data={watchedVideos}
              emptyMessage="No watched videos match your filter."
              filterPlaceholder="Filter watched videos..."
              getArtist={(row) => row.creator}
              getBadges={(row) => [{ label: row.type }]}
              getCoverUrl={(row) => row.thumbnail}
              getId={(row) => row.id}
              getPrimaryMeta={(row) => row.duration}
              getSecondaryMeta={(row) => formatRelativeTime(row.watchedAt)}
              getTitle={(row) => row.title}
              itemCountLabel="video(s)"
              onArtistPress={(row) => {
                if (row.creatorSlug) {
                  router.push(`/artist/${row.creatorSlug}` as never);
                }
              }}
              onPlayPress={(row) => {
                handleWatchRow(row);
              }}
              onRowPress={(row) => {
                handleWatchRow(row);
              }}
              renderRowActions={(row) => (
                <View style={styles.actionsRow}>
                  <Pressable
                    accessibilityLabel={`Watch ${row.title} again`}
                    accessibilityRole="button"
                    onPress={() => {
                      handleWatchRow(row);
                    }}
                    style={({ pressed }) => [
                      styles.watchBtn,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons color="#F8F8F8" name="play" size={12} />
                    <Text style={styles.watchBtnText}>Watch</Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel={`Share ${row.title}`}
                    accessibilityRole="button"
                    onPress={() => {
                      void Share.share({
                        message: `${row.title} by ${row.creator}`,
                        title: row.title,
                      });
                    }}
                    style={({ pressed }) => [
                      styles.shareBtn,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons
                      color="#A3A3A3"
                      name="share-social-outline"
                      size={15}
                    />
                  </Pressable>
                </View>
              )}
              searchKeys={(row) => [row.title, row.creator, row.type]}
              sortColumns={SORT_COLUMNS}
            />
          ) : null}
        </ScrollView>
      </Container>
    </>
  );
}

const styles = StyleSheet.create({
  actionsRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
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
    backgroundColor: "rgba(6, 182, 212, 0.14)",
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
  pressed: {
    opacity: 0.78,
  },
  shareBtn: {
    alignItems: "center",
    backgroundColor: "#141417",
    borderColor: "#212121",
    borderRadius: 8,
    borderWidth: 1,
    height: 30,
    justifyContent: "center",
    width: 30,
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
  watchBtn: {
    alignItems: "center",
    backgroundColor: "#141417",
    borderColor: "#212121",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  watchBtnText: {
    color: "#F8F8F8",
    fontSize: 11,
    fontWeight: "700",
  },
});
