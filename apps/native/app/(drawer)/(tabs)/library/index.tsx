import { StyleSheet, Text, View } from "react-native";

import { NativeMenuList } from "@/components/native-menu-list";
import { NativeSectionScreen } from "@/components/native-section-screen";
import { NAV_THEME } from "@/lib/constants";
import { LIBRARY_MENU_ITEMS } from "@/lib/native-navigation";
import { useColorScheme } from "@/lib/use-color-scheme";

export default function LibraryScreen() {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;

  return (
    <NativeSectionScreen
      description="Keep your saved music, listening history, playlists, purchases, and account settings close."
      eyebrow="My SoundKit"
      title="Library"
    >
      <View
        style={[
          styles.emptyCard,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <Text selectable style={[styles.emptyTitle, { color: theme.text }]}>
          Your collection
        </Text>
        <Text selectable style={[styles.emptyCopy, { color: theme.mutedText }]}>
          Your saved tracks and listening activity will appear here as each
          collection screen is connected.
        </Text>
      </View>
      <NativeMenuList items={LIBRARY_MENU_ITEMS} label="Library menu" />
    </NativeSectionScreen>
  );
}

const styles = StyleSheet.create({
  emptyCard: { borderRadius: 18, borderWidth: 1, gap: 7, padding: 18 },
  emptyCopy: { fontSize: 14, lineHeight: 21 },
  emptyTitle: { fontSize: 18, fontWeight: "800" },
});
