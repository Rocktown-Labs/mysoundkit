/* oxlint-disable one-var, sort-vars, no-nested-ternary, complexity, unicorn/no-array-sort */
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import type { Href } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { LiquidGlassView } from "@/components/liquid-glass";
import { NativeEmptyState } from "@/components/native-collection-grid";
import { NativeImage } from "@/components/native-image";
import { NAV_THEME } from "@/lib/constants";
import { useArtistsQuery, useGenresQuery } from "@/lib/soundkit-api";
import type { ArtistSummary } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

type CategoryValue = "" | "new" | "rising" | "top";

const CATEGORIES: readonly { label: string; value: CategoryValue }[] = [
    { label: "All", value: "" },
    { label: "Rising Stars", value: "rising" },
    { label: "New Artists", value: "new" },
    { label: "Top Artists", value: "top" },
  ],
  STAT_SORT_OPTIONS = [
    { label: "Rank (Best First)", value: "rank-asc" },
    { label: "Most Followers", value: "followers-desc" },
    { label: "Most Weekly Plays", value: "plays-desc" },
    { label: "Most Tracks", value: "tracks-desc" },
    { label: "Name (A–Z)", value: "name-asc" },
    { label: "Name (Z–A)", value: "name-desc" },
  ] as const,
  REGION_OPTIONS = [
    { label: "All Regions", region: "all", regionType: "global" as const },
    {
      label: "All North America",
      region: "all",
      regionType: "north-america" as const,
    },
    {
      label: "Arkansas, US",
      region: "us-arkansas",
      regionType: "north-america" as const,
    },
    {
      label: "California, US",
      region: "us-california",
      regionType: "north-america" as const,
    },
    {
      label: "New York, US",
      region: "us-new-york",
      regionType: "north-america" as const,
    },
    {
      label: "Texas, US",
      region: "us-texas",
      regionType: "north-america" as const,
    },
    { label: "Europe", region: "europe", regionType: "global" as const },
    { label: "Africa", region: "africa", regionType: "global" as const },
    { label: "Asia", region: "asia", regionType: "global" as const },
    {
      label: "Latin America",
      region: "south-america",
      regionType: "global" as const,
    },
  ] as const;

function sortArtistsByStat(
  artists: readonly ArtistSummary[],
  sortValue: string
): ArtistSummary[] {
  const copy = [...artists];
  switch (sortValue) {
    case "followers-desc": {
      return copy.sort((a, b) => (b.followers ?? 0) - (a.followers ?? 0));
    }
    case "plays-desc": {
      return copy.sort((a, b) => (b.weeklyPlays ?? 0) - (a.weeklyPlays ?? 0));
    }
    case "tracks-desc": {
      return copy.sort((a, b) => (b.trackCount ?? 0) - (a.trackCount ?? 0));
    }
    case "name-asc": {
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    }
    case "name-desc": {
      return copy.sort((a, b) => b.name.localeCompare(a.name));
    }
    default: {
      return copy;
    }
  }
}

export default function ArtistDirectoryScreen() {
  const params = useLocalSearchParams<{
      category?: string;
      genre?: string;
      region?: string;
      regionType?: "global" | "north-america";
      sort?: string;
    }>(),
    router = useRouter(),
    { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    initialCategory: CategoryValue =
      params.category === "rising" ||
      params.category === "new" ||
      params.category === "top"
        ? params.category
        : "",
    [category, setCategory] = useState<CategoryValue>(initialCategory),
    [genre, setGenre] = useState(params.genre ?? "all"),
    [sortBy, setSortBy] = useState(params.sort ?? "rank-asc"),
    [regionIdx, setRegionIdx] = useState(() => {
      if (!params.region) {
        return 0;
      }
      const found = REGION_OPTIONS.findIndex(
        (r) =>
          r.region === params.region &&
          (!params.regionType || r.regionType === params.regionType)
      );
      return found === -1 ? 0 : found;
    }),
    [search, setSearch] = useState(""),
    [activePicker, setActivePicker] = useState<
      null | "genre" | "region" | "sort"
    >(null),
    genresQuery = useGenresQuery(),
    genres = genresQuery.data ?? [],
    selectedRegion = REGION_OPTIONS[regionIdx] ?? REGION_OPTIONS[0],
    artistsQuery = useArtistsQuery({
      category: category || undefined,
      genre: genre === "all" ? undefined : genre,
      limit: 60,
      q: search || undefined,
      region:
        selectedRegion.region === "all" &&
        selectedRegion.regionType === "global"
          ? undefined
          : selectedRegion.region,
      regionType: selectedRegion.regionType,
      sort:
        sortBy === "followers-desc" ||
        sortBy === "plays-desc" ||
        sortBy === "tracks-desc"
          ? "rank-asc"
          : sortBy,
    }),
    filteredArtists = useMemo(() => {
      const base = artistsQuery.data ?? [];
      const q = search.trim().toLowerCase();
      const searched = q
        ? base.filter(
            (a) =>
              a.name.toLowerCase().includes(q) ||
              a.genre?.toLowerCase().includes(q) ||
              a.location?.toLowerCase().includes(q)
          )
        : base;
      return sortArtistsByStat(searched, sortBy);
    }, [artistsQuery.data, search, sortBy]),
    activeGenreLabel =
      genre === "all"
        ? "All Genres"
        : (genres.find((g) => g.slug === genre)?.name ?? genre),
    activeSortLabel =
      STAT_SORT_OPTIONS.find((s) => s.value === sortBy)?.label ??
      "Rank (Best First)",
    pageTitle =
      CATEGORIES.find((c) => c.value === category)?.label ?? "All Artists";

  return (
    <>
      <Stack.Screen
        options={{
          headerBackTitle: "Back",
          headerShown: true,
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerTransparent: false,
          title: pageTitle,
        }}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: theme.background, flex: 1 }}
      >
        <View style={styles.headerBlock}>
          <Text style={[styles.heading, { color: theme.text }]}>
            {pageTitle}
          </Text>
          <Text style={[styles.subheading, { color: theme.mutedText }]}>
            Filter artists by momentum, listener stats, genre, and region.
          </Text>
        </View>

        <View
          style={[
            styles.searchBar,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <Ionicons color={theme.mutedText} name="search" size={16} />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setSearch}
            placeholder="Search by artist, genre, or city..."
            placeholderTextColor={theme.mutedText}
            style={[styles.searchInput, { color: theme.text }]}
            value={search}
          />
          {search ? (
            <Pressable hitSlop={8} onPress={() => setSearch("")}>
              <Ionicons color={theme.mutedText} name="close-circle" size={16} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          contentContainerStyle={styles.categoryStrip}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {CATEGORIES.map((item) => {
            const active = category === item.value;
            return (
              <Pressable
                key={item.label}
                onPress={() => {
                  setCategory(item.value);
                }}
                style={[
                  styles.categoryPill,
                  {
                    backgroundColor: active ? theme.primary : theme.card,
                    borderColor: active ? theme.primary : theme.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.categoryPillText,
                    {
                      color: active ? theme.primaryForeground : theme.text,
                    },
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.filtersRow}>
          <Pressable
            onPress={() =>
              setActivePicker(activePicker === "sort" ? null : "sort")
            }
            style={[
              styles.filterChip,
              activePicker === "sort" && styles.filterChipActive,
            ]}
          >
            <Ionicons color="#B8A3FF" name="stats-chart" size={13} />
            <Text numberOfLines={1} style={styles.filterChipText}>
              {activeSortLabel}
            </Text>
            <Ionicons color="#8F8F8F" name="chevron-down" size={13} />
          </Pressable>

          <Pressable
            onPress={() =>
              setActivePicker(activePicker === "genre" ? null : "genre")
            }
            style={[
              styles.filterChip,
              activePicker === "genre" && styles.filterChipActive,
            ]}
          >
            <Ionicons color="#B8A3FF" name="musical-notes-outline" size={13} />
            <Text numberOfLines={1} style={styles.filterChipText}>
              {activeGenreLabel}
            </Text>
            <Ionicons color="#8F8F8F" name="chevron-down" size={13} />
          </Pressable>

          <Pressable
            onPress={() =>
              setActivePicker(activePicker === "region" ? null : "region")
            }
            style={[
              styles.filterChip,
              activePicker === "region" && styles.filterChipActive,
            ]}
          >
            <Ionicons color="#B8A3FF" name="globe-outline" size={13} />
            <Text numberOfLines={1} style={styles.filterChipText}>
              {selectedRegion.label}
            </Text>
            <Ionicons color="#8F8F8F" name="chevron-down" size={13} />
          </Pressable>
        </View>

        {activePicker ? (
          <LiquidGlassView
            borderRadius={16}
            style={styles.pickerSheet}
            variant="sheet"
          >
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>
                {activePicker === "sort"
                  ? "Filter & Sort by Artist Stats"
                  : activePicker === "genre"
                    ? "Filter by Genre"
                    : "Filter by Region"}
              </Text>
              <Pressable onPress={() => setActivePicker(null)}>
                <Ionicons color="#8F8F8F" name="close" size={18} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 220 }}>
              {activePicker === "sort"
                ? STAT_SORT_OPTIONS.map((option) => (
                    <Pressable
                      key={option.value}
                      onPress={() => {
                        setSortBy(option.value);
                        setActivePicker(null);
                      }}
                      style={[
                        styles.pickerItem,
                        sortBy === option.value && styles.pickerItemActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.pickerItemText,
                          sortBy === option.value &&
                            styles.pickerItemTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  ))
                : null}
              {activePicker === "genre" ? (
                <>
                  <Pressable
                    onPress={() => {
                      setGenre("all");
                      setActivePicker(null);
                    }}
                    style={[
                      styles.pickerItem,
                      genre === "all" && styles.pickerItemActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        genre === "all" && styles.pickerItemTextActive,
                      ]}
                    >
                      All Genres
                    </Text>
                  </Pressable>
                  {genres.map((g) => (
                    <Pressable
                      key={g.id}
                      onPress={() => {
                        setGenre(g.slug);
                        setActivePicker(null);
                      }}
                      style={[
                        styles.pickerItem,
                        genre === g.slug && styles.pickerItemActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.pickerItemText,
                          genre === g.slug && styles.pickerItemTextActive,
                        ]}
                      >
                        {g.name}
                      </Text>
                    </Pressable>
                  ))}
                </>
              ) : null}
              {activePicker === "region"
                ? REGION_OPTIONS.map((loc, idx) => (
                    <Pressable
                      key={loc.label}
                      onPress={() => {
                        setRegionIdx(idx);
                        setActivePicker(null);
                      }}
                      style={[
                        styles.pickerItem,
                        regionIdx === idx && styles.pickerItemActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.pickerItemText,
                          regionIdx === idx && styles.pickerItemTextActive,
                        ]}
                      >
                        {loc.label}
                      </Text>
                    </Pressable>
                  ))
                : null}
            </ScrollView>
          </LiquidGlassView>
        ) : null}

        {artistsQuery.isLoading ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 32 }} />
        ) : filteredArtists.length === 0 ? (
          <NativeEmptyState>
            No artists match the current filters.
          </NativeEmptyState>
        ) : (
          <View style={styles.grid}>
            {filteredArtists.map((artist) => (
              <Pressable
                accessibilityRole="button"
                key={artist.id || artist.username || artist.name}
                onPress={() => {
                  router.push(`/artists/${artist.username}` as Href);
                }}
                style={({ pressed }) => [
                  styles.artistCard,
                  pressed && styles.artistCardPressed,
                ]}
              >
                <View style={styles.avatarBox}>
                  {artist.avatarUrl ? (
                    <NativeImage
                      contentFit="cover"
                      source={artist.avatarUrl}
                      style={styles.avatarImg}
                    />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarInitials}>
                        {artist.name.slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.nameRow}>
                    <Text numberOfLines={1} style={styles.artistName}>
                      {artist.name}
                    </Text>
                    {artist.verified ? (
                      <Ionicons
                        color="#B8A3FF"
                        name="checkmark-circle"
                        size={14}
                      />
                    ) : null}
                  </View>
                  <Text numberOfLines={1} style={styles.artistMeta}>
                    {[artist.genre ?? "Hip-Hop", artist.location]
                      .filter(Boolean)
                      .join(" • ")}
                  </Text>
                  <View style={styles.statsBadges}>
                    <View style={styles.statBadge}>
                      <Ionicons
                        color="#B8A3FF"
                        name="people-outline"
                        size={11}
                      />
                      <Text style={styles.statBadgeText}>
                        {(artist.followers ?? 0).toLocaleString()}
                      </Text>
                    </View>
                    {artist.weeklyPlays === undefined ||
                    artist.weeklyPlays === null ? null : (
                      <View style={styles.statBadge}>
                        <Ionicons
                          color="#4ade80"
                          name="trending-up"
                          size={11}
                        />
                        <Text style={styles.statBadgeText}>
                          {artist.weeklyPlays.toLocaleString()} plays
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  artistCard: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderCurve: "continuous",
    borderRadius: 16,
    borderWidth: 1,
    flexBasis: "47%",
    flexGrow: 1,
    maxWidth: "48.5%",
    overflow: "hidden",
    width: "48%",
  },
  artistCardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  artistMeta: {
    color: "#8F8F8F",
    fontSize: 11,
  },
  artistName: {
    color: "#F8F8F8",
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "800",
  },
  avatarBox: {
    aspectRatio: 1,
    backgroundColor: "#141418",
    width: "100%",
  },
  avatarFallback: {
    alignItems: "center",
    backgroundColor: "#18181f",
    height: "100%",
    justifyContent: "center",
    width: "100%",
  },
  avatarImg: {
    height: "100%",
    width: "100%",
  },
  avatarInitials: {
    color: "#8F8F8F",
    fontSize: 28,
    fontWeight: "800",
  },
  cardBody: {
    gap: 4,
    padding: 12,
  },
  categoryPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  categoryStrip: {
    gap: 8,
  },
  content: {
    gap: 16,
    padding: 18,
    paddingBottom: 48,
  },
  filterChip: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 6,
    minWidth: 100,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  filterChipActive: {
    backgroundColor: "rgba(184, 163, 255, 0.15)",
    borderColor: "#B8A3FF",
  },
  filterChipText: {
    color: "#F8F8F8",
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
  },
  filtersRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
  },
  headerBlock: {
    gap: 4,
  },
  heading: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  nameRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
  },
  pickerHeader: {
    alignItems: "center",
    borderBottomColor: "rgba(255, 255, 255, 0.12)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 8,
  },
  pickerItem: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  pickerItemActive: {
    backgroundColor: "rgba(184, 163, 255, 0.18)",
  },
  pickerItemText: {
    color: "#E4E4E7",
    fontSize: 13,
  },
  pickerItemTextActive: {
    color: "#B8A3FF",
    fontWeight: "700",
  },
  pickerSheet: {
    gap: 8,
    padding: 14,
  },
  pickerTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  searchBar: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  statBadge: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 6,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  statBadgeText: {
    color: "#D4D4D8",
    fontSize: 10,
    fontWeight: "700",
  },
  statsBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  subheading: {
    fontSize: 13,
    lineHeight: 18,
  },
});
