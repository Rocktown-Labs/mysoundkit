import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Container } from "@/components/container";
import { GenreTileGrid } from "@/components/genre-tile-grid";
import { NAV_THEME } from "@/lib/constants";
import { useGenresQuery, useNativeSearchQuery } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

export default function SearchScreen() {
  const { colorScheme } = useColorScheme(),
    genres = useGenresQuery(),
    [query, setQuery] = useState(""),
    results = useNativeSearchQuery(query.trim()),
    showResults = Boolean(
      !results.isLoading &&
      results.data &&
      (results.data.tracks.length > 0 || results.data.artists.length > 0)
    ),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    trimmed = query.trim();

  if (trimmed.length >= 2) {
    return (
      <Container>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.headerRow}>
            <Text selectable style={[styles.title, { color: theme.text }]}>
              Search
            </Text>
          </View>
          <View
            style={[
              styles.searchBar,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Ionicons color={theme.mutedText} name="search" size={18} />
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setQuery}
              placeholder="Songs, artists, projects"
              placeholderTextColor={theme.mutedText}
              returnKeyType="search"
              style={[styles.input, { color: theme.text }]}
              value={query}
            />
            <Pressable
              accessibilityLabel="Clear search"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => {
                setQuery("");
              }}
            >
              <Ionicons color={theme.mutedText} name="close-circle" size={18} />
            </Pressable>
          </View>
          {results.isLoading ? (
            <Text style={[styles.sectionLabel, { color: theme.mutedText }]}>
              Searching…
            </Text>
          ) : null}
          {showResults && results.data ? (
            <View style={styles.results}>
              {results.data.tracks.length > 0 ? (
                <Text
                  selectable
                  style={[styles.sectionLabel, { color: theme.mutedText }]}
                >
                  Songs
                </Text>
              ) : null}
              {results.data.tracks.slice(0, 6).map((track) => (
                <Link href="/tracks" asChild key={track.id}>
                  <Pressable
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.resultRow,
                      {
                        backgroundColor: pressed ? theme.muted : theme.card,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <View style={styles.copy}>
                      <Text
                        numberOfLines={1}
                        selectable
                        style={[styles.resultTitle, { color: theme.text }]}
                      >
                        {track.title}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.resultSubtitle,
                          { color: theme.mutedText },
                        ]}
                      >
                        {track.artistName}
                      </Text>
                    </View>
                    <Ionicons color={theme.mutedText} name="play" size={16} />
                  </Pressable>
                </Link>
              ))}
              {results.data.artists.length > 0 ? (
                <Text
                  selectable
                  style={[styles.sectionLabel, { color: theme.mutedText }]}
                >
                  Artists
                </Text>
              ) : null}
              {results.data.artists.slice(0, 6).map((artist) => (
                <Link href="/artist" asChild key={artist.id}>
                  <Pressable
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.resultRow,
                      {
                        backgroundColor: pressed ? theme.muted : theme.card,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <View style={styles.copy}>
                      <Text
                        numberOfLines={1}
                        selectable
                        style={[styles.resultTitle, { color: theme.text }]}
                      >
                        {artist.name}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.resultSubtitle,
                          { color: theme.mutedText },
                        ]}
                      >
                        {artist.location ?? "Artist"}
                      </Text>
                    </View>
                    <Ionicons
                      color={theme.mutedText}
                      name="chevron-forward"
                      size={16}
                    />
                  </Pressable>
                </Link>
              ))}
            </View>
          ) : null}
          {!results.isLoading && !showResults ? (
            <Text style={[styles.emptyText, { color: theme.mutedText }]}>
              No results for “{trimmed}” yet.
            </Text>
          ) : null}
        </ScrollView>
      </Container>
    );
  }

  return (
    <Container>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text selectable style={[styles.title, { color: theme.text }]}>
            Search
          </Text>
        </View>
        <View
          style={[
            styles.searchBar,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <Ionicons color={theme.mutedText} name="search" size={18} />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setQuery}
            placeholder="Songs, artists, projects"
            placeholderTextColor={theme.mutedText}
            returnKeyType="search"
            style={[styles.input, { color: theme.text }]}
            value={query}
          />
          {trimmed.length > 0 ? (
            <Pressable
              accessibilityLabel="Clear search"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => {
                setQuery("");
              }}
            >
              <Ionicons color={theme.mutedText} name="close-circle" size={18} />
            </Pressable>
          ) : null}
        </View>
        <Text selectable style={[styles.sectionHeading, { color: theme.text }]}>
          Browse genres
        </Text>
        <GenreTileGrid
          extraGenres={(genres.data ?? []).map((genre) => genre.name)}
        />
      </ScrollView>
    </Container>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
    paddingBottom: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  copy: { flex: 1, gap: 2 },
  emptyText: { fontSize: 14 },
  headerRow: { flexDirection: "row" },
  input: { flex: 1, fontSize: 15, fontWeight: "600" },
  resultRow: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 56,
    padding: 12,
  },
  resultSubtitle: { fontSize: 12 },
  resultTitle: { fontSize: 14, fontWeight: "700" },
  results: { gap: 8 },
  searchBar: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 46,
    paddingHorizontal: 14,
  },
  sectionHeading: { fontSize: 20, fontWeight: "800", marginTop: 6 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginTop: 8,
    textTransform: "uppercase",
  },
  title: { fontSize: 32, fontWeight: "800", letterSpacing: -0.8 },
});
