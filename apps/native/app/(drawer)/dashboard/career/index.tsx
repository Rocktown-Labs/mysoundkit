import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Container } from "@/components/container";
import { NAV_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/use-color-scheme";

const CAREER_ITEMS = [
    {
      description: "Public profile, links, and artist presence",
      href: "/dashboard/career/profile",
      icon: "person" as const,
      title: "Profile",
    },
    {
      description: "Private account profile and identity",
      href: "/dashboard/career/account-profile",
      icon: "id-card" as const,
      title: "Account Profile",
    },
    {
      description: "Track, project, and audience performance",
      href: "/dashboard/career/analytics",
      icon: "bar-chart" as const,
      title: "Analytics",
    },
    {
      description: "Release dates, promo tasks, and planning",
      href: "/dashboard/career/calendar",
      icon: "calendar" as const,
      title: "Calendar",
    },
    {
      description: "Members, roles, and workspace access",
      href: "/dashboard/career/team",
      icon: "people" as const,
      title: "Workspace",
    },
    {
      description: "Campaigns, wallet, and audience targeting",
      href: "/dashboard/career/ads",
      icon: "megaphone" as const,
      title: "Ads",
    },
    {
      description: "Revenue, payouts, and financial snapshot",
      href: "/dashboard/career/payments",
      icon: "card" as const,
      title: "Finance",
    },
    {
      description: "Account, notifications, and artist settings",
      href: "/dashboard/career/settings",
      icon: "settings" as const,
      title: "Settings",
    },
  ],
  styles = StyleSheet.create({
    itemDescription: { fontSize: 11, marginTop: 2 },
    itemTitle: { fontSize: 13, fontWeight: "700" },
    list: {
      flexDirection: "column",
      gap: 8,
    },
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

export default function CareerOverviewScreen() {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;

  return (
    <Container>
      <View style={{ flex: 1, padding: 20 }}>
        <Text style={[styles.screenTitle, { color: theme.text }]}>Career</Text>
        <Text style={[styles.subtitle, { color: theme.mutedText }]}>
          Profile, analytics, and the business side of your music.
        </Text>
        <View style={styles.list}>
          {CAREER_ITEMS.map((item) => (
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
