import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { NAV_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/use-color-scheme";

export function DashboardTopBar({
  action,
  ctaHref,
  ctaIcon = "add",
  ctaLabel,
  onOpenJumpMenu,
  showExit = false,
  subtitle,
  title,
}: {
  action?: ReactNode;
  ctaHref?: string;
  ctaIcon?: keyof typeof Ionicons.glyphMap;
  ctaLabel?: string;
  onOpenJumpMenu?: () => void;
  showExit?: boolean;
  subtitle?: string;
  title: string;
}) {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;

  return (
    <View style={styles.container}>
      {/* Optional top exit row */}
      {showExit ? (
        <View style={styles.actionRow}>
          <Pressable
            accessibilityLabel="Exit to SoundKit"
            accessibilityRole="button"
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.replace("/(drawer)/(tabs)/(discover)" as never);
            }}
            style={({ pressed }) => [
              styles.exitBtn,
              {
                backgroundColor: pressed ? "#1E1E1E" : "#121212",
                borderColor: theme.border,
              },
            ]}
          >
            <Ionicons color={theme.primary} name="arrow-back" size={14} />
            <Text style={[styles.exitBtnText, { color: theme.text }]}>
              Exit to SoundKit
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* Main Title Row with Menu Button */}
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        {onOpenJumpMenu ? (
          <Pressable
            accessibilityLabel="Menu"
            accessibilityRole="button"
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onOpenJumpMenu();
            }}
            style={({ pressed }) => [
              styles.jumpBtn,
              {
                backgroundColor: pressed ? "#222222" : "#141414",
                borderColor: theme.border,
              },
            ]}
          >
            <Ionicons color={theme.primary} name="apps-outline" size={15} />
            <Text style={[styles.jumpBtnText, { color: theme.primary }]}>
              Menu
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/* Subtitle */}
      {subtitle ? (
        <Text style={[styles.subtitle, { color: theme.mutedText }]}>
          {subtitle}
        </Text>
      ) : null}

      {/* Primary CTA or Custom Action */}
      {ctaLabel && ctaHref ? (
        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push(ctaHref as never);
          }}
          style={({ pressed }) => [
            styles.cta,
            {
              backgroundColor: theme.primary,
              opacity: pressed ? 0.85 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
        >
          <Ionicons color={theme.primaryForeground} name={ctaIcon} size={16} />
          <Text style={[styles.ctaText, { color: theme.primaryForeground }]}>
            {ctaLabel}
          </Text>
        </Pressable>
      ) : null}
      {!ctaLabel && action ? (
        <View style={styles.customAction}>{action}</View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  container: {
    marginBottom: 20,
  },
  cta: {
    alignSelf: "flex-start",
    borderRadius: 12,
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  ctaText: {
    fontSize: 13,
    fontWeight: "700",
  },
  customAction: {
    marginTop: 12,
  },
  exitBtn: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  exitBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  jumpBtn: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  jumpBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
