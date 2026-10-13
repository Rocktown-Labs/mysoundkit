import { router } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";

import { NativeImage } from "@/components/native-image";
import { NAV_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/use-color-scheme";

/**
 * Frameless media card: cover image + title only, navigating to the item's
 * detail page. Used across the dashboard music sections.
 */
export function FramelessCard({
  href,
  image,
  title,
  width = 120,
}: {
  href: string;
  image?: null | string;
  title: string;
  width?: number;
}) {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;

  return (
    <Pressable
      onPress={() => {
        router.push(href as never);
      }}
      style={({ pressed }) => [
        styles.card,
        { opacity: pressed ? 0.85 : 1, width },
      ]}
    >
      <NativeImage source={image ?? undefined} style={styles.image} />
      <Text numberOfLines={1} style={[styles.title, { color: theme.text }]}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "column",
  },
  image: {
    aspectRatio: 1,
    borderRadius: 12,
    width: "100%",
  },
  title: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 6,
  },
});
