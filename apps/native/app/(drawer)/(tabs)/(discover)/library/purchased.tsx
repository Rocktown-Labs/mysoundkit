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
import { resolveApiUrl, useLibraryPurchasesQuery } from "@/lib/soundkit-api";
import type { PurchasedCatalogItem } from "@/lib/soundkit-api";

function parseDurationToSeconds(duration?: string | null) {
  if (!duration) {
    return 0;
  }
  const parts = duration.split(":").map(Number);
  if (parts.length === 2) {
    return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
  }
  return 0;
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }
  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatProductType(productType: string, licenseName?: string | null) {
  if (licenseName) {
    return licenseName;
  }
  switch (productType) {
    case "track_download": {
      return "Track Download";
    }
    case "project_download": {
      return "Project Bundle";
    }
    case "stem_bundle": {
      return "Stem Pack";
    }
    case "beat_license": {
      return "Beat License";
    }
    default: {
      return "Digital Release";
    }
  }
}

const SORT_COLUMNS: readonly LibrarySortColumn<PurchasedCatalogItem>[] = [
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
    getValue: (row) => row.priceCents,
    id: "priceCents",
    label: "Price",
  },
  {
    getValue: (row) => parseDurationToSeconds(row.duration),
    id: "duration",
    label: "Duration",
  },
  {
    getValue: (row) => row.productType.toLowerCase(),
    id: "productType",
    label: "Type",
  },
  {
    getValue: (row) => new Date(row.purchasedAt).getTime() || 0,
    id: "purchasedAt",
    label: "Purchase Date",
  },
];

export default function PurchasedScreen() {
  const router = useRouter();
  const { playTrack } = useAudioPlayerContext();
  const { data: purchasedSongs = [], isLoading } = useLibraryPurchasesQuery();

  const playableTracks: PlayerTrack[] = useMemo(
    () =>
      purchasedSongs.map((item) => {
        const trackId = item.productId ?? item.id;
        return {
          artist: item.artist,
          cover: item.cover,
          duration: null,
          id: trackId,
          src:
            resolveApiUrl(
              item.downloadUrl ??
                `/v1/tracks/${encodeURIComponent(trackId)}/playback`
            ) ?? "",
          title: item.title,
          trackHref: `/library/purchased/${item.id}`,
        };
      }),
    [purchasedSongs]
  );

  const handlePlayRow = (song: PurchasedCatalogItem) => {
    const trackId = song.productId ?? song.id;
    const targetIndex = playableTracks.findIndex((t) => t.id === trackId);
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
          title: "Purchased Music",
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
                <Ionicons color="#22C55E" name="bag-handle-outline" size={24} />
              </View>
              <View style={styles.titleTextCol}>
                <Text style={styles.title}>Purchased Music</Text>
                <Text style={styles.subtitle}>
                  Music you own ({purchasedSongs.length} items)
                </Text>
              </View>
            </View>
          </View>

          {isLoading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color="#B8A3FF" />
              <Text style={styles.loadingText}>Loading purchases…</Text>
            </View>
          ) : null}

          {!isLoading && purchasedSongs.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons color="#8F8F8F" name="bag-handle-outline" size={36} />
              <Text style={styles.emptyTitle}>No purchases yet</Text>
              <Text style={styles.emptyDesc}>
                Support your favorite artists by purchasing their tracks and
                albums.
              </Text>
              <Link asChild href="/shop">
                <Pressable style={styles.browseBtn}>
                  <Text style={styles.browseBtnText}>Browse Music</Text>
                </Pressable>
              </Link>
            </View>
          ) : null}

          {!isLoading && purchasedSongs.length > 0 ? (
            <LibraryDataTable
              data={purchasedSongs}
              emptyMessage="No purchases match your filter."
              filterPlaceholder="Filter purchased music..."
              getArtist={(row) => row.artist}
              getBadges={(row) => [
                {
                  color: "#22C55E",
                  label: formatProductType(row.productType, row.licenseName),
                },
                ...(row.duration ? [{ label: row.duration }] : []),
              ]}
              getCoverUrl={(row) => row.cover}
              getId={(row) => row.id}
              getPrimaryMeta={(row) => row.priceLabel}
              getSecondaryMeta={(row) => formatDate(row.purchasedAt)}
              getTitle={(row) => row.title}
              itemCountLabel="purchase(s)"
              onArtistPress={(row) => {
                if (row.artistSlug) {
                  router.push(`/artist/${row.artistSlug}` as never);
                }
              }}
              onPlayPress={(row) => {
                handlePlayRow(row);
              }}
              onRowPress={(row) => {
                router.push(`/library/purchased/${row.id}` as never);
              }}
              renderRowActions={(row) => (
                <Pressable
                  accessibilityLabel={`View purchase ${row.title}`}
                  accessibilityRole="button"
                  onPress={() => {
                    router.push(`/library/purchased/${row.id}` as never);
                  }}
                  style={({ pressed }) => [
                    styles.viewBtn,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons color="#F8F8F8" name="eye-outline" size={13} />
                  <Text style={styles.viewBtnText}>View</Text>
                </Pressable>
              )}
              searchKeys={(row) => [
                row.title,
                row.artist,
                row.productType,
                row.licenseName,
              ]}
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
    backgroundColor: "rgba(34, 197, 94, 0.14)",
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
  viewBtn: {
    alignItems: "center",
    backgroundColor: "#141417",
    borderColor: "#212121",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  viewBtnText: {
    color: "#F8F8F8",
    fontSize: 12,
    fontWeight: "700",
  },
});
