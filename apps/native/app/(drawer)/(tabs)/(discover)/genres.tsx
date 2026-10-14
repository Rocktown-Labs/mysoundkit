/* oxlint-disable one-var, sort-vars */
import { ActivityIndicator, ScrollView, StyleSheet, Text } from "react-native";

import { Container } from "@/components/container";
import { GenreGlassCard, GenreGlassGrid } from "@/components/genre-glass-card";
import { NAV_THEME } from "@/lib/constants";
import { useGenresQuery } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

export default function GenresScreen() {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    genresQuery = useGenresQuery(),
    genres = genresQuery.data ?? [];

  return (
    <Container>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: theme.background }}
      >
        <Text style={[styles.title, { color: theme.text }]}>Browse Genres</Text>
        <Text style={[styles.subtitle, { color: theme.mutedText }]}>
          Explore music by genre
        </Text>

        {genresQuery.isLoading ? (
          <ActivityIndicator color={theme.primary} style={styles.loader} />
        ) : (
          <GenreGlassGrid>
            {genres.map((genre) => (
              <GenreGlassCard
                count={genre.trackCount ?? 0}
                key={genre.id}
                slug={genre.slug}
                title={genre.name}
              />
            ))}
          </GenreGlassGrid>
        )}
      </ScrollView>
    </Container>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 12,
    paddingBottom: 48,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  loader: { paddingVertical: 32 },
  subtitle: { fontSize: 14, marginBottom: 12 },
  title: {
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
});
