import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import type { Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { NativeSectionScreen } from "@/components/native-section-screen";
import { NAV_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/use-color-scheme";

export function NativePlaceholderScreen({
  description,
  route,
  section,
  sectionHref,
  title,
}: {
  description: string;
  route: string;
  section: string;
  sectionHref: string;
  title: string;
}) {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;

  return (
    <NativeSectionScreen
      description={description}
      eyebrow={section}
      title={title}
    >
      <View
        style={[
          styles.card,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: theme.accent }]} />
          <Text style={[styles.status, { color: theme.accent }]}>
            ROUTE READY
          </Text>
        </View>
        <Text selectable style={[styles.cardTitle, { color: theme.text }]}>
          Placeholder screen
        </Text>
        <Text
          selectable
          style={[styles.cardDescription, { color: theme.mutedText }]}
        >
          This native route is connected and ready for its feature UI. We can
          now replace this surface with the full mobile experience without
          changing the navigation structure.
        </Text>
        <View style={[styles.route, { backgroundColor: theme.muted }]}>
          <Text style={[styles.routeLabel, { color: theme.mutedText }]}>
            ROUTE
          </Text>
          <Text selectable style={[styles.routeValue, { color: theme.text }]}>
            {route}
          </Text>
        </View>
        <Link href={sectionHref as Href} asChild>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.backButton,
              {
                backgroundColor: pressed ? theme.muted : theme.primary,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Ionicons
              color={theme.primaryForeground}
              name="arrow-back"
              size={17}
            />
            <Text
              style={[
                styles.backButtonText,
                { color: theme.primaryForeground },
              ]}
            >
              Back to {section}
            </Text>
          </Pressable>
        </Link>
      </View>
    </NativeSectionScreen>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: "center",
    borderRadius: 11,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: 16,
  },
  backButtonText: { fontSize: 14, fontWeight: "800" },
  card: { borderRadius: 18, borderWidth: 1, gap: 16, padding: 18 },
  cardDescription: { fontSize: 14, lineHeight: 21 },
  cardTitle: { fontSize: 18, fontWeight: "800" },
  route: { borderRadius: 10, gap: 5, padding: 12 },
  routeLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
  routeValue: { fontFamily: "monospace", fontSize: 13 },
  status: { fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  statusDot: { borderRadius: 5, height: 10, width: 10 },
  statusRow: { alignItems: "center", flexDirection: "row", gap: 8 },
});
