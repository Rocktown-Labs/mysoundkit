/* eslint-disable sort-vars */
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Container } from "@/components/container";
import { NativeImage } from "@/components/native-image";
import { NativeRail } from "@/components/native-rail";
import { NativeSection } from "@/components/native-section";
import { NAV_THEME } from "@/lib/constants";
import { useGenresQuery, useTracksQuery } from "@/lib/soundkit-api";
import type { TrackSummary } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

export default function ShopScreen() {
  const params = useLocalSearchParams<{ genre?: string; view?: string }>(),
    { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    [view, setView] = useState<"grid" | "list">(
      params.view === "list" ? "list" : "grid"
    ),
    genre = params.genre ?? "all",
    genres = useGenresQuery(),
    items = useTracksQuery({
      forSale: true,
      genre: genre === "all" ? undefined : genre,
      limit: 100,
      region: "us-arkansas",
      regionType: "north-america",
      scope: "public",
      sort: "plays-desc",
    }),
    tracks = useMemo(
      () => (items.data ?? []).filter((track) => track.isForSale),
      [items.data]
    ),
    activeGenre =
      genres.data?.find((item) => item.slug === genre)?.name ?? "All Genres";

  return (
    <Container>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: theme.text }]}>
              SoundKit Store
            </Text>
          </View>
          <Text style={[styles.description, { color: theme.mutedText }]}>
            Buy beats, stems, and commercial licenses directly from verified
            SoundKit creators.
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.filterRow}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          <ShopFilter active={genre === "all"} label="All Genres" slug="all" />
          {(genres.data ?? []).map((item) => (
            <ShopFilter
              active={genre === item.slug}
              key={item.id}
              label={item.name}
              slug={item.slug}
            />
          ))}
        </ScrollView>

        <View style={styles.controlsRow}>
          <View>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              {genre === "all"
                ? "Featured Purchasable Songs"
                : `${activeGenre} Catalog`}
            </Text>
            <Text style={[styles.count, { color: theme.mutedText }]}>
              Showing {tracks.length} purchasable releases
            </Text>
          </View>
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

        {view === "grid" ? (
          <View style={styles.grid}>
            {tracks.map((track) => (
              <ShopTrackCard key={track.id} track={track} />
            ))}
          </View>
        ) : (
          <View style={styles.list}>
            {tracks.map((track) => (
              <ShopListRow key={track.id} track={track} />
            ))}
          </View>
        )}

        {genre === "all" ? (
          <View style={styles.rails}>
            {(genres.data ?? []).map((item) => (
              <ShopGenreRail
                key={item.id}
                genre={item.slug}
                title={item.name}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </Container>
  );
}

function ShopFilter({
  active,
  label,
  slug,
}: {
  active: boolean;
  label: string;
  slug: string;
}) {
  const router = useRouter();

  return (
    <Pressable
      accessibilityLabel={`Filter by ${label}`}
      accessibilityRole="button"
      onPress={() => {
        router.setParams({ genre: slug });
      }}
      style={({ pressed }) => [
        styles.filter,
        active && styles.filterActive,
        pressed && { opacity: 0.8 },
      ]}
    >
      <Text style={[styles.filterText, active && styles.filterTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function ShopTrackCard({ track }: { track: TrackSummary }) {
  const router = useRouter();

  return (
    <Pressable
      accessibilityLabel={`View track ${track.title} by ${track.artistName}`}
      accessibilityRole="button"
      onPress={() => {
        router.push(`/tracks/${track.id}` as never);
      }}
      style={({ pressed }) => [
        styles.shopCard,
        pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
      ]}
    >
      <View style={styles.shopArt}>
        <NativeImage
          contentFit="cover"
          source={track.coverArtUrl ?? undefined}
          style={styles.shopImage}
        />
        <View style={styles.heart}>
          <Ionicons color="#FFFFFF" name="heart-outline" size={12} />
        </View>
      </View>
      <Text numberOfLines={1} style={styles.cardTitle}>
        {track.title}
      </Text>
      <Text numberOfLines={1} style={styles.cardArtist}>
        {track.artistName}
      </Text>
      <View style={styles.cardBottom}>
        <Text style={styles.price}>
          {(track.priceCents ?? 199) / 100 >= 10
            ? `$${((track.priceCents ?? 199) / 100).toFixed(0)}`
            : `$${((track.priceCents ?? 199) / 100).toFixed(2)}`}
        </Text>
        <Text style={styles.buy}>Buy license</Text>
      </View>
    </Pressable>
  );
}

function ShopListRow({ track }: { track: TrackSummary }) {
  const router = useRouter();

  return (
    <Pressable
      accessibilityLabel={`View track ${track.title} by ${track.artistName}`}
      accessibilityRole="button"
      onPress={() => {
        router.push(`/tracks/${track.id}` as never);
      }}
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
        <Text style={styles.cardArtist}>{track.artistName}</Text>
        <Text style={styles.price}>
          ${((track.priceCents ?? 199) / 100).toFixed(2)}
        </Text>
      </View>
      <Ionicons color="#8F8F8F" name="chevron-forward" size={16} />
    </Pressable>
  );
}

function ShopGenreRail({ genre, title }: { genre: string; title: string }) {
  const query = useTracksQuery({
      forSale: true,
      genre,
      limit: 12,
      region: "us-arkansas",
      regionType: "north-america",
      scope: "public",
      sort: "plays-desc",
    }),
    tracks = (query.data ?? []).filter((track) => track.isForSale);

  if (!query.isLoading && tracks.length === 0) {
    return null;
  }

  return (
    <NativeSection
      title={title}
      viewAllHref={`/shop?genre=${encodeURIComponent(genre)}` as never}
    >
      <NativeRail>
        {tracks.map((track) => (
          <ShopTrackCard key={track.id} track={track} />
        ))}
      </NativeRail>
    </NativeSection>
  );
}

const styles = StyleSheet.create({
  buy: { color: "#8F8F8F", fontSize: 10, textTransform: "capitalize" },
  cardArtist: { color: "#8F8F8F", fontSize: 11 },
  cardBottom: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  cardTitle: { color: "#F8F8F8", fontSize: 12, fontWeight: "700" },
  content: { gap: 20, padding: 20, paddingBottom: 56 },
  controlsRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  count: { fontSize: 11, marginTop: 3 },
  description: { fontSize: 14, lineHeight: 20 },
  filter: {
    backgroundColor: "#0B0B0B",
    borderColor: "#212121",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterActive: { backgroundColor: "#B8A3FF", borderColor: "#B8A3FF" },
  filterRow: { gap: 6, paddingRight: 20 },
  filterText: { color: "#D4D4D8", fontSize: 11, fontWeight: "700" },
  filterTextActive: { color: "#09090B" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  header: { gap: 8 },
  heart: {
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 999,
    padding: 5,
    position: "absolute",
    right: 6,
    top: 6,
  },
  list: { gap: 8 },
  listCopy: { flex: 1, gap: 3 },
  listImage: { borderRadius: 8, height: 54, width: 54 },
  listRow: {
    alignItems: "center",
    backgroundColor: "#080808",
    borderColor: "#212121",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 9,
  },
  price: { color: "#B8A3FF", fontSize: 12, fontWeight: "800" },
  rails: { gap: 24 },
  sectionTitle: { fontSize: 17, fontWeight: "800" },
  shopArt: { aspectRatio: 1, position: "relative" },
  shopCard: { gap: 4, width: 150 },
  shopImage: { borderRadius: 10, height: "100%", width: "100%" },
  title: { fontSize: 22, fontWeight: "800" },
  titleRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  toggleButton: { borderRadius: 6, padding: 7 },
  viewToggle: {
    backgroundColor: "#111111",
    borderColor: "#212121",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    padding: 2,
  },
});
