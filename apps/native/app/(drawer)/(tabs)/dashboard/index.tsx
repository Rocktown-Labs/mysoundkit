import { StyleSheet, Text, View } from "react-native";

import { NativeMenuList } from "@/components/native-menu-list";
import { NativeSectionScreen } from "@/components/native-section-screen";
import { NAV_THEME } from "@/lib/constants";
import {
  DASHBOARD_CREATE_ITEMS,
  DASHBOARD_MENU_SECTIONS,
} from "@/lib/native-navigation";
import { useColorScheme } from "@/lib/use-color-scheme";

export default function DashboardScreen() {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;

  return (
    <NativeSectionScreen
      description="Your creator catalog, community, career tools, and live workspace in one mobile dashboard."
      eyebrow="Creator workspace"
      title="Dashboard"
    >
      <View style={[styles.welcomeCard, { backgroundColor: theme.text }]}>
        <Text
          selectable
          style={[styles.welcomeEyebrow, { color: theme.accent }]}
        >
          SOUNDKIT FOR ARTISTS
        </Text>
        <Text
          selectable
          style={[styles.welcomeTitle, { color: theme.background }]}
        >
          Make the next move.
        </Text>
        <Text
          selectable
          style={[styles.welcomeCopy, { color: `${theme.background}B8` }]}
        >
          Every creator tool now has a native route. Start with a section below
          to preview the mobile dashboard structure.
        </Text>
      </View>
      <NativeMenuList items={DASHBOARD_CREATE_ITEMS} label="Create new" />
      {DASHBOARD_MENU_SECTIONS.map((section) => (
        <NativeMenuList
          items={section.items}
          key={section.label}
          label={section.label}
        />
      ))}
    </NativeSectionScreen>
  );
}

const styles = StyleSheet.create({
  welcomeCard: { borderRadius: 18, gap: 10, padding: 18 },
  welcomeCopy: { fontSize: 14, lineHeight: 21 },
  welcomeEyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 1.3 },
  welcomeTitle: { fontSize: 22, fontWeight: "800" },
});
