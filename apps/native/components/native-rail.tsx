import type { ReactNode } from "react";
import { ScrollView, StyleSheet } from "react-native";

/** Horizontally scrolling row of fixed-width cards, mirroring the web HomeRail. */
export function NativeRail({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      horizontal
      showsHorizontalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

export const CARD_GAP = 12;

const styles = StyleSheet.create({
  content: { gap: CARD_GAP, paddingRight: 20 },
});
