import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { NativeImage } from "@/components/native-image";
import { NAV_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/use-color-scheme";

/**
 * Frameless media card: cover image + title only, navigating to the item's
 * detail page. Used across the dashboard music sections.
 */
export function FramelessCard({
  aspectRatio = 1,
  height,
  href,
  image,
  subtitle,
  title,
  width = 120,
}: {
  aspectRatio?: number;
  height?: number;
  href: string;
  image?: null | string;
  subtitle?: string;
  title: string;
  width?: number;
}) {
  const { colorScheme } = useColorScheme(),
    cardHeight = height ?? Math.round(width / aspectRatio),
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
      <View
        style={[
          styles.imageContainer,
          {
            backgroundColor: theme.card,
            borderColor: theme.border,
            height: cardHeight,
            width,
          },
        ]}
      >
        <NativeImage
          contentFit="cover"
          source={image ?? undefined}
          style={styles.image}
        />
      </View>
      <Text numberOfLines={1} style={[styles.title, { color: theme.text }]}>
        {title}
      </Text>
      {subtitle ? (
        <Text
          numberOfLines={1}
          style={[styles.subtitle, { color: theme.mutedText }]}
        >
          {subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "column",
  },
  image: {
    height: "100%",
    width: "100%",
  },
  imageContainer: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  title: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 6,
  },
});
