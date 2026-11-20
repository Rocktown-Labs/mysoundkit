/* eslint-disable sort-vars */
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Container } from "@/components/container";
import { NativeImage } from "@/components/native-image";
import { NativePhysicalMediaVisual } from "@/components/shop/physical-media-visual";
import { NAV_THEME } from "@/lib/constants";
import {
  useGenresQuery,
  usePublicMerchQuery,
  usePublicPhysicalReleasesQuery,
  useTracksQuery,
} from "@/lib/soundkit-api";
import type {
  PublicMerchDesign,
  PublicPhysicalRelease,
  TrackSummary,
} from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

type ShopCategory =
  | "accessories"
  | "all"
  | "apparel"
  | "cd"
  | "digital"
  | "dvd"
  | "home"
  | "merch"
  | "vinyl";

const CATEGORY_TABS: { id: ShopCategory; label: string }[] = [
    { id: "all", label: "All" },
    { id: "merch", label: "Merch" },
    { id: "apparel", label: "Apparel" },
    { id: "accessories", label: "Accessories" },
    { id: "home", label: "Home" },
    { id: "vinyl", label: "Vinyl" },
    { id: "cd", label: "CDs" },
    { id: "dvd", label: "DVDs" },
    { id: "digital", label: "Digital" },
  ],
  FORMAT_LABELS: Record<"cd" | "dvd" | "vinyl_12" | "vinyl_7", string> = {
    cd: "Audio CD",
    dvd: "DVD",
    vinyl_12: '12" Vinyl',
    vinyl_7: '7" Vinyl',
  },
  formatPrice = (cents: number | null | undefined) =>
    `$${((typeof cents === "number" ? cents : 199) / 100).toFixed(2)}`;

export default function ShopScreen() {
  const params = useLocalSearchParams<{
      category?: string;
      genre?: string;
      view?: string;
    }>(),
    { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    [category, setCategory] = useState<ShopCategory>(
      (params.category as ShopCategory | undefined) ?? "all"
    ),
    [genre, setGenre] = useState(params.genre ?? "all"),
    [query, setQuery] = useState(""),
    [view, setView] = useState<"grid" | "list">(
      params.view === "list" ? "list" : "grid"
    ),
    genresQuery = useGenresQuery(),
    merchQuery = usePublicMerchQuery({ limit: 48 }),
    physicalQuery = usePublicPhysicalReleasesQuery({ limit: 48 }),
    tracksQuery = useTracksQuery({
      forSale: true,
      genre: genre === "all" ? undefined : genre,
      limit: 60,
      region: "us-arkansas",
      regionType: "north-america",
      scope: "public",
      sort: "plays-desc",
    }),
    normalizedQuery = query.trim().toLowerCase(),
    filteredMerch = useMemo(() => {
      if (
        category !== "all" &&
        category !== "merch" &&
        category !== "apparel" &&
        category !== "accessories" &&
        category !== "home"
      ) {
        return [];
      }
      return (merchQuery.data ?? []).filter((item) => {
        const cat = item.category ?? "Apparel";
        if (category === "apparel" && cat !== "Apparel") {
          return false;
        }
        if (category === "accessories" && cat !== "Accessories") {
          return false;
        }
        if (category === "home" && cat !== "Home & living") {
          return false;
        }
        if (!normalizedQuery) {
          return true;
        }
        return (
          item.title.toLowerCase().includes(normalizedQuery) ||
          (item.artistName ?? "").toLowerCase().includes(normalizedQuery)
        );
      });
    }, [category, merchQuery.data, normalizedQuery]),
    filteredPhysical = useMemo(() => {
      if (
        category !== "all" &&
        category !== "vinyl" &&
        category !== "cd" &&
        category !== "dvd"
      ) {
        return [];
      }
      return (physicalQuery.data ?? []).filter((item) => {
        if (
          category === "vinyl" &&
          item.mediaFormat !== "vinyl_12" &&
          item.mediaFormat !== "vinyl_7"
        ) {
          return false;
        }
        if (category === "cd" && item.mediaFormat !== "cd") {
          return false;
        }
        if (category === "dvd" && item.mediaFormat !== "dvd") {
          return false;
        }
        if (genre !== "all" && item.genreSlug && item.genreSlug !== genre) {
          return false;
        }
        if (!normalizedQuery) {
          return true;
        }
        return (
          item.title.toLowerCase().includes(normalizedQuery) ||
          (item.artistName ?? "").toLowerCase().includes(normalizedQuery)
        );
      });
    }, [category, genre, normalizedQuery, physicalQuery.data]),
    filteredTracks = useMemo(() => {
      if (category !== "all" && category !== "digital") {
        return [];
      }
      return (tracksQuery.data ?? []).filter((track) => {
        if (!track.isForSale) {
          return false;
        }
        if (!normalizedQuery) {
          return true;
        }
        return (
          track.title.toLowerCase().includes(normalizedQuery) ||
          track.artistName.toLowerCase().includes(normalizedQuery)
        );
      });
    }, [category, normalizedQuery, tracksQuery.data]),
    totalCount =
      filteredMerch.length + filteredPhysical.length + filteredTracks.length,
    hasQueryError =
      merchQuery.isError || physicalQuery.isError || tracksQuery.isError,
    retryFailedQueries = () => {
      if (merchQuery.isError) {
        void merchQuery.refetch();
      }
      if (physicalQuery.isError) {
        void physicalQuery.refetch();
      }
      if (tracksQuery.isError) {
        void tracksQuery.refetch();
      }
    },
    showGenreRow =
      category === "all" ||
      category === "digital" ||
      category === "vinyl" ||
      category === "cd" ||
      category === "dvd";

  return (
    <Container>
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>
            SoundKit Store
          </Text>
          <Text style={[styles.description, { color: theme.mutedText }]}>
            Creator merch, limited vinyl pressings, CDs, DVDs, and lossless
            digital tracks.
          </Text>
        </View>

        {/* Search Input */}
        <View style={styles.searchBox}>
          <Ionicons color="#8F8F8F" name="search-outline" size={16} />
          <TextInput
            onChangeText={setQuery}
            placeholder="Search merch, vinyl, tracks…"
            placeholderTextColor="#71717A"
            returnKeyType="search"
            style={styles.searchInput}
            value={query}
          />
          {query.length > 0 ? (
            <Pressable
              accessibilityLabel="Clear search"
              onPress={() => setQuery("")}
            >
              <Ionicons color="#8F8F8F" name="close-circle" size={16} />
            </Pressable>
          ) : null}
        </View>

        {/* Category Pills */}
        <ScrollView
          contentContainerStyle={styles.filterRow}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {CATEGORY_TABS.map((tab) => {
            const active = category === tab.id;
            return (
              <Pressable
                accessibilityRole="button"
                key={tab.id}
                onPress={() => setCategory(tab.id)}
                style={[styles.filter, active && styles.filterActive]}
              >
                <Text
                  style={[styles.filterText, active && styles.filterTextActive]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Genre Pills */}
        {showGenreRow && (genresQuery.data ?? []).length > 0 ? (
          <ScrollView
            contentContainerStyle={styles.filterRow}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            <Pressable
              accessibilityRole="button"
              onPress={() => setGenre("all")}
              style={[
                styles.genreChip,
                genre === "all" && styles.genreChipActive,
              ]}
            >
              <Text
                style={[
                  styles.genreText,
                  genre === "all" && styles.genreTextActive,
                ]}
              >
                All Genres
              </Text>
            </Pressable>
            {(genresQuery.data ?? []).map((item) => (
              <Pressable
                accessibilityRole="button"
                key={item.id}
                onPress={() => setGenre(item.slug)}
                style={[
                  styles.genreChip,
                  genre === item.slug && styles.genreChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.genreText,
                    genre === item.slug && styles.genreTextActive,
                  ]}
                >
                  {item.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        {/* Summary + View Toggle */}
        <View style={styles.controlsRow}>
          <Text style={[styles.count, { color: theme.mutedText }]}>
            Showing {totalCount} {totalCount === 1 ? "item" : "items"}
          </Text>
          <View style={styles.viewToggle}>
            {(["grid", "list"] as const).map((mode) => (
              <Pressable
                accessibilityLabel={`${mode} view`}
                accessibilityRole="button"
                key={mode}
                onPress={() => setView(mode)}
                style={[
                  styles.toggleButton,
                  view === mode && { backgroundColor: theme.primary },
                ]}
              >
                <Ionicons
                  color={view === mode ? theme.primaryForeground : theme.text}
                  name={mode === "grid" ? "grid-outline" : "list-outline"}
                  size={15}
                />
              </Pressable>
            ))}
          </View>
        </View>

        {/* Error Banner */}
        {hasQueryError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>
              Some store items failed to load.
            </Text>
            <Pressable onPress={retryFailedQueries} style={styles.resetButton}>
              <Text style={styles.resetText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Printful Merch Section */}
        {filteredMerch.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Creator Merch &amp; Apparel
            </Text>
            <View style={view === "grid" ? styles.grid : styles.list}>
              {filteredMerch.map((merch) => (
                <NativeMerchCard key={merch.id} merch={merch} mode={view} />
              ))}
            </View>
          </View>
        ) : null}

        {/* Physical Releases Section (Vinyl, CD, DVD) */}
        {filteredPhysical.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Vinyl, CDs &amp; DVDs
            </Text>
            <View style={view === "grid" ? styles.grid : styles.list}>
              {filteredPhysical.map((release) => (
                <NativePhysicalReleaseCard
                  key={release.id}
                  mode={view}
                  release={release}
                />
              ))}
            </View>
          </View>
        ) : null}

        {/* Digital Tracks Section */}
        {filteredTracks.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Digital Releases &amp; Licenses
            </Text>
            <View style={view === "grid" ? styles.grid : styles.list}>
              {filteredTracks.map((track) => (
                <NativeTrackShopCard key={track.id} mode={view} track={track} />
              ))}
            </View>
          </View>
        ) : null}

        {totalCount === 0 &&
        !merchQuery.isLoading &&
        !physicalQuery.isLoading &&
        !tracksQuery.isLoading ? (
          <View style={styles.emptyBox}>
            <Ionicons color="#71717A" name="bag-outline" size={34} />
            <Text style={styles.emptyTitle}>No products found</Text>
            <Text style={styles.emptySubtitle}>
              Try switching categories or clearing your search filter.
            </Text>
            <Pressable
              onPress={() => {
                setCategory("all");
                setGenre("all");
                setQuery("");
              }}
              style={styles.resetButton}
            >
              <Text style={styles.resetText}>Reset filters</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </Container>
  );
}

function NativeMerchCard({
  merch,
  mode,
}: {
  merch: PublicMerchDesign;
  mode: "grid" | "list";
}) {
  const router = useRouter(),
    uniqueColors = [
      ...new Map(
        merch.variantDetails
          .filter((v) => v.colorCode)
          .map((v) => [v.colorCode as string, v.colorCode as string])
      ).values(),
    ].slice(0, 5),
    openDetail = () => {
      router.push(`/shop/${merch.id}?type=merch` as never);
    };

  if (mode === "list") {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={openDetail}
        style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.85 }]}
      >
        <View style={styles.listArtBox}>
          {merch.previewMockupUrl ? (
            <NativeImage
              contentFit="cover"
              source={merch.previewMockupUrl}
              style={styles.listImage}
            />
          ) : (
            <Ionicons color="#71717A" name="shirt-outline" size={22} />
          )}
        </View>
        <View style={styles.listCopy}>
          <Text numberOfLines={1} style={styles.cardTitle}>
            {merch.title}
          </Text>
          <Text numberOfLines={1} style={styles.cardArtist}>
            {merch.artistName ?? "SoundKit Creator"} ·{" "}
            {merch.category ?? "Merch"}
          </Text>
          <Text style={styles.price}>
            {formatPrice(merch.retailPriceCents)}
          </Text>
        </View>
        <Ionicons color="#8F8F8F" name="chevron-forward" size={16} />
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={openDetail}
      style={({ pressed }) => [
        styles.shopCard,
        pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
      ]}
    >
      <View style={styles.merchArt}>
        {merch.previewMockupUrl ? (
          <NativeImage
            contentFit="cover"
            source={merch.previewMockupUrl}
            style={styles.fill}
          />
        ) : (
          <View style={styles.artFallback}>
            <Ionicons color="#71717A" name="shirt-outline" size={28} />
          </View>
        )}
        <View style={styles.formatPill}>
          <Text style={styles.formatPillText}>{merch.category ?? "Merch"}</Text>
        </View>
      </View>
      <View style={styles.cardMeta}>
        <Text numberOfLines={1} style={styles.cardArtist}>
          {merch.artistName ?? "SoundKit Creator"}
        </Text>
        <Text numberOfLines={2} style={styles.cardTitle}>
          {merch.title}
        </Text>
        <Text style={styles.price}>{formatPrice(merch.retailPriceCents)}</Text>
        {uniqueColors.length > 0 ? (
          <View style={styles.swatchRow}>
            {uniqueColors.map((hex) => (
              <View
                key={hex}
                style={[styles.swatchDot, { backgroundColor: hex }]}
              />
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function NativePhysicalReleaseCard({
  mode,
  release,
}: {
  mode: "grid" | "list";
  release: PublicPhysicalRelease;
}) {
  const router = useRouter(),
    formatLabel = FORMAT_LABELS[release.mediaFormat],
    openDetail = () => {
      router.push(`/shop/${release.id}?type=release` as never);
    };

  if (mode === "list") {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={openDetail}
        style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.85 }]}
      >
        <View style={styles.listArtBox}>
          <NativePhysicalMediaVisual
            artworkUrl={release.coverArtUrl}
            format={release.mediaFormat}
            size="sm"
          />
        </View>
        <View style={styles.listCopy}>
          <Text numberOfLines={1} style={styles.cardTitle}>
            {release.title}
          </Text>
          <Text numberOfLines={1} style={styles.cardArtist}>
            {release.artistName ?? "SoundKit Artist"} · {formatLabel}
          </Text>
          <Text style={styles.price}>
            {formatPrice(release.retailPriceCents)}
          </Text>
        </View>
        <Ionicons color="#8F8F8F" name="chevron-forward" size={16} />
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={openDetail}
      style={({ pressed }) => [
        styles.shopCard,
        pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
      ]}
    >
      <View style={styles.merchArt}>
        <NativePhysicalMediaVisual
          artworkUrl={release.coverArtUrl}
          format={release.mediaFormat}
          size="md"
        />
        <View style={styles.formatPill}>
          <Text style={styles.formatPillText}>{formatLabel}</Text>
        </View>
      </View>
      <View style={styles.cardMeta}>
        <Text numberOfLines={1} style={styles.cardArtist}>
          {release.artistName ?? "SoundKit Artist"}
        </Text>
        <Text numberOfLines={2} style={styles.cardTitle}>
          {release.title}
        </Text>
        <View style={styles.cardBottom}>
          <Text style={styles.price}>
            {formatPrice(release.retailPriceCents)}
          </Text>
          {release.includesDigitalDownload ? (
            <Text style={styles.digitalTag}>+ Digital</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function NativeTrackShopCard({
  mode,
  track,
}: {
  mode: "grid" | "list";
  track: TrackSummary;
}) {
  const router = useRouter(),
    openTrack = () => {
      router.push(`/tracks/${track.id}` as never);
    };

  if (mode === "list") {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={openTrack}
        style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.85 }]}
      >
        <NativeImage
          contentFit="cover"
          source={track.coverArtUrl ?? undefined}
          style={styles.listImage}
        />
        <View style={styles.listCopy}>
          <Text numberOfLines={1} style={styles.cardTitle}>
            {track.title}
          </Text>
          <Text numberOfLines={1} style={styles.cardArtist}>
            {track.artistName} · Digital
          </Text>
          <Text style={styles.price}>{formatPrice(track.priceCents)}</Text>
        </View>
        <Ionicons color="#8F8F8F" name="chevron-forward" size={16} />
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={openTrack}
      style={({ pressed }) => [
        styles.shopCard,
        pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
      ]}
    >
      <View style={styles.shopArt}>
        <NativeImage
          contentFit="cover"
          source={track.coverArtUrl ?? undefined}
          style={styles.fill}
        />
        <View style={styles.formatPill}>
          <Text style={styles.formatPillText}>Digital</Text>
        </View>
      </View>
      <View style={styles.cardMeta}>
        <Text numberOfLines={1} style={styles.cardArtist}>
          {track.artistName}
        </Text>
        <Text numberOfLines={1} style={styles.cardTitle}>
          {track.title}
        </Text>
        <View style={styles.cardBottom}>
          <Text style={styles.price}>{formatPrice(track.priceCents)}</Text>
          <Text style={styles.buy}>Buy license</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  artFallback: {
    alignItems: "center",
    backgroundColor: "#141417",
    flex: 1,
    justifyContent: "center",
  },
  buy: { color: "#8F8F8F", fontSize: 10 },
  cardArtist: { color: "#8F8F8F", fontSize: 11 },
  cardBottom: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
  },
  cardMeta: { gap: 3, padding: 10 },
  cardTitle: { color: "#F8F8F8", fontSize: 13, fontWeight: "700" },
  content: { gap: 16, padding: 18, paddingBottom: 64 },
  controlsRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  count: { fontSize: 12 },
  description: { fontSize: 14, lineHeight: 20 },
  digitalTag: { color: "#B8A3FF", fontSize: 10, fontWeight: "700" },
  emptyBox: {
    alignItems: "center",
    backgroundColor: "#0C0C0E",
    borderColor: "#232329",
    borderCurve: "continuous",
    borderRadius: 16,
    borderStyle: "dashed",
    borderWidth: 1,
    gap: 8,
    padding: 28,
  },
  emptySubtitle: { color: "#8F8F8F", fontSize: 13, textAlign: "center" },
  emptyTitle: { color: "#F8F8F8", fontSize: 16, fontWeight: "700" },
  errorBanner: {
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderColor: "rgba(239, 68, 68, 0.35)",
    borderCurve: "continuous",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorText: { color: "#FCA5A5", flex: 1, fontSize: 12, fontWeight: "600" },
  fill: { height: "100%", width: "100%" },
  filter: {
    backgroundColor: "#0B0B0D",
    borderColor: "#26262C",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  filterActive: { backgroundColor: "#B8A3FF", borderColor: "#B8A3FF" },
  filterRow: { gap: 7, paddingRight: 18 },
  filterText: { color: "#D4D4D8", fontSize: 12, fontWeight: "700" },
  filterTextActive: { color: "#09090B" },
  formatPill: {
    backgroundColor: "rgba(9, 9, 11, 0.78)",
    borderRadius: 999,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    position: "absolute",
    top: 8,
  },
  formatPillText: { color: "#F4F4F5", fontSize: 10, fontWeight: "700" },
  genreChip: {
    backgroundColor: "#111114",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  genreChipActive: { backgroundColor: "#27272A" },
  genreText: { color: "#A1A1AA", fontSize: 11, fontWeight: "600" },
  genreTextActive: { color: "#FFFFFF" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  header: { gap: 6 },
  list: { gap: 8 },
  listArtBox: {
    alignItems: "center",
    backgroundColor: "#141417",
    borderCurve: "continuous",
    borderRadius: 8,
    height: 56,
    justifyContent: "center",
    overflow: "hidden",
    width: 56,
  },
  listCopy: { flex: 1, gap: 3 },
  listImage: { borderRadius: 8, height: 56, width: 56 },
  listRow: {
    alignItems: "center",
    backgroundColor: "#0C0C0E",
    borderColor: "#232329",
    borderCurve: "continuous",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 10,
  },
  merchArt: {
    aspectRatio: 0.92,
    backgroundColor: "#141417",
    overflow: "hidden",
    position: "relative",
    width: "100%",
  },
  price: {
    color: "#B8A3FF",
    fontSize: 13,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
  resetButton: {
    borderColor: "#3F3F46",
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  resetText: { color: "#F8F8F8", fontSize: 12, fontWeight: "700" },
  searchBox: {
    alignItems: "center",
    backgroundColor: "#111114",
    borderColor: "#27272A",
    borderCurve: "continuous",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    color: "#F8F8F8",
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  section: { gap: 12 },
  sectionTitle: { fontSize: 17, fontWeight: "800" },
  shopArt: {
    aspectRatio: 1,
    backgroundColor: "#141417",
    overflow: "hidden",
    position: "relative",
    width: "100%",
  },
  shopCard: {
    backgroundColor: "#0D0D10",
    borderColor: "#222228",
    borderCurve: "continuous",
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    width: "48%",
  },
  swatchDot: {
    borderColor: "rgba(255,255,255,0.28)",
    borderRadius: 999,
    borderWidth: 1,
    height: 12,
    width: 12,
  },
  swatchRow: {
    flexDirection: "row",
    gap: 5,
    marginTop: 4,
  },
  title: { fontSize: 24, fontWeight: "800" },
  toggleButton: { borderRadius: 6, padding: 7 },
  viewToggle: {
    backgroundColor: "#111114",
    borderColor: "#26262C",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    padding: 2,
  },
});
