/* oxlint-disable one-var, sort-vars, no-nested-ternary */
/* eslint-disable one-var, sort-vars, no-nested-ternary */
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { NAV_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/use-color-scheme";

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface ChartTabConfig {
  badge?: string;
  data: ChartDataPoint[];
  id: string;
  label: string;
  sublabel?: string;
  unitPrefix?: string;
  unitSuffix?: string;
  valueLabel: string;
}

export function StatChartCard({
  tabs,
  title,
  viewAllHref,
}: {
  tabs: [ChartTabConfig, ChartTabConfig, ...ChartTabConfig[]];
  title: string;
  viewAllHref?: string;
}) {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    [activeTabId, setActiveTabId] = useState<string>(tabs[0].id),
    [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null),
    currentTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0],
    { data } = currentTab,
    maxValue = Math.max(...data.map((point) => point.value), 1),
    activePoint = selectedPointIndex === null ? null : data[selectedPointIndex],
    displayValue = activePoint
      ? `${currentTab.unitPrefix ?? ""}${activePoint.value.toLocaleString()}${currentTab.unitSuffix ?? ""}`
      : currentTab.valueLabel,
    displaySublabel = activePoint
      ? activePoint.label
      : (currentTab.sublabel ?? "Total this period");

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTextCol}>
          <Text style={[styles.sectionTitle, { color: theme.mutedText }]}>
            {title}
          </Text>
          <Text style={[styles.mainValue, { color: theme.text }]}>
            {displayValue}
          </Text>
          <Text style={[styles.sublabel, { color: theme.mutedText }]}>
            {displaySublabel}
          </Text>
        </View>

        {currentTab.badge ? (
          <View
            style={[
              styles.badge,
              { backgroundColor: "rgba(184, 163, 255, 0.15)" },
            ]}
          >
            <Ionicons color={theme.primary} name="trending-up" size={12} />
            <Text style={[styles.badgeText, { color: theme.primary }]}>
              {currentTab.badge}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Chart Bars */}
      <View style={styles.chartArea}>
        <View style={styles.barsContainer}>
          {data.map((point, index) => {
            const heightPercent = Math.max(
                Math.round((point.value / maxValue) * 100),
                6
              ),
              isSelected = selectedPointIndex === index,
              isMax = point.value === maxValue;

            return (
              <Pressable
                key={`${point.label}-${point.value}`}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedPointIndex(isSelected ? null : index);
                }}
                style={styles.barCol}
              >
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        backgroundColor: isSelected
                          ? "#FFFFFF"
                          : isMax
                            ? theme.primary
                            : "rgba(184, 163, 255, 0.45)",
                        height: `${heightPercent}%`,
                      },
                    ]}
                  />
                </View>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.barLabel,
                    {
                      color: isSelected ? theme.text : theme.mutedText,
                      fontWeight: isSelected ? "700" : "500",
                    },
                  ]}
                >
                  {point.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Segmented Bottom Tabs */}
      <View
        style={[
          styles.tabsRow,
          { backgroundColor: "#111111", borderColor: theme.border },
        ]}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === currentTab.id;

          return (
            <Pressable
              key={tab.id}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveTabId(tab.id);
                setSelectedPointIndex(null);
              }}
              style={[
                styles.tabBtn,
                isActive
                  ? [
                      styles.activeTabBtn,
                      {
                        backgroundColor: theme.card,
                        borderColor: theme.border,
                      },
                    ]
                  : null,
              ]}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  {
                    color: isActive ? theme.text : theme.mutedText,
                    fontWeight: isActive ? "700" : "500",
                  },
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* View All Affordance */}
      {viewAllHref ? (
        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push(viewAllHref as never);
          }}
          style={styles.viewAllRow}
        >
          <Text style={[styles.viewAllText, { color: theme.primary }]}>
            View full analytics & charts
          </Text>
          <Ionicons color={theme.primary} name="chevron-forward" size={14} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  activeTabBtn: {
    borderRadius: 8,
    borderWidth: 1,
  },
  badge: {
    alignItems: "center",
    borderRadius: 8,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  barCol: {
    alignItems: "center",
    flex: 1,
    height: "100%",
    justifyContent: "flex-end",
  },
  barFill: {
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    bottom: 0,
    position: "absolute",
    width: "100%",
  },
  barLabel: {
    fontSize: 10,
    marginTop: 6,
    textAlign: "center",
  },
  barTrack: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 4,
    flex: 1,
    overflow: "hidden",
    position: "relative",
    width: "70%",
  },
  barsContainer: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 6,
    height: 120,
    paddingTop: 10,
    width: "100%",
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 16,
    padding: 16,
  },
  chartArea: {
    marginTop: 4,
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerTextCol: {
    flex: 1,
    gap: 2,
  },
  mainValue: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.4,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  sublabel: {
    fontSize: 12,
  },
  tabBtn: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingVertical: 8,
  },
  tabBtnText: {
    fontSize: 11,
  },
  tabsRow: {
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    padding: 3,
  },
  viewAllRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    justifyContent: "center",
    paddingTop: 4,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
