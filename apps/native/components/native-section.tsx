import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { NAV_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/use-color-scheme";

const VIEW_ALL_MIN_HITSLOP = 8,
  styles = StyleSheet.create({
    chevron: { marginLeft: 4 },
    container: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 12,
      paddingRight: 4,
    },
    description: { fontSize: 13, lineHeight: 18, marginTop: 2 },
    title: { fontSize: 20, fontWeight: "800", letterSpacing: -0.3 },
    titleRow: {
      alignItems: "center",
      flexDirection: "row",
      flexShrink: 1,
      gap: 8,
    },
  });

/** Section header with title, optional description, and a View All affordance. */
export function NativeSection({
  children,
  description,
  hideWhenEmpty,
  isEmpty,
  isLoading,
  onViewAllPress,
  title,
  viewAllHref,
}: {
  children: ReactNode;
  description?: string;
  hideWhenEmpty?: boolean;
  isEmpty?: boolean;
  isLoading?: boolean;
  onViewAllPress?: () => void;
  title: string;
  viewAllHref?: string;
}) {
  const { colorScheme } = useColorScheme(),
    hasViewAll = Boolean(viewAllHref ?? onViewAllPress),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;

  if (hideWhenEmpty && isEmpty === true && isLoading !== true) {
    return null;
  }

  return (
    <View>
      <Pressable
        accessibilityRole="header"
        disabled={!hasViewAll}
        onPress={
          onViewAllPress ??
          (viewAllHref
            ? () => {
                router.push(viewAllHref as never);
              }
            : undefined)
        }
        style={styles.container}
      >
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        </View>
        {hasViewAll ? (
          <View
            hitSlop={VIEW_ALL_MIN_HITSLOP}
            style={{
              alignItems: "center",
              flexDirection: "row",
            }}
          >
            <Text style={[styles.description, { color: theme.primary }]}>
              View All
            </Text>
            <Ionicons
              color={theme.primary}
              name="chevron-forward"
              size={16}
              style={styles.chevron}
            />
          </View>
        ) : null}
      </Pressable>
      {description ? (
        <Text style={[styles.description, { color: theme.mutedText }]}>
          {description}
        </Text>
      ) : null}
      <View style={{ marginTop: 12 }}>{children}</View>
    </View>
  );
}
