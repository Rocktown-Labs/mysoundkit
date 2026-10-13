import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { NAV_THEME } from "@/lib/constants";
import { mapScopeLabel } from "@/lib/map-scopes";
import type { MapScope } from "@/lib/map-scopes";
import { useColorScheme } from "@/lib/use-color-scheme";

/**
 * Compact card showing the active Discover region. Pressing it opens the
 * region selection menu.
 */
export function RegionPickerCard({
  onPress,
  scope,
}: {
  onPress: () => void;
  scope: MapScope;
}) {
  const { colorScheme } = useColorScheme(),
    isGlobal = scope === "global",
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;

  return (
    <Pressable
      accessibilityHint="Opens the region selector"
      accessibilityLabel={`Region: ${mapScopeLabel(scope)}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: pressed ? theme.muted : theme.card,
          borderColor: theme.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View
        style={[styles.iconWrap, { backgroundColor: `${theme.primary}18` }]}
      >
        <Ionicons color={theme.primary} name="globe-outline" size={18} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.eyebrow, { color: theme.mutedText }]}>Region</Text>
        <Text style={[styles.region, { color: theme.text }]}>
          {mapScopeLabel(scope)}
        </Text>
      </View>
      <View style={[styles.badge, { backgroundColor: theme.muted }]}>
        <Text style={[styles.badgeText, { color: theme.mutedText }]}>
          {isGlobal ? "Worldwide" : "Regional"}
        </Text>
      </View>
      <Ionicons color={theme.mutedText} name="chevron-down" size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { fontSize: 10, fontWeight: "700" },
  card: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  copy: { flex: 1, gap: 1 },
  eyebrow: { fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  iconWrap: {
    alignItems: "center",
    borderRadius: 10,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  region: { fontSize: 15, fontWeight: "800" },
});
