/* oxlint-disable one-var, sort-vars, sort-keys, complexity, react/preserve-manual-memoization */
/* eslint-disable one-var, sort-vars, sort-keys */
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Container } from "@/components/container";
import { DashboardJumpModal } from "@/components/dashboard/jump-modal";
import type { DashboardJumpItem } from "@/components/dashboard/jump-modal";
import { StatChartCard } from "@/components/dashboard/stat-chart-card";
import type { ChartTabConfig } from "@/components/dashboard/stat-chart-card";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import type { DashboardStat } from "@/components/dashboard/stats-grid";
import { DashboardTopBar } from "@/components/dashboard/top-bar";
import { NativeRail } from "@/components/native-rail";
import { NativeSection } from "@/components/native-section";
import { authClient } from "@/lib/auth-client";
import { NAV_THEME } from "@/lib/constants";
import {
  useBattleKitsQuery,
  useBattleRecordQuery,
  useBattleStatsQuery,
  useMyLiveExperiencesQuery,
} from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

const LIVE_ITEMS: DashboardJumpItem[] = [
  {
    description: "Battle requests, discovery, challenges, and matchups",
    href: "/dashboard/live/battles",
    icon: "trophy",
    title: "Battles & Challenges",
  },
  {
    description: "Live stream setup, OBS keys, and broadcast tools",
    href: "/dashboard/live/streams",
    icon: "radio",
    title: "Creator Streams",
  },
  {
    description: "Listening parties for releases and premiering music",
    href: "/dashboard/live/parties",
    icon: "headset",
    title: "Listening Parties",
  },
  {
    description: "Battle kits, format slots, and track loadouts",
    href: "/dashboard/live/my-kit",
    icon: "musical-notes",
    title: "Battle Kits",
  },
  {
    description: "Battle performance by track, win rates, and votes",
    href: "/dashboard/live/my-stats",
    icon: "bar-chart",
    title: "Live Stats",
  },
];

const LIVE_CHART_TABS: [ChartTabConfig, ChartTabConfig, ChartTabConfig] = [
  {
    badge: "Matchups",
    data: [
      { label: "B1", value: 3 },
      { label: "B2", value: 2 },
      { label: "B3", value: 5 },
      { label: "B4", value: 4 },
      { label: "B5", value: 6 },
      { label: "B6", value: 4 },
    ],
    id: "battles",
    label: "Battle Rounds",
    sublabel: "Rounds won in official duels",
    valueLabel: "24 Won",
  },
  {
    badge: "+18.2%",
    data: [
      { label: "B1", value: 180 },
      { label: "B2", value: 240 },
      { label: "B3", value: 310 },
      { label: "B4", value: 280 },
      { label: "B5", value: 420 },
      { label: "B6", value: 390 },
    ],
    id: "votes",
    label: "Crowd Votes",
    sublabel: "Audience and fan decisions",
    valueLabel: "1,820 Votes",
  },
  {
    badge: "Live Tips",
    data: [
      { label: "B1", value: 25 },
      { label: "B2", value: 40 },
      { label: "B3", value: 65 },
      { label: "B4", value: 50 },
      { label: "B5", value: 90 },
      { label: "B6", value: 75 },
    ],
    id: "tips",
    label: "Stage Support",
    sublabel: "Direct fan tip contributions",
    unitPrefix: "$",
    valueLabel: "$345.00",
  },
];

interface RailCardProps {
  actionLabel?: string;
  badge?: string;
  description: string;
  href: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  value?: string;
  width?: number;
}

function LiveRailCard({
  actionLabel,
  badge,
  description,
  href,
  icon,
  title,
  value,
  width = 160,
}: RailCardProps) {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;

  return (
    <Pressable
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(href as never);
      }}
      style={({ pressed }) => [
        styles.railCard,
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
          opacity: pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
          width,
        },
      ]}
    >
      <View style={styles.railCardHeader}>
        <View
          style={[
            styles.iconTile,
            { backgroundColor: "rgba(184, 163, 255, 0.12)" },
          ]}
        >
          <Ionicons color={theme.primary} name={icon} size={18} />
        </View>
        {badge ? (
          <View style={[styles.badge, { backgroundColor: theme.primary }]}>
            <Text
              style={[styles.badgeText, { color: theme.primaryForeground }]}
            >
              {badge}
            </Text>
          </View>
        ) : null}
      </View>
      <Text
        numberOfLines={1}
        style={[styles.railCardTitle, { color: theme.text }]}
      >
        {title}
      </Text>
      {value ? (
        <Text style={[styles.railCardValue, { color: theme.primary }]}>
          {value}
        </Text>
      ) : null}
      <Text
        numberOfLines={2}
        style={[styles.railCardDesc, { color: theme.mutedText }]}
      >
        {description}
      </Text>
      {actionLabel ? (
        <View style={styles.actionRow}>
          <Text style={[styles.actionText, { color: theme.primary }]}>
            {actionLabel}
          </Text>
          <Ionicons color={theme.primary} name="chevron-forward" size={12} />
        </View>
      ) : null}
    </Pressable>
  );
}

export default function LiveOverviewScreen() {
  const { colorScheme } = useColorScheme(),
    { data: session } = authClient.useSession(),
    signedIn = Boolean(session?.user),
    [jumpModalVisible, setJumpModalVisible] = useState(false),
    recordQuery = useBattleRecordQuery(signedIn),
    statsQuery = useBattleStatsQuery(signedIn),
    kitsQuery = useBattleKitsQuery({ enabled: signedIn }),
    experiencesQuery = useMyLiveExperiencesQuery(signedIn),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    record = recordQuery.data,
    statsData = statsQuery.data,
    kits = kitsQuery.data ?? [],
    experiences = experiencesQuery.data ?? [],
    wins = record?.ranked?.wins ?? record?.participation?.wins ?? 0,
    losses = record?.ranked?.losses ?? record?.participation?.losses ?? 0,
    totalBattles = wins + losses,
    winRate =
      totalBattles > 0 ? `${Math.round((wins / totalBattles) * 100)}%` : "0%",
    stats: DashboardStat[] = useMemo(
      () => [
        {
          description: "Matchup record",
          icon: "trophy",
          title: "Record",
          value: `${wins}W - ${losses}L`,
        },
        {
          description: "Crowd victory rate",
          icon: "ribbon",
          title: "Win Rate",
          value: winRate,
        },
        {
          description: "Active broadcasts",
          icon: "radio",
          title: "Rooms",
          value: `${experiences.length} Active`,
        },
      ],
      [wins, losses, winRate, experiences.length]
    ),
    liveChartTabs = useMemo((): [
      ChartTabConfig,
      ChartTabConfig,
      ChartTabConfig,
    ] => {
      const battlePoints =
        statsData && statsData.length > 0
          ? statsData.slice(0, 6).map((item) => ({
              label: item.trackName.slice(0, 8),
              value: item.wins,
            }))
          : LIVE_CHART_TABS[0].data;

      return [
        {
          ...LIVE_CHART_TABS[0],
          data: battlePoints,
          valueLabel: `${wins} Won`,
        },
        LIVE_CHART_TABS[1],
        LIVE_CHART_TABS[2],
      ];
    }, [statsData, wins]);

  return (
    <Container>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: theme.background }}
      >
        <DashboardTopBar
          onOpenJumpMenu={() => setJumpModalVisible(true)}
          showExit={false}
          subtitle="Battles, listening parties, and broadcast tools."
          title="Live"
        />

        {/* Quick Action Buttons */}
        <View style={styles.quickActionsRow}>
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/dashboard/live/battles" as never);
            }}
            style={({ pressed }) => [
              styles.actionBtn,
              {
                backgroundColor: theme.primary,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Ionicons color={theme.primaryForeground} name="trophy" size={14} />
            <Text
              style={[styles.actionBtnText, { color: theme.primaryForeground }]}
            >
              Start Battle
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/dashboard/live/streams" as never);
            }}
            style={({ pressed }) => [
              styles.actionBtnSecondary,
              {
                backgroundColor: pressed ? "#222222" : "#141414",
                borderColor: theme.border,
              },
            ]}
          >
            <Ionicons color={theme.text} name="radio" size={14} />
            <Text style={[styles.actionBtnTextSec, { color: theme.text }]}>
              Go Live
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/dashboard/live/parties" as never);
            }}
            style={({ pressed }) => [
              styles.actionBtnSecondary,
              {
                backgroundColor: pressed ? "#222222" : "#141414",
                borderColor: theme.border,
              },
            ]}
          >
            <Ionicons color={theme.text} name="headset" size={14} />
            <Text style={[styles.actionBtnTextSec, { color: theme.text }]}>
              Host Party
            </Text>
          </Pressable>
        </View>

        {/* 3 Condensed Stat Cards */}
        <View style={styles.statsSection}>
          <StatsGrid stats={stats} />
        </View>

        {/* Horizontally Scrolling Feature Rails */}
        <View style={styles.railsContainer}>
          {/* Performance Rail with Chart Header */}
          <NativeSection
            description="Matchup rounds, crowd votes, and stage support"
            title="Performance"
            viewAllHref="/dashboard/live/my-stats"
          >
            <View style={styles.chartContainer}>
              <StatChartCard
                tabs={liveChartTabs}
                title="Battle & Audience Performance"
                viewAllHref="/dashboard/live/my-stats"
              />
            </View>
            <NativeRail>
              <LiveRailCard
                actionLabel="View ratings"
                badge="Analytics"
                description="Track win-loss distribution and crowd favorites"
                href="/dashboard/live/my-stats"
                icon="trending-up"
                title="Track Performance"
                value={`${winRate} Win Rate`}
              />
              <LiveRailCard
                actionLabel="View tips"
                description="Fan donations and tip volume during live sessions"
                href="/dashboard/live/my-stats"
                icon="heart"
                title="Crowd Support"
                value="Live Earnings"
              />
            </NativeRail>
          </NativeSection>

          {/* Battles Rail */}
          <NativeSection
            description="Tournaments, challenge requests, and head-to-head duels"
            title="Battles"
            viewAllHref="/dashboard/live/battles"
          >
            <NativeRail>
              <LiveRailCard
                actionLabel="Open battles"
                badge="Matchup"
                description="Challenge eligible creators in your genre"
                href="/dashboard/live/battles"
                icon="trophy"
                title="Duel Challenges"
                value="Find Opponent"
              />
              <LiveRailCard
                actionLabel="Manage requests"
                description="Incoming invitations and active matches"
                href="/dashboard/live/battles"
                icon="flash"
                title="Active Battles"
                value="Queue Status"
              />
              <LiveRailCard
                actionLabel="Read rules"
                description="BO1 & BO3 guidelines, timeouts, and scoring"
                href="/dashboard/live/battles"
                icon="document-text"
                title="Tournament Rules"
                value="Scoring System"
              />
            </NativeRail>
          </NativeSection>

          {/* Streams Rail */}
          <NativeSection
            description="Broadcast control room and OBS video ingest"
            title="Streams"
            viewAllHref="/dashboard/live/streams"
          >
            <NativeRail>
              <LiveRailCard
                actionLabel="Open control"
                badge="Cloudflare"
                description="Stream key, RTMP ingest, and broadcast dashboard"
                href="/dashboard/live/streams"
                icon="radio"
                title="Control Room"
                value="OBS Studio"
              />
              <LiveRailCard
                actionLabel="Open chat"
                description="Real-time fan interaction and question queue"
                href="/dashboard/live/streams"
                icon="chatbubbles"
                title="Live Chat"
                value="Moderation"
              />
              <LiveRailCard
                actionLabel="View clips"
                description="Automatic stream replays and highlight reels"
                href="/dashboard/live/streams"
                icon="videocam"
                title="Broadcast Archives"
                value="Saved Videos"
              />
            </NativeRail>
          </NativeSection>

          {/* Listening Parties Rail */}
          <NativeSection
            description="Release premieres and synchronized fan rooms"
            title="Listening Parties"
            viewAllHref="/dashboard/live/parties"
          >
            <NativeRail>
              <LiveRailCard
                actionLabel="Schedule party"
                badge="Premiere"
                description="Host a live audio room with synchronized track playback"
                href="/dashboard/live/parties"
                icon="headset"
                title="Album Premiere"
                value="Schedule Room"
              />
              <LiveRailCard
                actionLabel="Invite fans"
                description="Direct invitations for your top subscribers"
                href="/dashboard/live/parties"
                icon="people"
                title="VIP Lounge"
                value="Private Access"
              />
            </NativeRail>
          </NativeSection>

          {/* Battle Kits Rail */}
          <NativeSection
            description="Named song sets configured for tournament battle rules"
            title="Battle Kits"
            viewAllHref="/dashboard/live/my-kit"
          >
            <NativeRail>
              <LiveRailCard
                actionLabel="Configure kit"
                badge={kits.length > 0 ? "Configured" : "Setup"}
                description="Main 4-track loadout required for Best-of-3 duels"
                href="/dashboard/live/my-kit"
                icon="musical-notes"
                title="Arsenal Loadout"
                value={`${kits.length} Kits Ready`}
              />
              <LiveRailCard
                actionLabel="Create new"
                description="Build a new specialized kit for specific genres"
                href="/dashboard/live/my-kit"
                icon="add-circle"
                title="New Battle Kit"
                value="Custom Lineup"
              />
            </NativeRail>
          </NativeSection>
        </View>
      </ScrollView>

      {/* Jump to Live Menu */}
      <DashboardJumpModal
        items={LIVE_ITEMS}
        onClose={() => setJumpModalVisible(false)}
        subtitle="Quick access to all live and broadcast destinations"
        title="Live Studio"
        visible={jumpModalVisible}
      />
    </Container>
  );
}

const styles = StyleSheet.create({
  actionBtn: {
    alignItems: "center",
    borderRadius: 12,
    flex: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    paddingVertical: 10,
  },
  actionBtnSecondary: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    paddingVertical: 10,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  actionBtnTextSec: {
    fontSize: 12,
    fontWeight: "700",
  },
  actionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    marginTop: 8,
  },
  actionText: {
    fontSize: 12,
    fontWeight: "700",
  },
  arenaCard: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 16,
    marginBottom: 24,
    padding: 18,
  },
  arenaHeading: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  arenaMeta: {
    flex: 1,
    gap: 4,
  },
  arenaSub: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  arenaTopRow: {
    alignItems: "flex-start",
    flexDirection: "row",
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  content: {
    padding: 20,
    paddingBottom: 64,
  },
  iconTile: {
    alignItems: "center",
    borderRadius: 10,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  chartContainer: {
    marginBottom: 16,
  },
  quickActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  railCard: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
    padding: 14,
  },
  railCardDesc: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  railCardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  railCardTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  railCardValue: {
    fontSize: 16,
    fontWeight: "800",
    marginTop: 2,
  },
  railsContainer: {
    gap: 28,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  statsSection: {
    marginBottom: 24,
  },
  statusBadge: {
    alignItems: "center",
    borderRadius: 999,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusDot: {
    borderRadius: 999,
    height: 6,
    width: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  tierText: {
    fontSize: 11,
    fontWeight: "600",
  },
});
