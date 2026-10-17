/* oxlint-disable one-var, sort-vars */
import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { genreActivityLabel, genreEmoji } from "@/lib/genre-meta";

/**
 * Apple-glass genre tile for the 2-column browse grids: a translucent
 * material with a light-catching top edge, emoji-forward, with quick
 * press-in feedback matching the mobile web genre grid.
 */
export function GenreGlassCard({
  count,
  slug,
  title,
}: {
  count: number;
  slug: string;
  title: string;
}) {
  return (
    <Link asChild href={`/genres/${encodeURIComponent(slug)}`}>
      <Pressable
        accessibilityHint={`Browse ${title}`}
        accessibilityLabel={`${title}, ${genreActivityLabel(count)}`}
        accessibilityRole="button"
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        <View style={styles.topEdge} />
        <Text style={styles.emoji}>{genreEmoji(slug)}</Text>
        <Text numberOfLines={1} style={styles.name}>
          {title}
        </Text>
        <Text style={styles.count}>{genreActivityLabel(count)}</Text>
      </Pressable>
    </Link>
  );
}

/** 2-column grid layout with a consistent 12pt gutter matching web. */
export function GenreGlassGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderCurve: "continuous",
    borderRadius: 18,
    borderWidth: 1,
    elevation: 3,
    flexBasis: "47%",
    flexGrow: 1,
    gap: 4,
    justifyContent: "center",
    maxWidth: "48.5%",
    minHeight: 156,
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 22,
    position: "relative",
    shadowColor: "#000000",
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    width: "48%",
  },
  cardPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.09)",
    borderColor: "rgba(184, 163, 255, 0.35)",
    transform: [{ scale: 0.98 }],
  },
  count: {
    color: "#8F8F8F",
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
  },
  emoji: {
    fontSize: 38,
    lineHeight: 46,
    marginBottom: 6,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
  },
  name: {
    color: "#F8F8F8",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },
  topEdge: {
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    borderRadius: 999,
    height: 1,
    left: 16,
    position: "absolute",
    right: 16,
    top: 0,
  },
});
