import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { genreActivityLabel, genreEmoji } from "@/lib/genre-meta";

/**
 * Genre button card for browse grids: mirrors the web explore genre cards
 * with a solid dark card surface, emoji-forward display, and responsive
 * tactile press-in feedback.
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
  const router = useRouter();

  return (
    <Pressable
      accessibilityHint={`Browse ${title}`}
      accessibilityLabel={`${title}, ${genreActivityLabel(count)}`}
      accessibilityRole="button"
      onPress={() => {
        router.push(`/genres/${encodeURIComponent(slug)}` as never);
      }}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.topEdge} />
      <Text style={styles.emoji}>{genreEmoji(slug)}</Text>
      <View style={styles.copy}>
        <Text numberOfLines={1} style={styles.name}>
          {title}
        </Text>
        <Text style={styles.count}>{genreActivityLabel(count)}</Text>
      </View>
    </Pressable>
  );
}

/** 2-column button grid layout with consistent 12pt gutters matching web. */
export function GenreGlassGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    backgroundColor: "#111114",
    borderColor: "#212121",
    borderCurve: "continuous",
    borderRadius: 16,
    borderWidth: 1,
    elevation: 2,
    flexBasis: "48%",
    gap: 8,
    justifyContent: "center",
    maxWidth: "48.5%",
    minHeight: 136,
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 18,
    position: "relative",
    shadowColor: "#000000",
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    width: "48%",
  },
  cardPressed: {
    backgroundColor: "#18181D",
    borderColor: "rgba(184, 163, 255, 0.45)",
    opacity: 0.92,
    transform: [{ scale: 0.97 }],
  },
  copy: {
    alignItems: "center",
    gap: 2,
    width: "100%",
  },
  count: {
    color: "#8F8F8F",
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
  },
  emoji: {
    fontSize: 34,
    lineHeight: 42,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
    width: "100%",
  },
  name: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  topEdge: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 999,
    height: 1,
    left: 12,
    position: "absolute",
    right: 12,
    top: 0,
  },
});
