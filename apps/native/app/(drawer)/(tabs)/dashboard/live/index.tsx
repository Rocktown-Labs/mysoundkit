import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Container } from "@/components/container";
import { NAV_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/use-color-scheme";

const LIVE_ITEMS = [
    {
      description: "Battle requests, discovery, challenges, and matchups",
      href: "/dashboard/live/battles",
      icon: "trophy" as const,
      title: "Battles",
    },
    {
      description: "Listening parties for releases and fans",
      href: "/dashboard/live/parties",
      icon: "people-circle" as const,
      title: "Parties",
    },
    {
      description: "Live stream setup and broadcast tools",
      href: "/dashboard/live/streams",
      icon: "radio" as const,
      title: "Streams",
    },
    {
      description: "Battle kits, format slots, and track picks",
      href: "/dashboard/live/my-kit",
      icon: "musical-notes" as const,
      title: "My Kits",
    },
    {
      description: "Battle performance by track",
      href: "/dashboard/live/my-stats",
      icon: "bar-chart" as const,
      title: "My Stats",
    },
  ],
  styles = StyleSheet.create({
    itemDescription: { fontSize: 11, marginTop: 2 },
    itemTitle: { fontSize: 13, fontWeight: "700" },
    list: { gap: 8 },
    listItem: {
      alignItems: "center",
      borderRadius: 14,
      borderWidth: 1,
      flexDirection: "row",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    screenTitle: {
      fontSize: 30,
      fontWeight: "800",
      letterSpacing: -0.6,
      marginBottom: 4,
    },
    subtitle: { fontSize: 14, marginBottom: 16 },
  });

export default function LiveOverviewScreen() {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;

  return (
    <Container>
      <View style={{ flex: 1, padding: 20 }}>
        <Text style={[styles.screenTitle, { color: theme.text }]}>Live</Text>
        <Text style={[styles.subtitle, { color: theme.mutedText }]}>
          Battles, listening parties, and your broadcast tools.
        </Text>
        <View style={styles.list}>
          {LIVE_ITEMS.map((item) => (
            <Pressable
              key={item.title}
              onPress={() => {
                router.push(item.href as never);
              }}
              style={({ pressed }) => [
                styles.listItem,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Ionicons color={theme.primary} name={item.icon} size={18} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemTitle, { color: theme.text }]}>
                  {item.title}
                </Text>
                <Text
                  style={[styles.itemDescription, { color: theme.mutedText }]}
                >
                  {item.description}
                </Text>
              </View>
              <Ionicons
                color={theme.mutedText}
                name="chevron-forward"
                size={14}
              />
            </Pressable>
          ))}
        </View>
      </View>
    </Container>
  );
}
