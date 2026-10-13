import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import type { Href } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { NAV_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/use-color-scheme";

export interface LibraryItemRowProps {
  badge?: string;
  href: Href;
  imageUrl?: null | string;
  index?: number;
  onPressAction?: () => void;
  subtitle: string;
  title: string;
}

export function LibraryItemRow({
  badge,
  href,
  imageUrl,
  index,
  onPressAction,
  subtitle,
  title,
}: LibraryItemRowProps) {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;

  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityLabel={`${title} by ${subtitle}`}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor: pressed ? "#1c1c20" : "#121215",
            borderColor: "#27272a",
          },
        ]}
      >
        {typeof index === "number" ? (
          <Text style={[styles.indexNumber, { color: theme.mutedText }]}>
            {index + 1}
          </Text>
        ) : null}

        <View style={styles.thumbnailBox}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.thumbnail} />
          ) : (
            <View
              style={[
                styles.thumbnailPlaceholder,
                { backgroundColor: "#27272a" },
              ]}
            >
              <Ionicons color="#a1a1aa" name="musical-note" size={18} />
            </View>
          )}
        </View>

        <View style={styles.copy}>
          <Text numberOfLines={1} style={[styles.title, { color: theme.text }]}>
            {title}
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.subtitle, { color: theme.mutedText }]}
          >
            {subtitle}
          </Text>
        </View>

        {badge ? (
          <View style={[styles.badge, { backgroundColor: "#27272a" }]}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}

        {onPressAction ? (
          <Pressable
            hitSlop={8}
            onPress={(e) => {
              e.stopPropagation();
              onPressAction();
            }}
            style={styles.actionBtn}
          >
            <Ionicons color="#a1a1aa" name="ellipsis-horizontal" size={18} />
          </Pressable>
        ) : (
          <Ionicons color="#52525b" name="chevron-forward" size={16} />
        )}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  actionBtn: {
    padding: 4,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    color: "#a1a1aa",
    fontSize: 11,
    fontWeight: "700",
  },
  copy: {
    flex: 1,
    gap: 3,
  },
  indexNumber: {
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    width: 20,
  },
  row: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  subtitle: {
    fontSize: 12,
  },
  thumbnail: {
    borderRadius: 8,
    height: 44,
    width: 44,
  },
  thumbnailBox: {
    height: 44,
    width: 44,
  },
  thumbnailPlaceholder: {
    alignItems: "center",
    borderRadius: 8,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
  },
});
