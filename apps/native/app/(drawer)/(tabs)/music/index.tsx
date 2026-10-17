/* oxlint-disable one-var, sort-vars, no-nested-ternary, eqeqeq, no-eq-null, react/preserve-manual-memoization, react-hooks/exhaustive-deps */
/* eslint-disable one-var, sort-vars, no-nested-ternary, eqeqeq, no-eq-null, react/preserve-manual-memoization, react-hooks/exhaustive-deps */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { Href } from "expo-router";
import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { CartHeaderButton } from "@/components/cart/cart-header-button";
import { Container } from "@/components/container";
import { DiscoverSection } from "@/components/discover-section";
import type { DiscoverCardData } from "@/components/discover-section";
import { LiquidGlassView } from "@/components/liquid-glass";
import { NAV_THEME } from "@/lib/constants";
import {
  useCommunitiesQuery,
  useGenresQuery,
  usePublicProjectsQuery,
  useTracksQuery,
  useVideosQuery,
} from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

const GENRE_EMOJIS: Record<string, string> = {
    afrobeats: "🥁",
    country: "🤠",
    electronic: "🎹",
    "hip-hop": "🎤",
    indie: "🎧",
    jazz: "🎺",
    latin: "💃",
    metal: "🤘",
    pop: "⭐",
    "rb-soul": "🎵",
    reggae: "🌴",
    rock: "🎸",
    "spoken-word": "🎙️",
  },
  LOCATION_OPTIONS = [
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
    { label: "Global", region: "all", regionType: "global" as const },
  ],
  SORT_OPTIONS = [
    { label: "Most Plays", value: "plays-desc" },
    { label: "Newest", value: "date-desc" },
    { label: "Title (A-Z)", value: "title-asc" },
  ],
  CATALOG_ROUTES = [
    {
      description: "Songs, charts, and regional track discovery",
      href: "/tracks",
      icon: "musical-notes-outline" as const,
      title: "Songs",
    },
    {
      description: "Albums, EPs, mixtapes, and bundles",
      href: "/projects",
      icon: "disc-outline" as const,
      title: "Projects",
    },
    {
      description: "Music videos and visual releases",
      href: "/videos",
      icon: "videocam-outline" as const,
      title: "Videos",
    },
    {
      description: "Browse by sound, scene, and style",
      href: "/genres",
      icon: "pricetags-outline" as const,
      title: "Genres",
    },
    {
      description: "Paid drops and fan purchases",
      href: "/shop",
      icon: "bag-handle-outline" as const,
      title: "Shop",
    },
    {
      description: "Artist-led spaces, posts, and member chat",
      href: "/communities",
      icon: "chatbubbles-outline" as const,
      title: "Communities",
    },
  ];

export default function MusicScreen() {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    router = useRouter(),
    [catalogModalVisible, setCatalogModalVisible] = useState(false),
    [locationIndex, setLocationIndex] = useState(0),
    [genreFilter, setGenreFilter] = useState("all"),
    [sortFilter, setSortFilter] = useState("plays-desc"),
    [pickerOpen, setPickerOpen] = useState<
      null | "genre" | "location" | "sort"
    >(null),
    activeLocation = LOCATION_OPTIONS[locationIndex] ?? LOCATION_OPTIONS[0],
    genresQuery = useGenresQuery(),
    genres = genresQuery.data ?? [],
    queryPayload = useMemo(
      () => ({
        genre: genreFilter === "all" ? undefined : genreFilter,
        region: activeLocation.region,
        regionType: activeLocation.regionType,
        sort: sortFilter,
      }),
      [activeLocation, genreFilter, sortFilter]
    ),
    tracksQuery = useTracksQuery({
      genre: queryPayload.genre,
      limit: 10,
      region: queryPayload.region,
      regionType: queryPayload.regionType,
      scope: "public",
      sort: queryPayload.sort,
    }),
    projectsQuery = usePublicProjectsQuery({
      genre: queryPayload.genre,
      limit: 10,
      region: queryPayload.region,
      regionType: queryPayload.regionType,
      sort: "date-desc",
    }),
    videosQuery = useVideosQuery({
      limit: 10,
      region: queryPayload.region,
      regionType: queryPayload.regionType,
      scope: "public",
    }),
    shopQuery = useTracksQuery({
      forSale: true,
      genre: queryPayload.genre,
      limit: 10,
      region: queryPayload.region,
      regionType: queryPayload.regionType,
      scope: "public",
      sort: "plays-desc",
    }),
    communitiesQuery = useCommunitiesQuery({
      genre: queryPayload.genre,
    }),
    songCards: DiscoverCardData[] = useMemo(
      () =>
        (tracksQuery.data ?? []).map((track) => ({
          href: `/tracks/${track.id}`,
          id: track.id,
          imageUrl: track.coverArtUrl,
          subtitle: track.artistName ?? "Unknown Artist",
          title: track.title,
        })),
      [tracksQuery.data]
    ),
    projectCards: DiscoverCardData[] = useMemo(
      () =>
        (projectsQuery.data ?? []).map((project) => ({
          badge: project.projectType?.toUpperCase(),
          href: `/projects/${project.id}`,
          id: project.id,
          imageUrl: project.coverArtUrl,
          subtitle: project.artistName ?? "SoundKit Creator",
          title: project.title,
        })),
      [projectsQuery.data]
    ),
    videoCards: DiscoverCardData[] = useMemo(
      () =>
        (videosQuery.data ?? []).map((video) => ({
          href: `/videos/${video.id}`,
          id: video.id,
          imageUrl: video.thumbnailUrl,
          subtitle: video.creatorName ?? "Creator",
          title: video.title,
        })),
      [videosQuery.data]
    ),
    shopCards: DiscoverCardData[] = useMemo(
      () =>
        (shopQuery.data ?? []).map((item) => ({
          badge:
            typeof item.priceCents === "number"
              ? `$${(item.priceCents / 100).toFixed(2)}`
              : "$1.99",
          href: `/tracks/${item.id}`,
          id: item.id,
          imageUrl: item.coverArtUrl,
          subtitle: item.artistName ?? "SoundKit Shop",
          title: item.title,
        })),
      [shopQuery.data]
    ),
    communityCards: DiscoverCardData[] = useMemo(
      () =>
        (communitiesQuery.data ?? []).map((comm) => ({
          badge: `${comm.memberCount} members`,
          href: "/communities",
          id: comm.id,
          subtitle:
            typeof comm.genre === "string"
              ? comm.genre
              : (comm.genre?.name ?? "Community"),
          title: comm.name,
        })),
      [communitiesQuery.data]
    ),
    genreCards: DiscoverCardData[] = useMemo(
      () =>
        genres.map((g) => ({
          badge: GENRE_EMOJIS[g.slug] ?? "🎵",
          href: `/tracks?genre=${encodeURIComponent(g.slug)}`,
          id: g.id,
          subtitle: "Explore genre",
          title: g.name,
        })),
      [genres]
    ),
    activeGenreName =
      genres.find((g) => g.slug === genreFilter)?.name ?? "All Genres",
    activeSortLabel =
      SORT_OPTIONS.find((s) => s.value === sortFilter)?.label ?? "Most Plays";

  return (
    <Container>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.eyebrow, { color: theme.primary }]}>
              EXPLORE CATALOG
            </Text>
            <Text style={[styles.pageTitle, { color: theme.text }]}>Music</Text>
          </View>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
            <CartHeaderButton />
            <Pressable
              accessibilityLabel="Open catalog navigation sheet"
              accessibilityRole="button"
              onPress={() => setCatalogModalVisible(true)}
              style={({ pressed }) => [
                styles.catalogJumpBtn,
                {
                  backgroundColor: pressed ? "#212121" : "#111111",
                  borderColor: "#212121",
                },
              ]}
            >
              <Ionicons color="#B8A3FF" name="apps-outline" size={16} />
              <Text style={styles.catalogJumpBtnText}>Jump to Catalog</Text>
            </Pressable>
          </View>
        </View>

        {/* Filter Dropdowns Bar */}
        <View style={styles.filterRow}>
          {/* Location Dropdown */}
          <Pressable
            onPress={() =>
              setPickerOpen(pickerOpen === "location" ? null : "location")
            }
            style={[
              styles.filterPill,
              { backgroundColor: "#0B0B0B", borderColor: "#212121" },
            ]}
          >
            <Ionicons color="#8F8F8F" name="location-outline" size={13} />
            <Text numberOfLines={1} style={styles.filterPillText}>
              {activeLocation.label}
            </Text>
            <Ionicons color="#8F8F8F" name="chevron-down" size={13} />
          </Pressable>

          {/* Genre Dropdown */}
          <Pressable
            onPress={() =>
              setPickerOpen(pickerOpen === "genre" ? null : "genre")
            }
            style={[
              styles.filterPill,
              { backgroundColor: "#0B0B0B", borderColor: "#212121" },
            ]}
          >
            <Ionicons color="#8F8F8F" name="pricetag-outline" size={13} />
            <Text numberOfLines={1} style={styles.filterPillText}>
              {activeGenreName}
            </Text>
            <Ionicons color="#8F8F8F" name="chevron-down" size={13} />
          </Pressable>

          {/* Sort Dropdown */}
          <Pressable
            onPress={() => setPickerOpen(pickerOpen === "sort" ? null : "sort")}
            style={[
              styles.filterPill,
              { backgroundColor: "#0B0B0B", borderColor: "#212121" },
            ]}
          >
            <Ionicons color="#8F8F8F" name="swap-vertical-outline" size={13} />
            <Text numberOfLines={1} style={styles.filterPillText}>
              {activeSortLabel}
            </Text>
            <Ionicons color="#8F8F8F" name="chevron-down" size={13} />
          </Pressable>
        </View>

        {/* Floating dropdown overlay when open */}
        {pickerOpen ? (
          <LiquidGlassView
            borderRadius={16}
            style={styles.dropdownModalCard}
            variant="sheet"
          >
            <View style={styles.dropdownHeader}>
              <Text style={styles.dropdownTitle}>
                {pickerOpen === "location"
                  ? "Select Location"
                  : pickerOpen === "genre"
                    ? "Select Genre"
                    : "Sort By"}
              </Text>
              <Pressable onPress={() => setPickerOpen(null)}>
                <Ionicons color="#8F8F8F" name="close" size={18} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 220 }}>
              {pickerOpen === "location"
                ? LOCATION_OPTIONS.map((loc, idx) => (
                    <Pressable
                      key={loc.label}
                      onPress={() => {
                        setLocationIndex(idx);
                        setPickerOpen(null);
                      }}
                      style={[
                        styles.dropdownItem,
                        locationIndex === idx && styles.dropdownItemActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dropdownItemText,
                          locationIndex === idx &&
                            styles.dropdownItemTextActive,
                        ]}
                      >
                        {loc.label}
                      </Text>
                    </Pressable>
                  ))
                : pickerOpen === "genre"
                  ? [
                      <Pressable
                        key="all"
                        onPress={() => {
                          setGenreFilter("all");
                          setPickerOpen(null);
                        }}
                        style={[
                          styles.dropdownItem,
                          genreFilter === "all" && styles.dropdownItemActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dropdownItemText,
                            genreFilter === "all" &&
                              styles.dropdownItemTextActive,
                          ]}
                        >
                          All Genres
                        </Text>
                      </Pressable>,
                      ...genres.map((g) => (
                        <Pressable
                          key={g.id}
                          onPress={() => {
                            setGenreFilter(g.slug);
                            setPickerOpen(null);
                          }}
                          style={[
                            styles.dropdownItem,
                            genreFilter === g.slug && styles.dropdownItemActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.dropdownItemText,
                              genreFilter === g.slug &&
                                styles.dropdownItemTextActive,
                            ]}
                          >
                            {GENRE_EMOJIS[g.slug] ?? "🎵"} {g.name}
                          </Text>
                        </Pressable>
                      )),
                    ]
                  : SORT_OPTIONS.map((s) => (
                      <Pressable
                        key={s.value}
                        onPress={() => {
                          setSortFilter(s.value);
                          setPickerOpen(null);
                        }}
                        style={[
                          styles.dropdownItem,
                          sortFilter === s.value && styles.dropdownItemActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dropdownItemText,
                            sortFilter === s.value &&
                              styles.dropdownItemTextActive,
                          ]}
                        >
                          {s.label}
                        </Text>
                      </Pressable>
                    ))}
            </ScrollView>
          </LiquidGlassView>
        ) : null}

        {/* Section 1: Top Songs */}
        <DiscoverSection
          data={songCards}
          emptyMessage="No songs found matching your filters."
          isLoading={tracksQuery.isLoading}
          seeAllHref={`/tracks?region=${activeLocation.region}&genre=${genreFilter}&sort=${sortFilter}`}
          title="Top Songs"
        />

        {/* Section 2: Projects */}
        <DiscoverSection
          data={projectCards}
          emptyMessage="No projects found in this selection."
          isLoading={projectsQuery.isLoading}
          seeAllHref={`/projects?region=${activeLocation.region}&genre=${genreFilter}`}
          title="Featured Projects"
        />

        {/* Section 3: Videos */}
        <DiscoverSection
          data={videoCards}
          emptyMessage="No videos found in this selection."
          isLoading={videosQuery.isLoading}
          seeAllHref="/videos"
          title="Videos"
        />

        {/* Section 4: Shop */}
        <DiscoverSection
          data={shopCards}
          emptyMessage="No store items available right now."
          isLoading={shopQuery.isLoading}
          seeAllHref="/shop"
          title="SoundKit Shop"
        />

        {/* Section 5: Communities */}
        <DiscoverSection
          data={communityCards}
          emptyMessage="No communities created in this genre yet."
          isLoading={communitiesQuery.isLoading}
          seeAllHref="/communities"
          title="Communities"
        />

        {/* Section 6: Genres */}
        <DiscoverSection
          data={genreCards}
          emptyMessage="No genres found."
          isLoading={genresQuery.isLoading}
          seeAllHref="/genres"
          title="Genres"
        />
      </ScrollView>

      {/* Catalog Jump Modal (Mirroring Image 3) */}
      <Modal
        animationType="fade"
        onRequestClose={() => setCatalogModalVisible(false)}
        transparent
        visible={catalogModalVisible}
      >
        <Pressable
          onPress={() => setCatalogModalVisible(false)}
          style={styles.modalBackdrop}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{ maxWidth: 440, width: "90%" }}
          >
            <LiquidGlassView
              borderRadius={22}
              intensity={85}
              style={styles.catalogModalCard}
              variant="sheet"
            >
              <View style={styles.catalogModalHeader}>
                <View>
                  <Text style={styles.catalogModalTitle}>Music</Text>
                  <Text style={styles.catalogModalSubtitle}>
                    Jump into SoundKit catalog routes.
                  </Text>
                </View>
                <Pressable
                  accessibilityLabel="Close"
                  onPress={() => setCatalogModalVisible(false)}
                  style={styles.closeBtn}
                >
                  <Ionicons color="#e4e4e7" name="close-circle" size={24} />
                </Pressable>
              </View>

              <View style={styles.catalogRoutesList}>
                {CATALOG_ROUTES.map((route) => (
                  <Pressable
                    key={route.title}
                    onPress={() => {
                      setCatalogModalVisible(false);
                      router.push(route.href as Href);
                    }}
                    style={({ pressed }) => [
                      styles.catalogRouteItem,
                      {
                        backgroundColor: pressed
                          ? "rgba(255, 255, 255, 0.1)"
                          : "rgba(255, 255, 255, 0.05)",
                      },
                    ]}
                  >
                    <View style={styles.catalogRouteIconBox}>
                      <Ionicons color="#B8A3FF" name={route.icon} size={20} />
                    </View>
                    <View style={styles.catalogRouteCopy}>
                      <Text style={styles.catalogRouteTitle}>
                        {route.title}
                      </Text>
                      <Text numberOfLines={1} style={styles.catalogRouteDesc}>
                        {route.description}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </LiquidGlassView>
          </Pressable>
        </Pressable>
      </Modal>
    </Container>
  );
}

const styles = StyleSheet.create({
  catalogJumpBtn: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  catalogJumpBtnText: {
    color: "#f4f4f5",
    fontSize: 12,
    fontWeight: "700",
  },
  catalogModalCard: {
    gap: 16,
    padding: 20,
    width: "100%",
  },
  catalogModalHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  catalogModalSubtitle: {
    color: "#8F8F8F",
    fontSize: 13,
    marginTop: 2,
  },
  catalogModalTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
  },
  catalogRouteCopy: {
    flex: 1,
    gap: 2,
  },
  catalogRouteDesc: {
    color: "#8F8F8F",
    fontSize: 12,
  },
  catalogRouteIconBox: {
    alignItems: "center",
    backgroundColor: "rgba(184, 163, 255, 0.16)",
    borderRadius: 10,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  catalogRouteItem: {
    alignItems: "center",
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  catalogRouteTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  catalogRoutesList: {
    gap: 10,
  },
  closeBtn: {
    padding: 4,
  },
  content: {
    gap: 22,
    paddingBottom: 40,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  dropdownHeader: {
    alignItems: "center",
    borderBottomColor: "#212121",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 8,
  },
  dropdownItem: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  dropdownItemActive: {
    backgroundColor: "#a855f725",
  },
  dropdownItemText: {
    color: "#e4e4e7",
    fontSize: 13,
  },
  dropdownItemTextActive: {
    color: "#B8A3FF",
    fontWeight: "700",
  },
  dropdownModalCard: {
    backgroundColor: "#18181c",
    borderColor: "#212121",
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
    marginTop: -10,
    padding: 12,
  },
  dropdownTitle: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  filterPill: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  filterPillText: {
    color: "#f4f4f5",
    fontSize: 12,
    fontWeight: "600",
    maxWidth: 90,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  modalBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.75)",
    flex: 1,
    justifyContent: "center",
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
});
