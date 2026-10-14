/* oxlint-disable one-var, sort-vars, no-nested-ternary, eqeqeq, no-eq-null */
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { createAnimatedComponent } from "react-native-reanimated";

import { NAV_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/use-color-scheme";

const AnimatedPressable = createAnimatedComponent(Pressable),
  styles = StyleSheet.create({
    badge: {
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    badgeText: {
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 0.4,
      textTransform: "uppercase",
    },
    card: {
      borderRadius: 14,
      borderWidth: 1,
      overflow: "hidden",
    },
    meta: {
      gap: 2,
      padding: 10,
    },
    pressTransition: {
      // Apple-style press-in feedback: quick settle, no overshoot.
      transitionDuration: 120,
      transitionProperty: "transform, opacity",
    },
    subtitle: { fontSize: 12, lineHeight: 16 },
    thumb: { width: "100%" },
    title: { fontSize: 13, fontWeight: "700", lineHeight: 17 },
  });

/** Themed tappable card shell used by all browse cards. */
export function NativeCardShell({
  children,
  href,
  width,
}: {
  children: ReactNode;
  href: string;
  width: number;
}) {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;

  return (
    <AnimatedPressable
      onPress={() => {
        router.push(href as never);
      }}
      style={({ pressed }: { pressed: boolean }) => [
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.border },
        width > 0 ? { width } : null,
        styles.pressTransition,
        pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
      ]}
    >
      {children}
    </AnimatedPressable>
  );
}

export function CardBadge({
  children,
  tone = "secondary",
}: {
  children: string;
  tone?: "destructive" | "primary" | "secondary";
}) {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    background =
      tone === "destructive"
        ? theme.destructive
        : tone === "primary"
          ? theme.primary
          : theme.muted,
    color =
      tone === "destructive" || tone === "primary"
        ? tone === "primary"
          ? theme.primaryForeground
          : "#FFFFFF"
        : theme.mutedText;

  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <Text style={[styles.badgeText, { color }]}>{children}</Text>
    </View>
  );
}

export function CardMeta({
  subtitle,
  subtitleColor,
  title,
  titleColor,
}: {
  subtitle?: string;
  subtitleColor?: string;
  title: string;
  titleColor: string;
}) {
  return (
    <View style={styles.meta}>
      <Text numberOfLines={1} style={[styles.title, { color: titleColor }]}>
        {title}
      </Text>
      {subtitle != null && subtitle.length > 0 ? (
        <Text
          numberOfLines={1}
          style={[styles.subtitle, { color: subtitleColor }]}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
