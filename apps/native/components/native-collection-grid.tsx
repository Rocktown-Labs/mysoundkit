import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { NAV_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/use-color-scheme";

const COLUMNS = 2,
  GAP = 12;

/** Two-column card grid with optional load-more, mirroring the web view-all grids. */
export function NativeCollectionGrid<T>({
  empty,
  fetchMore,
  hasMore,
  isFetchingMore,
  isLoading,
  items,
  keyForItem,
  renderItem,
}: {
  empty: string;
  fetchMore?: () => void;
  hasMore?: boolean;
  isFetchingMore?: boolean;
  isLoading?: boolean;
  items: T[];
  keyForItem: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => ReactNode;
}) {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;

  if (isLoading !== true && items.length === 0) {
    return <NativeEmptyState>{empty}</NativeEmptyState>;
  }

  return (
    <View style={styles.grid}>
      {items.map((item, index) => (
        <View key={keyForItem(item, index)} style={styles.cell}>
          {renderItem(item, index)}
        </View>
      ))}
      {fetchMore && hasMore ? (
        <View style={styles.moreRow}>
          {isFetchingMore ? (
            <ActivityIndicator color={theme.primary} />
          ) : (
            <Text
              accessibilityRole="button"
              onPress={fetchMore}
              style={[styles.more, { color: theme.primary }]}
            >
              Load more
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

export function NativeEmptyState({ children }: { children: ReactNode }) {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;

  return (
    <View style={[styles.empty, { borderColor: theme.border }]}>
      <Text style={{ color: theme.mutedText, fontSize: 13 }}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cell: { flex: 1 },
  empty: {
    borderColor: undefined,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    padding: 20,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GAP,
  },
  more: { fontSize: 15, fontWeight: "700", padding: 14 },
  moreRow: { alignItems: "center", width: "100%" },
});
