/* oxlint-disable one-var, sort-vars, sort-keys, react-hooks/refs */
import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import type { Href } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Container } from "@/components/container";
import { NAV_THEME } from "@/lib/constants";
import { useGenresQuery, useNativeSearchQuery } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

interface GenreCardDef {
  count?: number;
  emoji: string;
  id: string;
  name: string;
  slug: string;
}

const DEFAULT_GENRES: GenreCardDef[] = [
  { count: 36, emoji: "🎤", id: "hip-hop", name: "Hip-Hop", slug: "hip-hop" },
  { count: 0, emoji: "🎵", id: "rb-soul", name: "R&B/Soul", slug: "rb-soul" },
  {
    count: 0,
    emoji: "🎹",
    id: "electronic",
    name: "Electronic",
    slug: "electronic",
  },
  { count: 0, emoji: "⭐", id: "pop", name: "Pop", slug: "pop" },
  {
    count: 0,
    emoji: "🎙️",
    id: "spoken-word",
    name: "Spoken Word",
    slug: "spoken-word",
  },
  { count: 0, emoji: "🎸", id: "rock", name: "Rock", slug: "rock" },
  { count: 0, emoji: "🎺", id: "jazz", name: "Jazz", slug: "jazz" },
  {
    count: 0,
    emoji: "🥁",
    id: "afrobeats",
    name: "Afrobeats",
    slug: "afrobeats",
  },
  { count: 0, emoji: "💃", id: "latin", name: "Latin", slug: "latin" },
  { count: 0, emoji: "🤠", id: "country", name: "Country", slug: "country" },
  { count: 0, emoji: "🌴", id: "reggae", name: "Reggae", slug: "reggae" },
  { count: 0, emoji: "🎧", id: "indie", name: "Indie", slug: "indie" },
  { count: 0, emoji: "🤘", id: "metal", name: "Metal", slug: "metal" },
];

export default function SearchScreen() {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    router = useRouter(),
    [rawInput, setRawInput] = useState(""),
    [debouncedQuery, setDebouncedQuery] = useState(""),
    [isFocused, setIsFocused] = useState(false),
    focusAnim = useRef(new Animated.Value(0)).current,
    genresQuery = useGenresQuery(),
    searchResults = useNativeSearchQuery(debouncedQuery);

  // Debounce search input by 250ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(rawInput.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [rawInput]);

  // Animate search bar focus transition
  useEffect(() => {
    Animated.spring(focusAnim, {
      friction: 8,
      tension: 50,
      toValue: isFocused || rawInput.length > 0 ? 1 : 0,
      useNativeDriver: false,
    }).start();
  }, [focusAnim, isFocused, rawInput.length]);

  const genresList: GenreCardDef[] = useMemo(() => {
      if (!genresQuery.data || genresQuery.data.length === 0) {
        return DEFAULT_GENRES;
      }
      return DEFAULT_GENRES.map((def) => {
        const match = genresQuery.data?.find((g) => g.slug === def.slug);
        return {
          ...def,
          name: match?.name ?? def.name,
        };
      });
    }, [genresQuery.data]),
    showDropdown = rawInput.trim().length > 0,
    artists = searchResults.data?.artists ?? [],
    songs = searchResults.data?.tracks ?? [],
    hasNoResults =
      !searchResults.isLoading &&
      debouncedQuery.length >= 2 &&
      artists.length === 0 &&
      songs.length === 0,
    cancelWidth = focusAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 64],
    }),
    cancelOpacity = focusAnim.interpolate({
      inputRange: [0, 0.4, 1],
      outputRange: [0, 0, 1],
    }),
    cancelPadding = focusAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 10],
    }),
    searchBarScale = focusAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0.995],
    });

  return (
    <Container>
      <View style={styles.container}>
        {/* Top Search Bar */}
        <View style={styles.searchBarWrapper}>
          <Animated.View
            style={[
              styles.searchBar,
              {
                borderColor: isFocused ? "#a855f7" : "#27272a",
                transform: [{ scale: searchBarScale }],
              },
            ]}
          >
            <Ionicons color="#a1a1aa" name="search" size={17} />
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onBlur={() => setIsFocused(false)}
              onChangeText={setRawInput}
              onFocus={() => setIsFocused(true)}
              placeholder="Search genres, artists, songs..."
              placeholderTextColor="#71717a"
              returnKeyType="search"
              style={styles.input}
              value={rawInput}
            />
            {rawInput.length > 0 ? (
              <Pressable
                accessibilityLabel="Clear search"
                hitSlop={8}
                onPress={() => {
                  setRawInput("");
                  setDebouncedQuery("");
                }}
              >
                <Ionicons color="#a1a1aa" name="close-circle" size={18} />
              </Pressable>
            ) : null}
          </Animated.View>
          <Animated.View
            style={[
              styles.cancelButtonWrapper,
              {
                opacity: cancelOpacity,
                paddingLeft: cancelPadding,
                width: cancelWidth,
              },
            ]}
          >
            <Pressable
              hitSlop={8}
              onPress={() => {
                setRawInput("");
                setDebouncedQuery("");
                setIsFocused(false);
                Keyboard.dismiss();
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </Animated.View>
        </View>

        {/* Floating Autocomplete Dropdown (Matching Image 1 & Apple Music style) */}
        {showDropdown ? (
          <View style={styles.dropdownOverlay}>
            <ScrollView
              contentContainerStyle={styles.dropdownContent}
              keyboardShouldPersistTaps="handled"
            >
              {searchResults.isLoading ? (
                <View style={styles.dropdownLoadingRow}>
                  <ActivityIndicator color="#c084fc" size="small" />
                  <Text style={styles.dropdownLoadingText}>
                    Searching SoundKit…
                  </Text>
                </View>
              ) : null}

              {/* Artists Section */}
              {artists.length > 0 ? (
                <View style={styles.dropdownSection}>
                  <Text style={styles.dropdownSectionLabel}>ARTISTS</Text>
                  {artists.slice(0, 4).map((artist) => {
                    const href = artist.username
                      ? `/artist/${artist.username}`
                      : "/artist";

                    return (
                      <Pressable
                        key={artist.id || artist.name}
                        onPress={() => {
                          router.push(href as Href);
                        }}
                        style={({ pressed }) => [
                          styles.dropdownRow,
                          {
                            backgroundColor: pressed
                              ? "#27272a"
                              : "transparent",
                          },
                        ]}
                      >
                        <View style={styles.avatarBox}>
                          {artist.avatarUrl ? (
                            <Image
                              source={{ uri: artist.avatarUrl }}
                              style={styles.avatarImg}
                            />
                          ) : (
                            <View style={styles.avatarPlaceholder}>
                              <Ionicons
                                color="#a1a1aa"
                                name="person"
                                size={18}
                              />
                            </View>
                          )}
                        </View>
                        <View style={styles.dropdownRowCopy}>
                          <Text
                            numberOfLines={1}
                            style={styles.dropdownRowTitle}
                          >
                            {artist.name}
                          </Text>
                          <Text
                            numberOfLines={1}
                            style={styles.dropdownRowSubtitle}
                          >
                            {[
                              artist.genre ?? "Hip-Hop",
                              artist.location ?? "Little Rock, AR",
                            ]
                              .filter(Boolean)
                              .join(" • ")}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              {/* Songs Section */}
              {songs.length > 0 ? (
                <View style={styles.dropdownSection}>
                  <Text style={styles.dropdownSectionLabel}>SONGS</Text>
                  {songs.slice(0, 6).map((song) => (
                    <Pressable
                      key={song.id}
                      onPress={() => {
                        router.push(`/tracks/${song.id}`);
                      }}
                      style={({ pressed }) => [
                        styles.dropdownRow,
                        {
                          backgroundColor: pressed ? "#27272a" : "transparent",
                        },
                      ]}
                    >
                      <View style={styles.coverBox}>
                        {song.coverArtUrl ? (
                          <Image
                            source={{ uri: song.coverArtUrl }}
                            style={styles.coverImg}
                          />
                        ) : (
                          <View style={styles.coverPlaceholder}>
                            <Ionicons
                              color="#a1a1aa"
                              name="musical-note"
                              size={18}
                            />
                          </View>
                        )}
                      </View>
                      <View style={styles.dropdownRowCopy}>
                        <Text numberOfLines={1} style={styles.dropdownRowTitle}>
                          {song.title}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={styles.dropdownRowSubtitle}
                        >
                          {[
                            song.artistName ?? "Artist",
                            song.genre ?? "Hip-Hop",
                          ]
                            .filter(Boolean)
                            .join(" • ")}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {hasNoResults ? (
                <View style={styles.noResultsBox}>
                  <Text style={styles.noResultsText}>
                    No songs or artists found for &quot;{debouncedQuery}&quot;.
                  </Text>
                </View>
              ) : null}
            </ScrollView>
          </View>
        ) : null}

        {/* Default Browse Genres Grid (Matching Image 0) */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.browseHeader}>
            <Text style={[styles.browseTitle, { color: theme.text }]}>
              Browse Genres
            </Text>
            <Text style={[styles.browseSubtitle, { color: theme.mutedText }]}>
              Explore music by genre
            </Text>
          </View>

          <View style={styles.genreGrid}>
            {genresList.map((genre) => (
              <Link
                asChild
                href={`/tracks?genre=${encodeURIComponent(genre.slug)}` as Href}
                key={genre.id}
              >
                <Pressable
                  accessibilityHint={`Browse ${genre.name} tracks`}
                  accessibilityLabel={`${genre.name}, ${genre.count ?? 0} live items`}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.genreCard,
                    {
                      backgroundColor: pressed ? "#1d1d22" : "#121215",
                      borderColor: "#27272a",
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Text style={styles.genreEmoji}>{genre.emoji}</Text>
                  <Text numberOfLines={1} style={styles.genreName}>
                    {genre.name}
                  </Text>
                  <Text style={styles.genreCount}>
                    {genre.count ?? 0} live items
                  </Text>
                </Pressable>
              </Link>
            ))}
          </View>
        </ScrollView>
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  avatarBox: {
    height: 40,
    width: 40,
  },
  avatarImg: {
    borderRadius: 8,
    height: 40,
    width: 40,
  },
  avatarPlaceholder: {
    alignItems: "center",
    backgroundColor: "#27272a",
    borderRadius: 8,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  browseHeader: {
    gap: 4,
    marginBottom: 8,
  },
  browseSubtitle: {
    fontSize: 14,
  },
  browseTitle: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  container: {
    flex: 1,
    position: "relative",
  },
  coverBox: {
    height: 40,
    width: 40,
  },
  coverImg: {
    borderRadius: 8,
    height: 40,
    width: 40,
  },
  coverPlaceholder: {
    alignItems: "center",
    backgroundColor: "#27272a",
    borderRadius: 8,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  dropdownContent: {
    gap: 14,
    padding: 12,
  },
  dropdownLoadingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    paddingVertical: 12,
  },
  dropdownLoadingText: {
    color: "#a1a1aa",
    fontSize: 13,
  },
  dropdownOverlay: {
    backgroundColor: "#121215",
    borderColor: "#27272a",
    borderRadius: 16,
    borderWidth: 1,
    left: 20,
    maxHeight: 380,
    position: "absolute",
    right: 20,
    shadowColor: "#000000",
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    top: 66,
    zIndex: 100,
  },
  dropdownRow: {
    alignItems: "center",
    borderRadius: 10,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  dropdownRowCopy: {
    flex: 1,
    gap: 2,
  },
  dropdownRowSubtitle: {
    color: "#a1a1aa",
    fontSize: 12,
  },
  dropdownRowTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  dropdownSection: {
    gap: 6,
  },
  dropdownSectionLabel: {
    color: "#71717a",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    paddingHorizontal: 8,
  },
  genreCard: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    flexBasis: "48%",
    flexGrow: 1,
    gap: 6,
    justifyContent: "center",
    minHeight: 130,
    paddingHorizontal: 12,
    paddingVertical: 18,
  },
  genreCount: {
    color: "#71717a",
    fontSize: 12,
    fontWeight: "600",
  },
  genreEmoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  genreGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  genreName: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  input: {
    color: "#ffffff",
    flex: 1,
    fontSize: 14,
  },
  noResultsBox: {
    paddingVertical: 18,
  },
  noResultsText: {
    color: "#71717a",
    fontSize: 13,
    textAlign: "center",
  },
  scrollContent: {
    gap: 16,
    paddingBottom: 40,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  cancelButtonText: {
    color: "#c084fc",
    fontSize: 15,
    fontWeight: "600",
  },
  cancelButtonWrapper: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  searchBar: {
    alignItems: "center",
    backgroundColor: "#141417",
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchBarWrapper: {
    alignItems: "center",
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 14,
    zIndex: 10,
  },
});
