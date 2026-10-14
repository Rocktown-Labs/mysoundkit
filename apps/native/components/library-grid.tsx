import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useLibraryOverviewQuery } from "@/lib/soundkit-api";

export interface LibraryCategory {
  color: string;
  countKey?:
    | "playlistCount"
    | "purchaseCount"
    | "recentPlayCount"
    | "savedTrackCount"
    | "watchedCount";
  href: Href;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
}

export const LIBRARY_CATEGORIES: LibraryCategory[] = [
  {
    color: "#38bdf8",
    countKey: "recentPlayCount",
    href: "/library/recent",
    icon: "time-outline",
    title: "Recently Played",
  },
  {
    color: "#B8A3FF",
    countKey: "playlistCount",
    href: "/library/playlists",
    icon: "list-outline",
    title: "Playlists",
  },
  {
    color: "#f43f5e",
    countKey: "savedTrackCount",
    href: "/library/saved",
    icon: "heart-outline",
    title: "Saved Tracks",
  },
  {
    color: "#22c55e",
    countKey: "purchaseCount",
    href: "/library/purchased",
    icon: "bag-handle-outline",
    title: "Purchased",
  },
  {
    color: "#06b6d4",
    countKey: "watchedCount",
    href: "/library/watched",
    icon: "videocam-outline",
    title: "Recently Watched",
  },
  {
    color: "#9ca3af",
    href: "/library/settings",
    icon: "settings-outline",
    title: "Account",
  },
];

export function LibraryGrid({ onItemPress }: { onItemPress?: () => void }) {
  const router = useRouter(),
    { data: overview } = useLibraryOverviewQuery();

  return (
    <View style={styles.grid}>
      {LIBRARY_CATEGORIES.map((category) => {
        const count =
          category.countKey && overview ? overview[category.countKey] : null;

        return (
          <Pressable
            accessibilityHint={`Navigates to ${category.title}`}
            accessibilityLabel={category.title}
            accessibilityRole="button"
            key={category.title}
            onPress={() => {
              onItemPress?.();
              router.push(category.href);
            }}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: pressed ? "#16181D" : "#060606",
                borderColor: "#212121",
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: `${category.color}15` },
              ]}
            >
              <Ionicons color={category.color} name={category.icon} size={24} />
            </View>
            <Text style={styles.cardTitle}>{category.title}</Text>
            {typeof count === "number" && count > 0 ? (
              <Text style={styles.countText}>{count} items</Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    flexBasis: "48%",
    flexGrow: 1,
    gap: 12,
    justifyContent: "center",
    minHeight: 140,
    paddingHorizontal: 14,
    paddingVertical: 20,
  },
  cardTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  countText: {
    color: "#8F8F8F",
    fontSize: 11,
    fontWeight: "600",
    marginTop: -6,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    width: "100%",
  },
  iconWrap: {
    alignItems: "center",
    borderRadius: 999,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
});
