import { StyleSheet, Text, View } from "react-native";

import { NativeMenuList } from "@/components/native-menu-list";
import { NativeSectionScreen } from "@/components/native-section-screen";
import { NAV_THEME } from "@/lib/constants";
import { LIVE_MENU_ITEMS } from "@/lib/native-navigation";
import { useColorScheme } from "@/lib/use-color-scheme";

export default function LiveScreen() {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;

  return (
    <NativeSectionScreen
      description="Watch battles, join listening parties, and find creator streams happening on SoundKit."
      eyebrow="SoundKit Live"
      title="Live"
    >
      <View style={[styles.featureCard, { backgroundColor: theme.text }]}>
        <View style={[styles.liveBadge, { backgroundColor: theme.accent }]}>
          <View
            style={[
              styles.liveDot,
              { backgroundColor: theme.accentForeground },
            ]}
          />
          <Text
            style={[styles.liveBadgeText, { color: theme.accentForeground }]}
          >
            LIVE
          </Text>
        </View>
        <Text
          selectable
          style={[styles.featureTitle, { color: theme.background }]}
        >
          The room is yours.
        </Text>
        <Text
          selectable
          style={[styles.featureCopy, { color: `${theme.background}B8` }]}
        >
          See what is happening now and choose a live experience to explore.
        </Text>
      </View>
      <NativeMenuList items={LIVE_MENU_ITEMS} label="Live menu" />
    </NativeSectionScreen>
  );
}

const styles = StyleSheet.create({
  featureCard: { borderRadius: 18, gap: 14, padding: 18 },
  featureCopy: { fontSize: 14, lineHeight: 21 },
  featureTitle: { fontSize: 21, fontWeight: "800" },
  liveBadge: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 999,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  liveBadgeText: { fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  liveDot: { borderRadius: 4, height: 8, width: 8 },
});
