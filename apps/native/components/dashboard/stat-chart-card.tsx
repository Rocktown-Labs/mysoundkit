/* oxlint-disable one-var, sort-vars, no-nested-ternary, complexity, react/no-array-index-key */
/* eslint-disable one-var, sort-vars, no-nested-ternary, complexity, react/no-array-index-key */
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useState } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { LineChart } from "react-native-gifted-charts";

import { NAV_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/use-color-scheme";

export type ChartTabMode =
  | "area"
  | "bars"
  | "progress_goal"
  | "ranked_horizontal"
  | "segmented_record"
  | "split_ratio";

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface SplitSegment {
  color: string;
  count?: number;
  label: string;
  percent: number;
}

export interface ProgressGoalInfo {
  availableCents: number;
  depositDate?: string;
  pendingCents?: number;
  targetCents: number;
}

export interface RecordFormInfo {
  draws?: number;
  losses: number;
  recentForm: ("D" | "L" | "W")[];
  wins: number;
}

export interface ChartTabConfig {
  badge?: string;
  badgeContext?: string;
  data: ChartDataPoint[];
  emptyCtaHref?: string;
  emptyCtaLabel?: string;
  emptyIcon?: keyof typeof Ionicons.glyphMap;
  emptyMessage?: string;
  emptyTitle?: string;
  id: string;
  label: string;
  mode?: ChartTabMode;
  progressGoal?: ProgressGoalInfo;
  recordForm?: RecordFormInfo;
  splitSegments?: SplitSegment[];
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
    { data, mode = "bars" } = currentTab,
    maxValue = Math.max(...data.map((point) => point.value), 1),
    activePoint = selectedPointIndex === null ? null : data[selectedPointIndex],
    displayValue = activePoint
      ? `${currentTab.unitPrefix ?? ""}${activePoint.value.toLocaleString()}${currentTab.unitSuffix ?? ""}`
      : currentTab.valueLabel,
    displaySublabel = activePoint
      ? activePoint.label
      : (currentTab.sublabel ?? "Total this period"),
    screenWidth = Dimensions.get("window").width,
    chartWidth = Math.max(screenWidth - 72, 280),
    isAllZero =
      currentTab.mode === "segmented_record" && currentTab.recordForm
        ? currentTab.recordForm.wins === 0 && currentTab.recordForm.losses === 0
        : currentTab.mode === "progress_goal" && currentTab.progressGoal
          ? currentTab.progressGoal.availableCents === 0 &&
            (currentTab.progressGoal.pendingCents ?? 0) === 0
          : data.every((p) => p.value === 0);

  const renderVisualizer = () => {
    // 1. Empty state check
    if (isAllZero && (currentTab.emptyTitle || currentTab.emptyCtaLabel)) {
      return (
        <View style={styles.emptyContainer}>
          <View
            style={[
              styles.emptyIconWrap,
              { backgroundColor: "rgba(184, 163, 255, 0.12)" },
            ]}
          >
            <Ionicons
              color={theme.primary}
              name={currentTab.emptyIcon ?? "trophy-outline"}
              size={24}
            />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            {currentTab.emptyTitle ?? "No activity recorded yet"}
          </Text>
          <Text style={[styles.emptyMessage, { color: theme.mutedText }]}>
            {currentTab.emptyMessage ??
              "Enter the arena or release new music to start tracking performance."}
          </Text>
          {currentTab.emptyCtaLabel && currentTab.emptyCtaHref ? (
            <Pressable
              hitSlop={{ bottom: 6, left: 6, right: 6, top: 6 }}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push(currentTab.emptyCtaHref as never);
              }}
              style={({ pressed }) => [
                styles.emptyCtaBtn,
                {
                  backgroundColor: theme.primary,
                  transform: [{ scale: pressed ? 0.96 : 1 }],
                },
              ]}
            >
              <Text
                style={[
                  styles.emptyCtaText,
                  { color: theme.primaryForeground },
                ]}
              >
                {currentTab.emptyCtaLabel}
              </Text>
              <Ionicons
                color={theme.primaryForeground}
                name="arrow-forward"
                size={14}
              />
            </Pressable>
          ) : null}
        </View>
      );
    }

    // 2. Area Sparkline / Trending Curve
    if (mode === "area") {
      const lineData = data.map((point) => ({
        label: point.label,
        value: point.value,
      }));

      return (
        <View style={styles.areaContainer}>
          <LineChart
            adjustToWidth
            areaChart
            color={theme.primary}
            curved
            data={lineData}
            endFillColor="rgba(184, 163, 255, 0.0)"
            endOpacity={0}
            height={100}
            hideAxesAndRules
            hideDataPoints
            hideRules
            hideYAxisText
            isAnimated={false}
            scrollToEnd
            startFillColor="rgba(184, 163, 255, 0.35)"
            startOpacity={0.8}
            thickness={2.5}
            width={chartWidth}
          />
          <View style={styles.areaLabelsRow}>
            {data.slice(0, 6).map((point, index) => (
              <Text
                key={`${currentTab.id}-area-${point.label}-${index}`}
                style={[styles.areaLabelText, { color: theme.mutedText }]}
              >
                {point.label}
              </Text>
            ))}
          </View>
        </View>
      );
    }

    // 3. Ranked Horizontal Bars (for Top Tracks)
    if (mode === "ranked_horizontal") {
      return (
        <View style={styles.rankedListContainer}>
          {data.slice(0, 5).map((point, index) => {
            const pct =
              maxValue > 0
                ? Math.max(Math.round((point.value / maxValue) * 100), 6)
                : 6;
            return (
              <View
                key={`${currentTab.id}-rank-${point.label}-${index}`}
                style={styles.rankedRow}
              >
                <View
                  style={[
                    styles.rankBadge,
                    {
                      backgroundColor:
                        index === 0
                          ? theme.primary
                          : "rgba(255, 255, 255, 0.08)",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.rankNum,
                      {
                        color:
                          index === 0 ? theme.primaryForeground : theme.text,
                      },
                    ]}
                  >
                    #{index + 1}
                  </Text>
                </View>
                <View style={styles.rankedBarWrap}>
                  <View style={styles.rankedTopInfo}>
                    <Text
                      numberOfLines={1}
                      style={[styles.rankedTitle, { color: theme.text }]}
                    >
                      {point.label}
                    </Text>
                    <Text
                      style={[styles.rankedValue, { color: theme.mutedText }]}
                    >
                      {point.value.toLocaleString()} plays
                    </Text>
                  </View>
                  <View style={styles.rankedTrack}>
                    <View
                      style={[
                        styles.rankedFill,
                        {
                          backgroundColor:
                            index === 0
                              ? theme.primary
                              : "rgba(184, 163, 255, 0.45)",
                          width: `${pct}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      );
    }

    // 4. Split Ratio Bar (New vs Returning, or Me vs Opponent)
    if (mode === "split_ratio") {
      const segments = currentTab.splitSegments ?? [
        { color: theme.primary, label: "Your Share", percent: 64 },
        {
          color: "rgba(255, 255, 255, 0.15)",
          label: "Opponent",
          percent: 36,
        },
      ];

      return (
        <View style={styles.splitContainer}>
          <View style={styles.splitBarTrack}>
            {segments.map((seg, idx) => (
              <View
                key={`${currentTab.id}-split-${seg.label}-${idx}`}
                style={[
                  styles.splitSegment,
                  {
                    backgroundColor: seg.color,
                    borderBottomLeftRadius: idx === 0 ? 8 : 0,
                    borderBottomRightRadius:
                      idx === segments.length - 1 ? 8 : 0,
                    borderTopLeftRadius: idx === 0 ? 8 : 0,
                    borderTopRightRadius: idx === segments.length - 1 ? 8 : 0,
                    width: `${seg.percent}%`,
                  },
                ]}
              />
            ))}
          </View>
          <View style={styles.splitLegendRow}>
            {segments.map((seg, idx) => (
              <View
                key={`${currentTab.id}-leg-${seg.label}-${idx}`}
                style={styles.splitLegendItem}
              >
                <View
                  style={[styles.splitDot, { backgroundColor: seg.color }]}
                />
                <Text
                  style={[styles.splitLegendLabel, { color: theme.mutedText }]}
                >
                  {seg.label}
                </Text>
                <Text style={[styles.splitLegendPct, { color: theme.text }]}>
                  {seg.percent}%
                </Text>
              </View>
            ))}
          </View>
        </View>
      );
    }

    // 5. Progress Goal (Payouts threshold: $10 minimum)
    if (mode === "progress_goal") {
      const goal = currentTab.progressGoal ?? {
        availableCents: 280,
        pendingCents: 0,
        targetCents: 1000,
      };
      const pct = Math.min(
        Math.round((goal.availableCents / goal.targetCents) * 100),
        100
      );
      const targetDollars = (goal.targetCents / 100).toFixed(2);
      const availDollars = (goal.availableCents / 100).toFixed(2);

      return (
        <View style={styles.goalContainer}>
          <View style={styles.goalHeaderRow}>
            <Text style={[styles.goalTargetLabel, { color: theme.mutedText }]}>
              Progress to ${targetDollars} Auto-Payout
            </Text>
            <Text style={[styles.goalPctText, { color: theme.primary }]}>
              {pct}%
            </Text>
          </View>
          <View style={styles.goalBarTrack}>
            <View
              style={[
                styles.goalBarFill,
                {
                  backgroundColor: theme.primary,
                  width: `${Math.max(pct, 6)}%`,
                },
              ]}
            />
          </View>
          <View style={styles.goalMetaRow}>
            <View style={styles.goalMetaCol}>
              <Text
                style={[styles.goalMetaHeading, { color: theme.mutedText }]}
              >
                Available Balance
              </Text>
              <Text style={[styles.goalMetaValue, { color: theme.text }]}>
                ${availDollars}
              </Text>
            </View>
            <View style={styles.goalMetaCol}>
              <Text
                style={[styles.goalMetaHeading, { color: theme.mutedText }]}
              >
                Payout Method
              </Text>
              <Text style={[styles.goalMetaValue, { color: "#10B981" }]}>
                Stripe Verified
              </Text>
            </View>
          </View>
        </View>
      );
    }

    // 6. Segmented W/L/T Record + Form Dots (for Battles)
    if (mode === "segmented_record") {
      const record = currentTab.recordForm ?? {
        draws: 0,
        losses: 0,
        recentForm: [],
        wins: 0,
      };
      const total = record.wins + record.losses + (record.draws ?? 0);
      const winPct = total > 0 ? Math.round((record.wins / total) * 100) : 50;

      return (
        <View style={styles.recordContainer}>
          <View style={styles.recordBarTrack}>
            <View
              style={[
                styles.recordBarSeg,
                {
                  backgroundColor: "#10B981",
                  borderBottomLeftRadius: 6,
                  borderTopLeftRadius: 6,
                  width: `${winPct}%`,
                },
              ]}
            />
            <View
              style={[
                styles.recordBarSeg,
                {
                  backgroundColor: "#EF4444",
                  borderBottomRightRadius: 6,
                  borderTopRightRadius: 6,
                  width: `${100 - winPct}%`,
                },
              ]}
            />
          </View>
          <View style={styles.recordSubRow}>
            <Text style={[styles.recordSubText, { color: "#10B981" }]}>
              {record.wins} Wins
            </Text>
            <Text style={[styles.recordSubText, { color: theme.mutedText }]}>
              {record.draws ?? 0} Ties
            </Text>
            <Text style={[styles.recordSubText, { color: "#EF4444" }]}>
              {record.losses} Losses
            </Text>
          </View>
          {record.recentForm.length > 0 ? (
            <View style={styles.formRow}>
              <Text style={[styles.formLabel, { color: theme.mutedText }]}>
                Last {record.recentForm.length} Matches:
              </Text>
              <View style={styles.formDotsContainer}>
                {record.recentForm.map((item, idx) => (
                  <View
                    key={`${currentTab.id}-form-${item}-${idx}`}
                    style={[
                      styles.formDot,
                      {
                        backgroundColor:
                          item === "W"
                            ? "#10B981"
                            : item === "L"
                              ? "#EF4444"
                              : "#6B7280",
                      },
                    ]}
                  >
                    <Text style={styles.formDotText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      );
    }

    // 7. Default: Interactive Vertical Bar Columns
    return (
      <View style={styles.barsContainer}>
        {data.map((point, index) => {
          const heightPercent = Math.max(
              Math.round((point.value / maxValue) * 100),
              6
            ),
            isMax = point.value === maxValue,
            isSelected = selectedPointIndex === index;

          return (
            <Pressable
              key={`${currentTab.id}-${point.label}-${index}`}
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
    );
  };

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
          <View style={styles.badgeCol}>
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
            {currentTab.badgeContext ? (
              <Text
                style={[styles.badgeContextText, { color: theme.mutedText }]}
              >
                {currentTab.badgeContext}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* Dynamic Visualizer (Area, Ranked, Split, Goal, Record, or Bars) */}
      <View style={styles.chartArea}>{renderVisualizer()}</View>

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
              hitSlop={{ bottom: 4, left: 4, right: 4, top: 4 }}
              key={tab.id}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveTabId(tab.id);
                setSelectedPointIndex(null);
              }}
              style={({ pressed }) => [
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
                { transform: [{ scale: pressed ? 0.96 : 1 }] },
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
  areaContainer: {
    height: 120,
    justifyContent: "center",
    marginTop: 4,
    overflow: "hidden",
  },
  areaLabelText: {
    fontSize: 10,
    fontWeight: "600",
  },
  areaLabelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingHorizontal: 4,
  },
  badge: {
    alignItems: "center",
    borderRadius: 8,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeCol: {
    alignItems: "flex-end",
    gap: 3,
  },
  badgeContextText: {
    fontSize: 9,
    fontWeight: "500",
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
    minHeight: 120,
  },
  emptyContainer: {
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
    paddingVertical: 14,
  },
  emptyCtaBtn: {
    alignItems: "center",
    borderRadius: 999,
    flexDirection: "row",
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  emptyCtaText: {
    fontSize: 12,
    fontWeight: "700",
  },
  emptyIconWrap: {
    alignItems: "center",
    borderRadius: 999,
    height: 48,
    justifyContent: "center",
    marginBottom: 2,
    width: 48,
  },
  emptyMessage: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  formDot: {
    alignItems: "center",
    borderRadius: 4,
    height: 18,
    justifyContent: "center",
    width: 18,
  },
  formDotText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  formDotsContainer: {
    flexDirection: "row",
    gap: 5,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  formRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  goalBarFill: {
    borderRadius: 5,
    height: "100%",
  },
  goalBarTrack: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 5,
    height: 10,
    overflow: "hidden",
    width: "100%",
  },
  goalContainer: {
    gap: 10,
    justifyContent: "center",
    paddingVertical: 8,
  },
  goalHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  goalMetaCol: {
    gap: 2,
  },
  goalMetaHeading: {
    fontSize: 10,
    fontWeight: "500",
  },
  goalMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  goalMetaText: {
    fontSize: 11,
  },
  goalMetaValue: {
    fontSize: 13,
    fontWeight: "700",
  },
  goalPctText: {
    fontSize: 15,
    fontWeight: "800",
  },
  goalTargetLabel: {
    fontSize: 12,
    fontWeight: "600",
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
  rankBadge: {
    alignItems: "center",
    borderRadius: 6,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  rankNum: {
    fontSize: 10,
    fontWeight: "800",
  },
  rankedBarWrap: {
    flex: 1,
    gap: 4,
  },
  rankedFill: {
    borderRadius: 3,
    height: "100%",
  },
  rankedListContainer: {
    gap: 10,
    justifyContent: "center",
    paddingVertical: 4,
  },
  rankedRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  rankedTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    marginRight: 8,
  },
  rankedTopInfo: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  rankedTrack: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 3,
    height: 6,
    overflow: "hidden",
    width: "100%",
  },
  rankedValue: {
    fontSize: 11,
    fontWeight: "600",
  },
  recordBarSeg: {
    height: "100%",
  },
  recordBarTrack: {
    borderRadius: 6,
    flexDirection: "row",
    height: 12,
    overflow: "hidden",
    width: "100%",
  },
  recordContainer: {
    gap: 12,
    justifyContent: "center",
    paddingVertical: 8,
  },
  recordSubRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  recordSubText: {
    fontSize: 12,
    fontWeight: "700",
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  splitBarTrack: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 8,
    flexDirection: "row",
    height: 14,
    overflow: "hidden",
    width: "100%",
  },
  splitContainer: {
    gap: 14,
    justifyContent: "center",
    paddingVertical: 12,
  },
  splitDot: {
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  splitLegendItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  splitLegendLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  splitLegendPct: {
    fontSize: 11,
    fontWeight: "800",
  },
  splitLegendRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  splitSegment: {
    height: "100%",
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
