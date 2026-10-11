import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { NAV_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/use-color-scheme";

/** Title + subtitle + primary "New X" CTA header for dashboard domain pages. */
export function DashboardPageHeader({
  ctaHref,
  ctaLabel,
  subtitle,
  title,
}: {
  ctaHref: string;
  ctaLabel: string;
  subtitle: string;
  title: string;
}) {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;

  return (
    <View style={styles.header}>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: theme.mutedText }]}>
        {subtitle}
      </Text>
      <Pressable
        onPress={() => {
          router.push(ctaHref as never);
        }}
        style={({ pressed }) => [
          styles.cta,
          { backgroundColor: theme.primary, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Ionicons color={theme.primaryForeground} name="add" size={16} />
        <Text style={[styles.ctaText, { color: theme.primaryForeground }]}>
          {ctaLabel}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  cta: {
    alignSelf: "flex-start",
    borderRadius: 12,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  ctaText: { fontSize: 13, fontWeight: "700" },
  header: { marginBottom: 18 },
  subtitle: { fontSize: 14, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: "800", letterSpacing: -0.6, marginBottom: 4 },
});
