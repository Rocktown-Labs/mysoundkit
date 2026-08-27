import { StyleSheet, Text, View } from "react-native";

import { NAV_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/use-color-scheme";

export function SoundKitBrand() {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;

  return (
    <View style={styles.brand}>
      <View
        style={[
          styles.mark,
          { backgroundColor: theme.text, borderColor: theme.text },
        ]}
      >
        <Text style={[styles.markText, { color: theme.background }]}>S</Text>
      </View>
      <Text style={[styles.wordmark, { color: theme.text }]}>SOUNDKIT</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: {
    alignItems: "center",
    flexDirection: "row",
    gap: 9,
  },
  mark: {
    alignItems: "center",
    borderWidth: 1,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  markText: {
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  wordmark: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 2.2,
  },
});
