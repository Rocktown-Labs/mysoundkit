/* oxlint-disable one-var, sort-vars, no-nested-ternary, eqeqeq, no-eq-null */
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { NAV_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/use-color-scheme";

const styles = StyleSheet.create({
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
    gap: 8,
  },
  cardFramed: {
    borderCurve: "continuous",
    borderRadius: 14,
    borderWidth: 1,
    gap: 0,
    overflow: "hidden",
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  meta: {
    gap: 3,
    paddingHorizontal: 2,
  },
  metaFramed: {
    gap: 2,
    padding: 10,
  },
  subtitle: { fontSize: 12, lineHeight: 16 },
  thumb: { width: "100%" },
  title: { fontSize: 14, fontWeight: "700", lineHeight: 18 },
});

/** Themed tappable card shell used by all browse cards (frameless by default like web PublicCard). */
export function NativeCardShell({
  children,
  framed = false,
  href,
  width,
}: {
  children: ReactNode;
  framed?: boolean;
  href: string;
  width: number;
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
        framed && styles.cardFramed,
        framed && { backgroundColor: theme.card, borderColor: theme.border },
        width > 0 ? { width } : null,
        pressed && styles.cardPressed,
      ]}
    >
      {children}
    </Pressable>
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
  framed = false,
  subtitle,
  subtitleColor,
  title,
  titleColor,
}: {
  framed?: boolean;
  subtitle?: string;
  subtitleColor?: string;
  title: string;
  titleColor: string;
}) {
  return (
    <View style={framed ? styles.metaFramed : styles.meta}>
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
