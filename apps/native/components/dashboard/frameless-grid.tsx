import { StyleSheet, Text, View } from "react-native";

import { FramelessCard } from "@/components/dashboard/frameless-card";
import { NAV_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/use-color-scheme";

export interface FramelessItem {
  href: string;
  id: string;
  image?: null | string;
  title: string;
}

function GridEmpty({ children }: { children: string }) {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;

  return (
    <Text style={{ color: theme.mutedText, fontSize: 13, paddingVertical: 12 }}>
      {children}
    </Text>
  );
}

/**
 * 3-column grid of frameless cover-art cards with an empty state, the shared
 * layout for the dashboard music domain pages.
 */
export function FramelessGrid({
  empty,
  isLoading,
  items,
}: {
  empty: string;
  isLoading?: boolean;
  items: FramelessItem[];
}) {
  if (isLoading !== true && items.length === 0) {
    return <GridEmpty>{empty}</GridEmpty>;
  }

  const rows: FramelessItem[][] = [];
  for (let index = 0; index < items.length; index += 3) {
    rows.push(items.slice(index, index + 3));
  }

  return (
    <View style={styles.grid}>
      {rows.map((row) => (
        <View
          key={row[0]?.id ?? 'row'}
          style={styles.row}
        >
          {row.map((item) => (
            <View key={item.id} style={styles.cell}>
              <FramelessCard
                href={item.href}
                image={item.image}
                title={item.title}
              />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  cell: { flex: 1 },
  grid: { gap: 12 },
  row: { flexDirection: "row", gap: 8 },
});
