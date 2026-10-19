/* oxlint-disable one-var, sort-vars, no-nested-ternary, default-case, react/preserve-manual-memoization */
/* eslint-disable complexity */
import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import type { Href } from "expo-router";
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
import { LiquidGlassView } from "@/components/liquid-glass";
import { NativeImage } from "@/components/native-image";
import { NAV_THEME } from "@/lib/constants";
import { useArtistsQuery, useGenresQuery } from "@/lib/soundkit-api";
import type { ArtistSummary } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

const NORTH_AMERICA_LOCATIONS = [
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
    {
      label: "All North America",
      region: "all",
      regionType: "north-america" as const,
    },
  ],
  GLOBAL_CONTINENTS = [
    { label: "All Global", region: "all", regionType: "global" as const },
    { label: "Africa", region: "africa", regionType: "global" as const },
    { label: "Asia", region: "asia", regionType: "global" as const },
    { label: "Europe", region: "europe", regionType: "global" as const },
    {
      label: "Latin America",
      region: "south-america",
      regionType: "global" as const,
    },
  ],
  SORT_OPTIONS = [
    { label: "Rank (High to Low)", value: "rank-asc" },
    { label: "Rank (Low to High)", value: "rank-desc" },
    { label: "Followers (High to Low)", value: "followers-desc" },
    { label: "Weekly Plays (High to Low)", value: "plays-desc" },
    { label: "Name (A-Z)", value: "name-asc" },
    { label: "Name (Z-A)", value: "name-desc" },
  ],
  TOP_SECTION_LIMIT = 20;

interface LeaderboardSectionProps {
  artists: ArtistSummary[];
  description: string;
  iconName?: keyof typeof Ionicons.glyphMap;
  title: string;
  type: "new" | "rising" | "top";
  viewAllHref: string;
}

function ArtistRailCard({
  artist,
  type,
}: {
  artist: ArtistSummary;
  type: "new" | "rising" | "top";
}) {
  const router = useRouter(),
    statLabel = useMemo(() => {
      switch (type) {
        case "rising": {
          const plays = artist.weeklyPlays ?? 0;
          return `${plays.toLocaleString()} plays this week`;
        }
        case "new": {
          return `${(artist.followers ?? 0).toLocaleString()} followers`;
        }
        case "top": {
          return `${(artist.followers ?? 0).toLocaleString()} followers`;
        }
      }
    }, [artist, type]);

  let statColor = "#B8A3FF",
    statIcon: "people-outline" | "trending-up" | "trophy-outline" =
      "trending-up";
  if (type === "new") {
    statColor = "#4ade80";
    statIcon = "people-outline";
  } else if (type === "top") {
    statColor = "#B8A3FF";
    statIcon = "trophy-outline";
  }

  const href = artist.username
    ? `/artists/${artist.username}`
    : "/artists/list";

  return (
    <Pressable
      accessibilityHint={`Opens profile of ${artist.name}`}
      accessibilityLabel={artist.name}
      accessibilityRole="button"
      onPress={() => router.push(href as Href)}
      style={({ pressed }) => [
        styles.railCard,
        pressed && styles.railCardPressed,
      ]}
    >
      <View style={styles.railAvatarBox}>
        {artist.avatarUrl ? (
          <NativeImage
            contentFit="cover"
            source={artist.avatarUrl}
            style={styles.railAvatarImg}
          />
        ) : (
          <View style={styles.railAvatarPlaceholder}>
            <Text style={styles.avatarInitials}>
              {artist.name
                .split(" ")
                .map((p) => p.charAt(0).toUpperCase())
                .slice(0, 2)
                .join("")}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.artistInfo}>
        <View style={styles.artistNameRow}>
          <Text numberOfLines={1} style={styles.artistName}>
            {artist.name}
          </Text>
          {artist.verified ? (
            <Ionicons color="#B8A3FF" name="checkmark-circle" size={14} />
          ) : null}
        </View>

        <Text numberOfLines={1} style={styles.artistMeta}>
          {[artist.genre ?? "Hip-Hop", artist.location]
            .filter(Boolean)
            .join(" • ")}
        </Text>

        <View style={styles.statRow}>
          <Ionicons color={statColor} name={statIcon} size={12} />
          <Text
            numberOfLines={1}
            style={[styles.statText, { color: statColor }]}
          >
            {statLabel}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function LeaderboardSection({
  artists,
  description,
  iconName,
  title,
  type,
  viewAllHref,
}: LeaderboardSectionProps) {
  const topTwenty = artists.slice(0, TOP_SECTION_LIMIT);

  return (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeaderRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>{title}</Text>
          </View>
          <Text style={styles.sectionSubtitle}>{description}</Text>
        </View>

        <Link href={viewAllHref as Href} asChild>
          <Pressable hitSlop={8} style={styles.viewAllBtn}>
            <Text style={styles.viewAllText}>View All</Text>
            <Ionicons color="#B8A3FF" name="chevron-forward" size={14} />
          </Pressable>
        </Link>
      </View>

      {topTwenty.length > 0 ? (
        <ScrollView
          contentContainerStyle={styles.horizontalRail}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {topTwenty.map((artist) => (
            <ArtistRailCard
              artist={artist}
              key={artist.id || artist.username || artist.name}
              type={type}
            />
          ))}
        </ScrollView>
      ) : (
        <View style={styles.emptyLeaderboard}>
          <Text style={styles.emptyText}>
            No artists found for this selection yet.
          </Text>
        </View>
      )}
    </View>
  );
}

function filterArtists(list?: readonly ArtistSummary[], query = "") {
  if (!list) {
    return [];
  }
  const q = query.toLowerCase().trim();
  if (!q) {
    return [...list];
  }
  return list.filter(
    (a) =>
      a.name.toLowerCase().includes(q) ||
      a.genre?.toLowerCase().includes(q) ||
      a.location?.toLowerCase().includes(q)
  );
}

export default function ArtistsScreen() {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    [searchQuery, setSearchQuery] = useState(""),
    [naIndex, setNaIndex] = useState(0),
    [continentIndex, setContinentIndex] = useState(0),
    [activeScope, setActiveScope] = useState<"global" | "na">("na"),
    [genreFilter, setGenreFilter] = useState("all"),
    [sortFilter, setSortFilter] = useState("rank-asc"),
    [activePicker, setActivePicker] = useState<
      null | "continent" | "genre" | "na" | "sort"
    >(null),
    genresQuery = useGenresQuery(),
    genres = genresQuery.data ?? [],
    activeNa = NORTH_AMERICA_LOCATIONS[naIndex] ?? NORTH_AMERICA_LOCATIONS[0],
    activeContinent = GLOBAL_CONTINENTS[continentIndex] ?? GLOBAL_CONTINENTS[0],
    activeLocation = activeScope === "global" ? activeContinent : activeNa,
    queryPayload = useMemo(
      () => ({
        genre: genreFilter === "all" ? undefined : genreFilter,
        region: activeLocation.region,
        regionType: activeLocation.regionType,
        sort: sortFilter,
      }),
      [activeLocation, genreFilter, sortFilter]
    ),
    risingQuery = useArtistsQuery({
      category: "rising",
      genre: queryPayload.genre,
      limit: TOP_SECTION_LIMIT,
      q: searchQuery || undefined,
      region: queryPayload.region,
      regionType: queryPayload.regionType,
      sort: queryPayload.sort,
    }),
    newQuery = useArtistsQuery({
      category: "new",
      genre: queryPayload.genre,
      limit: TOP_SECTION_LIMIT,
      q: searchQuery || undefined,
      region: queryPayload.region,
      regionType: queryPayload.regionType,
      sort: queryPayload.sort,
    }),
    topQuery = useArtistsQuery({
      category: "top",
      genre: queryPayload.genre,
      limit: TOP_SECTION_LIMIT,
      q: searchQuery || undefined,
      region: queryPayload.region,
      regionType: queryPayload.regionType,
      sort: queryPayload.sort,
    }),
    genreArtistsQuery = useArtistsQuery({
      category: "top",
      genre: genreFilter === "all" ? "hip-hop" : genreFilter,
      limit: TOP_SECTION_LIMIT,
      region: queryPayload.region,
      regionType: queryPayload.regionType,
    }),
    risingArtists = useMemo(
      () => filterArtists(risingQuery.data, searchQuery),
      [risingQuery.data, searchQuery]
    ),
    newArtists = useMemo(
      () => filterArtists(newQuery.data, searchQuery),
      [newQuery.data, searchQuery]
    ),
    topArtists = useMemo(
      () => filterArtists(topQuery.data, searchQuery),
      [topQuery.data, searchQuery]
    ),
    genreRailArtists = useMemo(
      () => (genreArtistsQuery.data ?? []).slice(0, TOP_SECTION_LIMIT),
      [genreArtistsQuery.data]
    ),
    activeGenreLabel =
      genres.find((g) => g.slug === genreFilter)?.name ?? "All Genres",
    activeSortLabel =
      SORT_OPTIONS.find((s) => s.value === sortFilter)?.label ??
      "Rank (High to Low)",
    buildViewAllHref = (
      category: "new" | "rising" | "top",
      genreOverride?: string
    ) => {
      const params = new URLSearchParams({ category });
      const resolvedGenre =
        genreOverride ?? (genreFilter === "all" ? undefined : genreFilter);
      if (resolvedGenre) {
        params.set("genre", resolvedGenre);
      }
      if (sortFilter) {
        params.set("sort", sortFilter);
      }
      if (activeLocation.region && activeLocation.region !== "all") {
        params.set("region", activeLocation.region);
      }
      params.set("regionType", activeLocation.regionType);
      return `/artists/list?${params.toString()}`;
    };

  let pickerHeaderTitle = "Sort Order";
  if (activePicker === "na") {
    pickerHeaderTitle = "North America Region";
  } else if (activePicker === "continent") {
    pickerHeaderTitle = "Global Continent";
  } else if (activePicker === "genre") {
    pickerHeaderTitle = "Select Genre";
  }

  const renderPickerContent = () => {
    if (activePicker === "na") {
      return NORTH_AMERICA_LOCATIONS.map((loc, idx) => (
        <Pressable
          key={loc.label}
          onPress={() => {
            setNaIndex(idx);
            setActiveScope("na");
            setActivePicker(null);
          }}
          style={[
            styles.pickerItem,
            naIndex === idx && activeScope === "na" && styles.pickerItemActive,
          ]}
        >
          <Text
            style={[
              styles.pickerItemText,
              naIndex === idx &&
                activeScope === "na" &&
                styles.pickerItemTextActive,
            ]}
          >
            {loc.label}
          </Text>
        </Pressable>
      ));
    }
    if (activePicker === "continent") {
      return GLOBAL_CONTINENTS.map((cont, idx) => (
        <Pressable
          key={cont.label}
          onPress={() => {
            setContinentIndex(idx);
            setActiveScope("global");
            setActivePicker(null);
          }}
          style={[
            styles.pickerItem,
            continentIndex === idx &&
              activeScope === "global" &&
              styles.pickerItemActive,
          ]}
        >
          <Text
            style={[
              styles.pickerItemText,
              continentIndex === idx &&
                activeScope === "global" &&
                styles.pickerItemTextActive,
            ]}
          >
            {cont.label}
          </Text>
        </Pressable>
      ));
    }
    if (activePicker === "genre") {
      return (
        <>
          <Pressable
            key="all"
            onPress={() => {
              setGenreFilter("all");
              setActivePicker(null);
            }}
            style={[
              styles.pickerItem,
              genreFilter === "all" && styles.pickerItemActive,
            ]}
          >
            <Text
              style={[
                styles.pickerItemText,
                genreFilter === "all" && styles.pickerItemTextActive,
              ]}
            >
              All Genres
            </Text>
          </Pressable>
          {genres.map((g) => (
            <Pressable
              key={g.id}
              onPress={() => {
                setGenreFilter(g.slug);
                setActivePicker(null);
              }}
              style={[
                styles.pickerItem,
                genreFilter === g.slug && styles.pickerItemActive,
              ]}
            >
              <Text
                style={[
                  styles.pickerItemText,
                  genreFilter === g.slug && styles.pickerItemTextActive,
                ]}
              >
                {g.name}
              </Text>
            </Pressable>
          ))}
        </>
      );
    }
    return SORT_OPTIONS.map((s) => (
      <Pressable
        key={s.value}
        onPress={() => {
          setSortFilter(s.value);
          setActivePicker(null);
        }}
        style={[
          styles.pickerItem,
          sortFilter === s.value && styles.pickerItemActive,
        ]}
      >
        <Text
          style={[
            styles.pickerItemText,
            sortFilter === s.value && styles.pickerItemTextActive,
          ]}
        >
          {s.label}
        </Text>
      </Pressable>
    ));
  };

  return (
    <Container>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.searchBar}>
          <Ionicons color="#8F8F8F" name="search" size={16} />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setSearchQuery}
            placeholder="Search artists..."
            placeholderTextColor="#8F8F8F"
            style={styles.searchInput}
            value={searchQuery}
          />
          {searchQuery ? (
            <Pressable hitSlop={8} onPress={() => setSearchQuery("")}>
              <Ionicons color="#8F8F8F" name="close-circle" size={16} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>
            Discover Artists
          </Text>
          <Text style={[styles.subtitle, { color: theme.mutedText }]}>
            Find new talent and established stars by region, genre, and
            momentum.
          </Text>
        </View>

        <View style={styles.filtersGrid}>
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>North America</Text>
            <Pressable
              onPress={() =>
                setActivePicker(activePicker === "na" ? null : "na")
              }
              style={[
                styles.filterDropdown,
                activeScope === "na" && styles.filterDropdownActive,
              ]}
            >
              <Text numberOfLines={1} style={styles.filterDropdownText}>
                {activeNa.label}
              </Text>
              <Ionicons color="#8F8F8F" name="chevron-down" size={14} />
            </Pressable>
          </View>

          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Global</Text>
            <Pressable
              onPress={() =>
                setActivePicker(
                  activePicker === "continent" ? null : "continent"
                )
              }
              style={[
                styles.filterDropdown,
                activeScope === "global" && styles.filterDropdownActive,
              ]}
            >
              <Text numberOfLines={1} style={styles.filterDropdownText}>
                {activeContinent.label}
              </Text>
              <Ionicons color="#8F8F8F" name="chevron-down" size={14} />
            </Pressable>
          </View>

          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Genre</Text>
            <Pressable
              onPress={() =>
                setActivePicker(activePicker === "genre" ? null : "genre")
              }
              style={styles.filterDropdown}
            >
              <Text numberOfLines={1} style={styles.filterDropdownText}>
                {activeGenreLabel}
              </Text>
              <Ionicons color="#8F8F8F" name="chevron-down" size={14} />
            </Pressable>
          </View>

          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Sort By</Text>
            <Pressable
              onPress={() =>
                setActivePicker(activePicker === "sort" ? null : "sort")
              }
              style={styles.filterDropdown}
            >
              <Text numberOfLines={1} style={styles.filterDropdownText}>
                {activeSortLabel}
              </Text>
              <Ionicons color="#8F8F8F" name="chevron-down" size={14} />
            </Pressable>
          </View>
        </View>

        {activePicker ? (
          <LiquidGlassView
            borderRadius={16}
            style={styles.pickerModal}
            variant="sheet"
          >
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>{pickerHeaderTitle}</Text>
              <Pressable onPress={() => setActivePicker(null)}>
                <Ionicons color="#8F8F8F" name="close" size={18} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 220 }}>
              {renderPickerContent()}
            </ScrollView>
          </LiquidGlassView>
        ) : null}

        <LeaderboardSection
          artists={risingArtists}
          description="Artists on the rise with growing momentum"
          iconName="trending-up"
          title="Rising Stars"
          type="rising"
          viewAllHref={buildViewAllHref("rising")}
        />

        <LeaderboardSection
          artists={newArtists}
          description="Fresh talent joining the scene"
          iconName="sparkles"
          title="New Artists"
          type="new"
          viewAllHref={buildViewAllHref("new")}
        />

        <LeaderboardSection
          artists={topArtists}
          description="The most popular artists right now"
          iconName="trophy-outline"
          title="Top Artists This Month"
          type="top"
          viewAllHref={buildViewAllHref("top")}
        />

        <View style={styles.genreRailSection}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>Top Artists By Genre</Text>
              <Text style={styles.sectionSubtitle}>
                Compact genre lists with profile cards.
              </Text>
            </View>
          </View>

          <View style={styles.genreRailHeaderRow}>
            <Text style={styles.genreSubheading}>
              {genreFilter === "all" ? "Hip-Hop" : activeGenreLabel}
            </Text>
            <Link
              href={
                buildViewAllHref(
                  "top",
                  genreFilter === "all" ? "hip-hop" : genreFilter
                ) as Href
              }
              asChild
            >
              <Pressable hitSlop={8} style={styles.viewAllBtn}>
                <Text style={styles.viewAllText}>View All</Text>
                <Ionicons color="#B8A3FF" name="chevron-forward" size={14} />
              </Pressable>
            </Link>
          </View>

          <ScrollView
            contentContainerStyle={styles.horizontalRail}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {genreRailArtists.map((artist) => {
              const href = artist.username
                ? `/artists/${artist.username}`
                : "/artists/list";

              return (
                <Link
                  href={href as Href}
                  asChild
                  key={artist.id || artist.username || artist.name}
                >
                  <Pressable
                    style={({ pressed }) => [
                      styles.railCard,
                      pressed && styles.railCardPressed,
                    ]}
                  >
                    <View style={styles.railAvatarBox}>
                      {artist.avatarUrl ? (
                        <NativeImage
                          contentFit="cover"
                          source={artist.avatarUrl}
                          style={styles.railAvatarImg}
                        />
                      ) : (
                        <View style={styles.railAvatarPlaceholder}>
                          <Ionicons color="#8F8F8F" name="person" size={32} />
                        </View>
                      )}
                    </View>
                    <View style={styles.artistInfo}>
                      <View style={styles.artistNameRow}>
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
                      <View style={styles.genreBadge}>
                        <Text style={styles.genreBadgeText}>
                          {artist.genre ?? "Hip-Hop"}
                        </Text>
                      </View>
                      <Text style={styles.followersText}>
                        {(artist.followers ?? 0).toLocaleString()} followers
                      </Text>
                    </View>
                  </Pressable>
                </Link>
              );
            })}
          </ScrollView>
        </View>
      </ScrollView>
    </Container>
  );
}

const styles = StyleSheet.create({
  artistInfo: {
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 10,
    width: "100%",
  },
  artistMeta: {
    color: "#8F8F8F",
    fontSize: 11,
  },
  artistName: {
    color: "#ffffff",
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "700",
  },
  artistNameRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
  },
  avatarInitials: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
  },
  content: {
    gap: 24,
    paddingBottom: 40,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  emptyLeaderboard: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderColor: "#212121",
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 24,
  },
  emptyText: {
    color: "#8F8F8F",
    fontSize: 13,
    textAlign: "center",
  },
  filterDropdown: {
    alignItems: "center",
    backgroundColor: "#0B0B0B",
    borderColor: "#212121",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  filterDropdownActive: {
    backgroundColor: "#1e1b2e",
    borderColor: "#a855f7",
  },
  filterDropdownText: {
    color: "#f4f4f5",
    fontSize: 12,
    fontWeight: "600",
  },
  filterGroup: {
    flexBasis: "48%",
    flexGrow: 1,
    gap: 6,
  },
  filterLabel: {
    color: "#8F8F8F",
    fontSize: 11,
    fontWeight: "700",
  },
  filtersGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  followersText: {
    color: "#8F8F8F",
    fontSize: 11,
    marginTop: 2,
  },
  genreBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#212121",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  genreBadgeText: {
    color: "#e4e4e7",
    fontSize: 10,
    fontWeight: "700",
  },
  genreRailHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  genreRailSection: {
    gap: 12,
    marginTop: 6,
  },
  genreSubheading: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  header: {
    gap: 4,
  },
  horizontalRail: {
    gap: 12,
    paddingRight: 20,
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
    backgroundColor: "#a855f725",
  },
  pickerItemText: {
    color: "#e4e4e7",
    fontSize: 13,
  },
  pickerItemTextActive: {
    color: "#B8A3FF",
    fontWeight: "700",
  },
  pickerModal: {
    gap: 8,
    marginTop: -6,
    padding: 14,
  },
  pickerTitle: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  railAvatarBox: {
    aspectRatio: 1,
    backgroundColor: "#141418",
    overflow: "hidden",
    width: "100%",
  },
  railAvatarImg: {
    height: "100%",
    width: "100%",
  },
  railAvatarPlaceholder: {
    alignItems: "center",
    backgroundColor: "#18181f",
    height: "100%",
    justifyContent: "center",
    width: "100%",
  },
  railCard: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderCurve: "continuous",
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    width: 148,
  },
  railCardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  searchBar: {
    alignItems: "center",
    backgroundColor: "#0B0B0B",
    borderColor: "#212121",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: {
    color: "#ffffff",
    flex: 1,
    fontSize: 14,
  },
  sectionContainer: {
    gap: 12,
  },
  sectionHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sectionSubtitle: {
    color: "#8F8F8F",
    fontSize: 13,
    marginTop: 2,
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800",
  },
  sectionTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  statRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
    marginTop: 2,
  },
  statText: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  viewAllBtn: {
    alignItems: "center",
    flexDirection: "row",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  viewAllText: {
    color: "#B8A3FF",
    fontSize: 13,
    fontWeight: "700",
  },
});
