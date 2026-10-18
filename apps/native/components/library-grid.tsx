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
  description: string;
  href: Href;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
}

export const LIBRARY_CATEGORIES: LibraryCategory[] = [
    {
      color: "#38bdf8",
      countKey: "recentPlayCount",
      description: "Your listening history",
      href: "/library/recent",
      icon: "time-outline",
      title: "Recently Played",
    },
    {
      color: "#B8A3FF",
      countKey: "playlistCount",
      description: "Your custom playlists",
      href: "/library/playlists",
      icon: "list-outline",
      title: "Playlists",
    },
    {
      color: "#f43f5e",
      countKey: "savedTrackCount",
      description: "Songs you've favorited",
      href: "/library/saved",
      icon: "heart-outline",
      title: "Saved Tracks",
    },
    {
      color: "#22c55e",
      countKey: "purchaseCount",
      description: "Tracks you own",
      href: "/library/purchased",
      icon: "bag-handle-outline",
      title: "Purchased",
    },
    {
      color: "#06b6d4",
      countKey: "watchedCount",
      description: "Watch again or resume",
      href: "/library/watched",
      icon: "videocam-outline",
      title: "Recently Watched",
    },
    {
      color: "#9ca3af",
      description: "Manage your settings",
      href: "/library/settings",
      icon: "settings-outline",
      title: "Account",
    },
  ],
  styles = StyleSheet.create({
    card: {
      borderRadius: 16,
      borderWidth: 1,
      flexBasis: "47%",
      flexGrow: 1,
      justifyContent: "space-between",
      minHeight: 158,
      padding: 14,
    },
    cardFooter: {
      alignItems: "center",
      borderTopColor: "#18181b",
      borderTopWidth: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 10,
      paddingTop: 10,
    },
    cardHeader: {
      alignItems: "flex-start",
      gap: 8,
    },
    cardTitle: {
      color: "#ffffff",
      fontSize: 15,
      fontWeight: "700",
    },
    descriptionText: {
      color: "#8F8F8F",
      fontSize: 12,
      lineHeight: 16,
    },
    footerLinkText: {
      color: "#B8A3FF",
      flex: 1,
      fontSize: 11,
      fontWeight: "700",
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
      width: "100%",
    },
    iconWrap: {
      alignItems: "center",
      borderRadius: 10,
      height: 40,
      justifyContent: "center",
      width: 40,
    },
  });

export function LibraryGrid({ onItemPress }: { onItemPress?: () => void }) {
  const router = useRouter(),
    { data: overview } = useLibraryOverviewQuery();

  return (
    <View style={styles.grid}>
      {LIBRARY_CATEGORIES.map((category) => {
        const count =
            category.countKey && overview
              ? (overview[category.countKey] ?? 0)
              : null,
          descriptionText =
            count === null
              ? category.description
              : `${count.toLocaleString()} ${category.description.toLowerCase()}`;

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
                backgroundColor: pressed ? "#111114" : "#060606",
                borderColor: pressed ? "#B8A3FF" : "#212121",
                opacity: pressed ? 0.92 : 1,
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: `${category.color}18` },
                ]}
              >
                <Ionicons
                  color={category.color}
                  name={category.icon}
                  size={22}
                />
              </View>
              <Text style={styles.cardTitle}>{category.title}</Text>
              <Text numberOfLines={2} style={styles.descriptionText}>
                {descriptionText}
              </Text>
            </View>

            <View style={styles.cardFooter}>
              <Text numberOfLines={1} style={styles.footerLinkText}>
                View {category.title}
              </Text>
              <Ionicons color="#B8A3FF" name="musical-notes" size={13} />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
