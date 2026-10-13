import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { NAV_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/use-color-scheme";

/** Card with a Playfair-style title, optional description, and a View All link. */
export function DashboardSectionCard({
  children,
  description,
  title,
  viewAllHref,
}: {
  children?: ReactNode;
  description?: string;
  title: string;
  viewAllHref?: string;
}) {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          {description ? (
            <Text style={[styles.description, { color: theme.mutedText }]}>
              {description}
            </Text>
          ) : null}
        </View>
        {viewAllHref ? (
          <Pressable
            hitSlop={8}
            onPress={() => {
              router.push(viewAllHref as never);
            }}
            style={styles.viewAll}
          >
            <Text style={[styles.viewAllText, { color: theme.mutedText }]}>
              View All
            </Text>
            <Ionicons
              color={theme.mutedText}
              name="chevron-forward"
              size={14}
            />
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  description: { fontSize: 12, marginTop: 2 },
  header: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
    padding: 14,
    paddingBottom: 10,
  },
  title: { fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  viewAll: {
    alignItems: "center",
    flexDirection: "row",
  },
  viewAllText: { fontSize: 12, fontWeight: "700" },
});
