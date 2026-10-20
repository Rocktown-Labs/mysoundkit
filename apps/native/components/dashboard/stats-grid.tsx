/* oxlint-disable one-var, sort-vars */
/* eslint-disable one-var, sort-vars */
import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { NAV_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/use-color-scheme";

export interface DashboardStat {
  description?: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  value: string;
}

function StatCard({
  compact = false,
  stat,
}: {
  compact?: boolean;
  stat: DashboardStat;
}): ReactNode {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;

  return (
    <View
      style={[
        styles.card,
        compact ? styles.compactCard : null,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <View style={styles.header}>
        <Text
          numberOfLines={1}
          style={[
            styles.title,
            compact ? styles.compactTitle : null,
            { color: theme.mutedText },
          ]}
        >
          {stat.title}
        </Text>
        <Ionicons
          color={theme.mutedText}
          name={stat.icon}
          size={compact ? 12 : 14}
        />
      </View>
      <Text
        numberOfLines={1}
        style={[
          styles.value,
          compact ? styles.compactValue : null,
          { color: theme.text },
        ]}
      >
        {stat.value}
      </Text>
      {stat.description ? (
        <Text
          numberOfLines={1}
          style={[
            styles.description,
            compact ? styles.compactDesc : null,
            { color: theme.mutedText },
          ]}
        >
          {stat.description}
        </Text>
      ) : null}
    </View>
  );
}

/** 3-in-a-row or 2x2 stat cards, flexible for mobile dashboard screens. */
export function StatsGrid({ stats }: { stats: DashboardStat[] }) {
  if (stats.length <= 3) {
    return (
      <View style={styles.threeRow}>
        {stats.map((stat) => (
          <StatCard compact={stats.length === 3} key={stat.title} stat={stat} />
        ))}
      </View>
    );
  }

  const rows: DashboardStat[][] = [];
  for (let index = 0; index < stats.length; index += 2) {
    rows.push(stats.slice(index, index + 2));
  }

  return (
    <View style={styles.grid}>
      {rows.map((row) => (
        <View key={row.map((stat) => stat.title).join("-")} style={styles.row}>
          {row.map((stat) => (
            <StatCard key={stat.title} stat={stat} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    padding: 14,
  },
  compactCard: {
    borderRadius: 13,
    padding: 10,
  },
  compactDesc: {
    fontSize: 9,
    marginTop: 2,
  },
  compactTitle: {
    fontSize: 9,
    letterSpacing: 0.5,
  },
  compactValue: {
    fontSize: 18,
    marginTop: 6,
  },
  description: { fontSize: 11, marginTop: 4 },
  grid: { gap: 10 },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
  row: { flexDirection: "row", gap: 10 },
  threeRow: { flexDirection: "row", gap: 8 },
  title: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  value: { fontSize: 26, fontWeight: "800", marginTop: 8 },
});
