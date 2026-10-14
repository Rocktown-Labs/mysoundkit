/* oxlint-disable one-var, sort-vars */
import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { createAnimatedComponent } from "react-native-reanimated";

import { genreActivityLabel, genreEmoji } from "@/lib/genre-meta";

const AnimatedPressable = createAnimatedComponent(Pressable);

/**
 * Apple-glass genre tile for the 3-column browse grids: a translucent
 * material with a light-catching top edge, emoji-forward, with quick
 * press-in feedback (0.97 scale, 120ms UI-thread CSS transition).
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
      <AnimatedPressable
        accessibilityHint={`Browse ${title}`}
        accessibilityLabel={`${title}, ${genreActivityLabel(count)}`}
        accessibilityRole="button"
        style={({ pressed }: { pressed: boolean }) => [
          styles.card,
          styles.pressTransition,
          pressed && styles.cardPressed,
        ]}
      >
        {/* Light-catching top edge of the glass material */}
        <View style={styles.topEdge} />
        <Text style={styles.emoji}>{genreEmoji(slug)}</Text>
        <Text numberOfLines={1} style={styles.name}>
          {title}
        </Text>
        <Text style={styles.count}>{genreActivityLabel(count)}</Text>
      </AnimatedPressable>
    </Link>
  );
}

/** 3-column grid layout with a consistent 10pt gutter. */
export function GenreGlassGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    aspectRatio: 1.05,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 18,
    borderWidth: 1,
    elevation: 3,
    flexBasis: "30%",
    flexGrow: 1,
    gap: 3,
    justifyContent: "center",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 12,
    shadowColor: "#000000",
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  cardPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    transform: [{ scale: 0.97 }],
  },
  count: {
    color: "#8F8F8F",
    fontSize: 11,
    fontWeight: "600",
  },
  emoji: {
    fontSize: 30,
    lineHeight: 36,
    marginBottom: 4,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  name: {
    color: "#F8F8F8",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  pressTransition: {
    transitionDuration: 120,
    transitionProperty: "transform, background-color",
  },
  topEdge: {
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderRadius: 999,
    height: 1,
    left: 14,
    position: "absolute",
    right: 14,
    top: 0,
  },
});
