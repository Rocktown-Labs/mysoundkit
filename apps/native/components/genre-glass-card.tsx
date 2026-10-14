/* oxlint-disable one-var, sort-vars */
import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { createAnimatedComponent } from "react-native-reanimated";

import { genreActivityLabel, genreEmoji } from "@/lib/genre-meta";

const AnimatedPressable = createAnimatedComponent(Pressable);

// Reanimated CSS-transition props are not part of stock RN's ViewStyle, so
// they live outside StyleSheet.create (which type-checks against ViewStyle).
const PRESS_TRANSITION = {
  transitionDuration: 120,
  transitionProperty: "transform, background-color",
} as const;

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
          PRESS_TRANSITION,
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

/** 2-column grid layout with a consistent 12pt gutter matching web. */
export function GenreGlassGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    backgroundColor: "#080808",
    borderColor: "#212121",
    borderRadius: 18,
    borderWidth: 1,
    elevation: 3,
    flexBasis: "47%",
    flexGrow: 1,
    gap: 4,
    justifyContent: "center",
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 24,
    position: "relative",
    shadowColor: "#000000",
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  cardPressed: {
    backgroundColor: "#161616",
    borderColor: "#2f2f2f",
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
  },
  name: {
    color: "#F8F8F8",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },
  topEdge: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 999,
    height: 1,
    left: 16,
    position: "absolute",
    right: 16,
    top: 0,
  },
});
