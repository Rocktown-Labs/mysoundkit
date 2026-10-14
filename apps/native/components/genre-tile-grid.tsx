import { Link } from "expo-router";
import type { Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface GenreTile {
  colors: string[];
  name: string;
}

function genreHref(name: string): string {
  return `/tracks?genre=${encodeURIComponent(name.toLowerCase())}`;
}

export function GenreTileGrid({ extraGenres }: { extraGenres?: string[] }) {
  const names = new Set(BASE_GENRE_TILES.map((tile) => tile.name)),
    tiles = [
      ...BASE_GENRE_TILES,
      ...(extraGenres ?? [])
        .filter((name) => !names.has(name))
        .map((name, index) => ({
          colors: [INDEX_PALETTE[index % INDEX_PALETTE.length], "#171717"],
          name,
        })),
    ];

  return (
    <View style={styles.grid}>
      {tiles.map((tile) => (
        <Link href={genreHref(tile.name) as Href} asChild key={tile.name}>
          <Pressable
            accessibilityLabel={`Browse ${tile.name}`}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.tile,
              {
                backgroundColor: pressed ? tile.colors[1] : tile.colors[0],
              },
            ]}
          >
            <Text style={styles.tileLabel}>{tile.name}</Text>
          </Pressable>
        </Link>
      ))}
    </View>
  );
}

// Static catalog shown on the Search tab; mirrors an Apple Music-style genre
// grid. The API genre list is merged in when available.
const BASE_GENRE_TILES: GenreTile[] = [
    { colors: ["#E86A8C", "#7A1E3F"], name: "Hip-Hop" },
    { colors: ["#A78BFA", "#4C2A9E"], name: "R&B" },
    { colors: ["#F59E0B", "#8A4B0F"], name: "Pop" },
    { colors: ["#34D399", "#0E6B4A"], name: "Electronic" },
    { colors: ["#60A5FA", "#1E3F8F"], name: "Rock" },
    { colors: ["#F472B6", "#8A2B5C"], name: "Afrobeats" },
    { colors: ["#FBBF24", "#7C5A10"], name: "Latin" },
    { colors: ["#2DD4BF", "#0E5C53"], name: "Jazz" },
    { colors: ["#93C5FD", "#2A4E9C"], name: "Country" },
    { colors: ["#C4B5FD", "#5B3AA6"], name: "Gospel" },
    { colors: ["#F87171", "#7B1E1E"], name: "Metal" },
    { colors: ["#6EE7B7", "#1F7A5C"], name: "Classical" },
  ],
  INDEX_PALETTE = [
    "#DDA34A",
    "#B8A3FF",
    "#60A5FA",
    "#34D399",
    "#F472B6",
    "#2DD4BF",
  ],
  TILE_HEIGHT = 100,
  styles = StyleSheet.create({
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    tile: {
      backgroundColor: "#171717",
      borderRadius: 14,
      flexBasis: "48%",
      flexGrow: 1,
      height: TILE_HEIGHT,
      justifyContent: "flex-end",
      minHeight: TILE_HEIGHT,
      padding: 12,
    },
    tileLabel: {
      color: "#FFFFFF",
      fontSize: 15,
      fontWeight: "800",
    },
  });
