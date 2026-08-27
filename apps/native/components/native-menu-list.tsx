import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import type { Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { NAV_THEME } from "@/lib/constants";
import type { NativeMenuItem } from "@/lib/native-navigation";
import { useColorScheme } from "@/lib/use-color-scheme";

export function NativeMenuList({
  items,
  label,
}: {
  items: readonly NativeMenuItem[];
  label?: string;
}) {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;

  return (
    <View style={styles.container}>
      {label ? (
        <Text style={[styles.label, { color: theme.mutedText }]}>{label}</Text>
      ) : null}
      <View style={styles.list}>
        {items.map((item) => (
          <Link href={item.href as Href} asChild key={item.href}>
            <Pressable
              accessibilityHint={`Opens the ${item.label} screen`}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.item,
                {
                  backgroundColor: pressed ? theme.muted : theme.card,
                  borderColor: theme.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <View
                style={[styles.icon, { backgroundColor: `${theme.primary}18` }]}
              >
                <Ionicons
                  color={theme.primary}
                  name={item.icon as keyof typeof Ionicons.glyphMap}
                  size={20}
                />
              </View>
              <View style={styles.copy}>
                <Text style={[styles.itemLabel, { color: theme.text }]}>
                  {item.label}
                </Text>
                <Text
                  numberOfLines={2}
                  style={[styles.description, { color: theme.mutedText }]}
                >
                  {item.description}
                </Text>
              </View>
              <Ionicons
                color={theme.mutedText}
                name="chevron-forward"
                size={18}
              />
            </Pressable>
          </Link>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  copy: { flex: 1, gap: 3 },
  description: { fontSize: 12, lineHeight: 17 },
  icon: {
    alignItems: "center",
    borderRadius: 10,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  item: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 68,
    padding: 12,
  },
  itemLabel: { fontSize: 15, fontWeight: "700" },
  label: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  list: { gap: 9 },
});
