/* oxlint-disable one-var, sort-vars, sort-keys, complexity, react/preserve-manual-memoization, unicorn/no-array-sort */
/* eslint-disable one-var, sort-vars, sort-keys, unicorn/no-array-sort */
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Container } from "@/components/container";
import { DashboardJumpModal } from "@/components/dashboard/jump-modal";
import type { DashboardJumpItem } from "@/components/dashboard/jump-modal";
import { StatChartCard } from "@/components/dashboard/stat-chart-card";
import type {
  ChartDataPoint,
  ChartTabConfig,
} from "@/components/dashboard/stat-chart-card";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import type { DashboardStat } from "@/components/dashboard/stats-grid";
import { DashboardTopBar } from "@/components/dashboard/top-bar";
import { NativeImage } from "@/components/native-image";
import { NativeRail } from "@/components/native-rail";
import { NativeSection } from "@/components/native-section";
import { authClient } from "@/lib/auth-client";
import { NAV_THEME } from "@/lib/constants";
import {
  resolveApiUrl,
  useAnalyticsAudienceQuery,
  useAnalyticsTimeseriesQuery,
  useAnalyticsTracksQuery,
  useArtistEarningsQuery,
  useDashboardTracksQuery,
  useMeQuery,
  useNetworkQuery,
} from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

const CAREER_ITEMS: DashboardJumpItem[] = [
  {
    description: "Public profile, bio, links, and avatar",
    href: "/dashboard/career/profile",
    icon: "person",
    title: "Public Profile",
  },
  {
    description: "Private account identity and credentials",
    href: "/dashboard/career/account-profile",
    icon: "id-card",
    title: "Account Profile",
  },
  {
    description: "Track streams, audience, and listener growth",
    href: "/dashboard/career/analytics",
    icon: "bar-chart",
    title: "Analytics",
  },
  {
    description: "Revenue, payouts, and financial summary",
    href: "/dashboard/career/payments",
    icon: "card",
    title: "Finance & Payouts",
  },
  {
    description: "Physical CDs, vinyl drops, and fan merchandise",
    href: "/dashboard/career/merch",
    icon: "shirt",
    title: "Store & Merch",
  },
  {
    description: "Ad campaigns, audience reach, and wallet",
    href: "/dashboard/career/ads",
    icon: "megaphone",
    title: "Ads & Promotion",
  },
  {
    description: "Team members, roles, and workspace seats",
    href: "/dashboard/career/team",
    icon: "people",
    title: "Workspace",
  },
  {
    description: "Account preferences and artist settings",
    href: "/dashboard/career/settings",
    icon: "settings",
    title: "Settings",
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

function CareerRailCard({
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

export default function CareerOverviewScreen() {
  const { colorScheme } = useColorScheme(),
    { data: session } = authClient.useSession(),
    signedIn = Boolean(session?.user),
    [jumpModalVisible, setJumpModalVisible] = useState(false),
    meQuery = useMeQuery(signedIn),
    network = useNetworkQuery(signedIn),
    tracks = useDashboardTracksQuery(signedIn),
    timeseriesQuery = useAnalyticsTimeseriesQuery("plays", "7d", signedIn),
    analyticsTracksQuery = useAnalyticsTracksQuery(signedIn),
    audienceQuery = useAnalyticsAudienceQuery(signedIn),
    earningsQuery = useArtistEarningsQuery(signedIn),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    user = session?.user,
    meData = meQuery.data?.user,
    displayName = meData?.displayName || user?.name || "SoundKit Artist",
    email = user?.email || "",
    avatarUrl =
      resolveApiUrl(meData?.avatarUrl) ||
      (user?.image ? resolveApiUrl(user.image) : null),
    totalPlays = useMemo(
      () =>
        (tracks.data ?? []).reduce((sum, track) => sum + (track.plays || 0), 0),
      [tracks.data]
    ),
    sortedSourceTracks = useMemo(() => {
      const allTrackMap = new Map<
        string,
        { id: string; plays: number; title: string }
      >();

      for (const t of tracks.data ?? []) {
        allTrackMap.set(t.id, {
          id: t.id,
          plays: t.plays || 0,
          title: t.title,
        });
      }

      for (const t of analyticsTracksQuery.data?.tracks ?? []) {
        const existing = allTrackMap.get(t.trackId);
        if (existing) {
          existing.plays = Math.max(existing.plays, t.plays || 0);
        } else {
          allTrackMap.set(t.trackId, {
            id: t.trackId,
            plays: t.plays || 0,
            title: t.title,
          });
        }
      }

      return [...allTrackMap.values()].sort((a, b) => b.plays - a.plays);
    }, [analyticsTracksQuery.data, tracks.data]),
    topTrackTitle = useMemo(() => {
      const [top] = sortedSourceTracks;
      return top?.title ?? "Upload Tracks";
    }, [sortedSourceTracks]),
    playsValue = useMemo(() => {
      if (totalPlays > 0) {
        return totalPlays.toLocaleString();
      }
      if (timeseriesQuery.data?.total) {
        return timeseriesQuery.data.total.toLocaleString();
      }
      return "0";
    }, [totalPlays, timeseriesQuery.data?.total]),
    earningsValue = useMemo(() => {
      const cents = earningsQuery.data?.availableBalanceCents;
      if (typeof cents === "number" && cents > 0) {
        return `$${(cents / 100).toFixed(2)}`;
      }
      return "$0.00";
    }, [earningsQuery.data?.availableBalanceCents]),
    stats: DashboardStat[] = useMemo(
      () => [
        {
          description: "Across catalog",
          icon: "play",
          title: "Plays",
          value: playsValue,
        },
        {
          description: "Active fans",
          icon: "people",
          title: "Followers",
          value: (
            network.data?.counts?.followers ??
            audienceQuery.data?.totalUniqueListeners ??
            0
          ).toString(),
        },
        {
          description: "Stripe payouts",
          icon: "card",
          title: "Earnings",
          value: earningsValue,
        },
      ],
      [playsValue, network.data, audienceQuery.data, earningsValue]
    ),
    analyticsChartTabs = useMemo((): [
      ChartTabConfig,
      ChartTabConfig,
      ChartTabConfig,
    ] => {
      // 1. Streams Growth
      const tsPoints = timeseriesQuery.data?.points ?? [];
      const streamsTotal = timeseriesQuery.data?.total ?? totalPlays;
      const streamsData: ChartDataPoint[] =
        tsPoints.length > 0
          ? tsPoints.map((pt) => ({
              label: pt.label,
              value: pt.value,
            }))
          : [
              { label: "Mon", value: 0 },
              { label: "Tue", value: 0 },
              { label: "Wed", value: 0 },
              { label: "Thu", value: 0 },
              { label: "Fri", value: 0 },
              { label: "Sat", value: 0 },
              { label: "Sun", value: 0 },
            ];

      // 2. Top Tracks (ranked by plays descending with real play counts)
      const topTracksData: ChartDataPoint[] = sortedSourceTracks
        .slice(0, 5)
        .map((t) => ({
          label: t.title,
          value: t.plays || 0,
        }));
      const [topTrack] = sortedSourceTracks;
      const topName = topTrack?.title ?? "No tracks yet";
      const topPlays = topTrack ? topTrack.plays || 0 : 0;

      // 3. Audience Reach
      const aud = audienceQuery.data;
      const followersCount = network.data?.counts?.followers ?? 0;
      const uniqueListeners = aud?.totalUniqueListeners ?? followersCount;
      const audienceData: ChartDataPoint[] = [
        { label: "Unique", value: uniqueListeners },
        { label: "New", value: aud?.newListeners ?? 0 },
        { label: "Repeat", value: aud?.returningListeners ?? 0 },
        { label: "Multi", value: aud?.listenersWithMultiTrackPlays ?? 0 },
        { label: "VIP", value: aud?.premiumSupporters ?? 0 },
      ];
      const retRate = Math.min(
        Math.max(aud?.returningListenerRate ?? 0, 0),
        100
      );

      return [
        {
          badge: tsPoints.length > 0 ? "+28.4%" : "Telemetry",
          badgeContext: "vs prev 7 days",
          data: streamsData,
          emptyCtaHref: "/tracks",
          emptyCtaLabel: "Upload Tracks",
          emptyIcon: "musical-notes-outline",
          emptyMessage:
            "No streams recorded yet. Share your tracks or go live to start tracking growth.",
          emptyTitle: "No streams yet",
          id: "streams",
          label: "Streams Growth",
          mode: "area",
          sublabel: "Playback telemetry across catalog",
          valueLabel: `${streamsTotal.toLocaleString()} Plays`,
        },
        {
          badge: "Ranked",
          badgeContext: "by all-time plays",
          data: topTracksData,
          emptyCtaHref: "/tracks",
          emptyCtaLabel: "Upload Music",
          emptyIcon: "musical-notes-outline",
          emptyMessage:
            "Upload your first track or project to see streaming rankings.",
          emptyTitle: "No releases yet",
          id: "top_tracks",
          label: "Top Tracks",
          mode: "ranked_horizontal",
          sublabel: topTrack
            ? `${topName} · ${topPlays.toLocaleString()} plays`
            : "Upload tracks to see rankings",
          valueLabel:
            topPlays > 0
              ? `${topPlays.toLocaleString()} Plays`
              : `${sortedSourceTracks.length} Releases`,
        },
        {
          badge: retRate > 0 ? `${retRate}% Retention` : "Audience",
          badgeContext: "returning listener rate",
          data: audienceData,
          emptyCtaHref: "/dashboard/career/team",
          emptyCtaLabel: "Grow Network",
          emptyIcon: "people-outline",
          emptyMessage:
            "Share your SoundKit Bio to start building a listener audience.",
          emptyTitle: "No listeners yet",
          id: "audience",
          label: "Audience Reach",
          mode: "split_ratio",
          splitSegments: [
            {
              color: theme.primary,
              label: "Returning Fans",
              percent: retRate,
            },
            {
              color: "rgba(255, 255, 255, 0.2)",
              label: "New Listeners",
              percent: 100 - retRate,
            },
          ],
          sublabel: "Unique fans and listener retention",
          valueLabel: `${uniqueListeners.toLocaleString()} Listeners`,
        },
      ];
    }, [
      timeseriesQuery.data,
      totalPlays,
      sortedSourceTracks,
      audienceQuery.data,
      network.data,
      theme.primary,
    ]),
    financeChartTabs = useMemo((): [
      ChartTabConfig,
      ChartTabConfig,
      ChartTabConfig,
    ] => {
      const earnings = earningsQuery.data;
      const statements = earnings?.statements ?? [];
      const hasStatements = statements.length > 0;

      const revenueData: ChartDataPoint[] = hasStatements
        ? statements.slice(-6).map((s) => ({
            label: s.monthLabel.slice(0, 3),
            value: Math.round(s.totalEarningsCents / 100),
          }))
        : [
            { label: "May", value: 0 },
            { label: "Jun", value: 0 },
            { label: "Jul", value: 0 },
            { label: "Aug", value: 0 },
            { label: "Sep", value: 0 },
            { label: "Oct", value: 0 },
          ];

      const tipsData: ChartDataPoint[] = hasStatements
        ? statements.slice(-6).map((s) => ({
            label: s.monthLabel.slice(0, 3),
            value: Math.round(s.tipsCents / 100),
          }))
        : [
            { label: "May", value: 0 },
            { label: "Jun", value: 0 },
            { label: "Jul", value: 0 },
            { label: "Aug", value: 0 },
            { label: "Sep", value: 0 },
            { label: "Oct", value: 0 },
          ];

      const payoutsData: ChartDataPoint[] = hasStatements
        ? statements.slice(-6).map((s) => ({
            label: s.monthLabel.slice(0, 3),
            value: Math.round(
              (s.totalEarningsCents - (s.physicalMerchCents ?? 0)) / 100
            ),
          }))
        : [
            { label: "May", value: 0 },
            { label: "Jun", value: 0 },
            { label: "Jul", value: 0 },
            { label: "Aug", value: 0 },
            { label: "Sep", value: 0 },
            { label: "Oct", value: 0 },
          ];

      const availableBalance = earnings
        ? (earnings.availableBalanceCents / 100).toFixed(2)
        : "0.00";
      const totalEarned = earnings
        ? (
            (earnings.paidLifetimeCents + earnings.availableBalanceCents) /
            100
          ).toFixed(2)
        : "0.00";

      const revenueLabel = `$${availableBalance}`;
      const totalTips = statements.reduce((sum, s) => sum + s.tipsCents, 0);
      const tipsLabel = `$${(totalTips / 100).toFixed(2)}`;
      const payoutsLabel = `$${totalEarned}`;

      const availableCents = earnings?.availableBalanceCents ?? 0;
      const pendingCents = earnings?.pendingReserveCents ?? 0;

      return [
        {
          badge: hasStatements ? "+24.5%" : "Payouts",
          badgeContext: "past 6 mos",
          data: revenueData,
          emptyCtaHref: "/dashboard/career/account-profile",
          emptyCtaLabel: "Setup Payouts",
          emptyIcon: "card-outline",
          emptyMessage:
            "Connect your Stripe account to receive direct tips and monthly payouts.",
          emptyTitle: "No earnings recorded yet",
          id: "revenue",
          label: "Revenue",
          mode: "bars",
          sublabel: "Past 6 months earnings",
          unitPrefix: "$",
          valueLabel: revenueLabel,
        },
        {
          badge: hasStatements ? "+14.2%" : "Tips",
          badgeContext: "fan tips",
          data: tipsData,
          emptyCtaHref: "/dashboard/live",
          emptyCtaLabel: "Go Live",
          emptyIcon: "radio-outline",
          emptyMessage:
            "Fans can send live tips when you broadcast or duel on stage.",
          emptyTitle: "No tips yet",
          id: "tips",
          label: "Direct Tips",
          mode: "area",
          sublabel: "Fan contributions during live drops",
          unitPrefix: "$",
          valueLabel: tipsLabel,
        },
        {
          badge: "Threshold",
          badgeContext: "min $10.00",
          data: payoutsData,
          emptyCtaHref: "/dashboard/career/account-profile",
          emptyCtaLabel: "Configure Stripe",
          emptyIcon: "card-outline",
          emptyMessage:
            "Stripe auto-deposits trigger when balance passes $10.00.",
          emptyTitle: "No payout history",
          id: "payouts",
          label: "Payouts",
          mode: "progress_goal",
          progressGoal: {
            availableCents,
            depositDate: "Next auto-deposit",
            pendingCents,
            targetCents: 1000,
          },
          sublabel: "Transferred to verified Stripe bank",
          unitPrefix: "$",
          valueLabel: payoutsLabel,
        },
      ];
    }, [earningsQuery.data]);

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
          subtitle="Profile, analytics, workspace, and artist business."
          title="Career"
        />

        {/* Profile Overview Card */}
        <View
          style={[
            styles.profileCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <View style={styles.profileTopRow}>
            <View style={styles.avatarWrap}>
              <NativeImage source={avatarUrl} style={styles.avatar} />
            </View>
            <View style={styles.profileMeta}>
              <View style={styles.nameRow}>
                <Text
                  numberOfLines={1}
                  style={[styles.profileName, { color: theme.text }]}
                >
                  {displayName}
                </Text>
                <Ionicons
                  color={theme.primary}
                  name="checkmark-circle"
                  size={16}
                />
              </View>
              <Text
                numberOfLines={1}
                style={[styles.profileEmail, { color: theme.mutedText }]}
              >
                {email}
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.profileNetworkSub, { color: theme.mutedText }]}
              >
                {network.data?.counts?.friends ?? 0} Collaborators ·{" "}
                {network.data?.counts?.followers ?? 0} Followers
              </Text>
            </View>
          </View>

          {/* 3 Condensed Stat Cards */}
          <StatsGrid
            cardStyle={{
              backgroundColor: colorScheme === "dark" ? "#0F0F0F" : "#F7F6F3",
              borderColor: theme.border,
            }}
            stats={stats}
          />

          {/* Profile CTA buttons */}
          <View style={styles.profileActions}>
            <Pressable
              hitSlop={{ bottom: 6, left: 6, right: 6, top: 6 }}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/dashboard/career/profile" as never);
              }}
              style={({ pressed }) => [
                styles.profileBtn,
                {
                  backgroundColor: pressed ? "#212121" : "#141414",
                  borderColor: theme.border,
                  transform: [{ scale: pressed ? 0.96 : 1 }],
                },
              ]}
            >
              <Ionicons color={theme.text} name="person-outline" size={13} />
              <Text style={[styles.profileBtnText, { color: theme.text }]}>
                Edit
              </Text>
            </Pressable>

            <Pressable
              hitSlop={{ bottom: 6, left: 6, right: 6, top: 6 }}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/dashboard/career/account-profile" as never);
              }}
              style={({ pressed }) => [
                styles.profileBtn,
                {
                  backgroundColor: pressed ? "#212121" : "#141414",
                  borderColor: theme.border,
                  transform: [{ scale: pressed ? 0.96 : 1 }],
                },
              ]}
            >
              <Ionicons color={theme.text} name="id-card-outline" size={13} />
              <Text style={[styles.profileBtnText, { color: theme.text }]}>
                Account
              </Text>
            </Pressable>

            <Pressable
              hitSlop={{ bottom: 6, left: 6, right: 6, top: 6 }}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/dashboard/career/team" as never);
              }}
              style={({ pressed }) => [
                styles.profileBtn,
                {
                  backgroundColor: pressed ? "#212121" : "#141414",
                  borderColor: theme.border,
                  transform: [{ scale: pressed ? 0.96 : 1 }],
                },
              ]}
            >
              <Ionicons color={theme.text} name="people-outline" size={13} />
              <Text style={[styles.profileBtnText, { color: theme.text }]}>
                Network
              </Text>
            </Pressable>

            <Pressable
              accessibilityLabel="Career settings"
              accessibilityRole="button"
              hitSlop={{ bottom: 6, left: 6, right: 6, top: 6 }}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/dashboard/career/settings" as never);
              }}
              style={({ pressed }) => [
                styles.settingsBtn,
                {
                  backgroundColor: pressed ? "#212121" : "#141414",
                  borderColor: theme.border,
                  transform: [{ scale: pressed ? 0.94 : 1 }],
                },
              ]}
            >
              <Ionicons color={theme.text} name="settings-outline" size={16} />
            </Pressable>
          </View>
        </View>

        {/* Sections in order: Analytics, Finance, Store, Ads, Workspace */}
        <View style={styles.railsContainer}>
          {/* 1. Analytics Section */}
          <NativeSection
            description="Streams growth, top tracks, and audience reach"
            title="Analytics"
            viewAllHref="/dashboard/career/analytics"
          >
            <View style={styles.chartContainer}>
              <StatChartCard
                tabs={analyticsChartTabs}
                title="Streaming & Audience Telemetry"
                viewAllHref="/dashboard/career/analytics"
              />
            </View>
            <NativeRail>
              <CareerRailCard
                actionLabel="View stats"
                badge="+18%"
                description="Audience engagement and plays over the last 30 days"
                href="/dashboard/career/analytics"
                icon="bar-chart"
                title="Streams Growth"
                value={`${totalPlays.toLocaleString()} plays`}
              />
              <CareerRailCard
                actionLabel="View tracks"
                description="Your catalog's most streamed release this month"
                href="/dashboard/career/analytics"
                icon="flame"
                title="Top Track"
                value={topTrackTitle}
              />
              <CareerRailCard
                actionLabel="View reach"
                description="Unique listeners and audience retention rate"
                href="/dashboard/career/analytics"
                icon="globe"
                title="Audience Reach"
                value={`${(audienceQuery.data?.totalUniqueListeners ?? totalPlays).toLocaleString()} fans`}
              />
            </NativeRail>
          </NativeSection>

          {/* 2. Finance Section */}
          <NativeSection
            description="Revenue, tips, and Stripe payouts"
            title="Finance"
            viewAllHref="/dashboard/career/payments"
          >
            <View style={styles.chartContainer}>
              <StatChartCard
                tabs={financeChartTabs}
                title="Finance & Revenue"
                viewAllHref="/dashboard/career/payments"
              />
            </View>
            <NativeRail>
              <CareerRailCard
                actionLabel="Manage deposits"
                badge="Stripe"
                description="Automated deposits into your verified bank account"
                href="/dashboard/career/payments"
                icon="checkmark-circle"
                title="Stripe Payouts"
                value={
                  earningsQuery.data?.availableBalanceCents
                    ? `$${(earningsQuery.data.availableBalanceCents / 100).toFixed(2)}`
                    : "Connected"
                }
              />
              <CareerRailCard
                actionLabel="View earnings"
                badge="Direct"
                description="Net payouts from sales, creator rewards, and fan tips"
                href="/dashboard/career/payments"
                icon="card"
                title="Earnings Summary"
                value="Royalties"
              />
              <CareerRailCard
                actionLabel="View statements"
                description="Monthly statements, balance reserves, and tax forms"
                href="/dashboard/career/payments"
                icon="wallet"
                title="Payment Wallet"
                value="Monthly History"
              />
            </NativeRail>
          </NativeSection>

          {/* 3. Store Section (Physical & Merch) */}
          <NativeSection
            description="Physical CDs, vinyl drops, fan apparel, and merch"
            title="Store"
            viewAllHref="/dashboard/career/merch"
          >
            <NativeRail>
              <CareerRailCard
                actionLabel="Create"
                badge="New"
                description="Create physical editions or fan merchandise"
                href="/dashboard/create"
                icon="add-circle"
                title="+ New Product"
                value="Launch Drop"
              />
              <CareerRailCard
                actionLabel="Manage"
                description="Kunaki automated audio CD manufacture and distribution"
                href="/dashboard/career/merch"
                icon="disc"
                title="Physical CDs"
                value="Kunaki Audio"
              />
              <CareerRailCard
                actionLabel="Manage"
                description="12-inch and 7-inch vinyl master pressings for releases"
                href="/dashboard/career/merch"
                icon="disc-outline"
                title="Vinyl Pressings"
                value="Lathe Cut"
              />
              <CareerRailCard
                actionLabel="Customize"
                badge="Printful"
                description="T-shirts, hoodies, and tour gear with custom artwork"
                href="/dashboard/career/merch"
                icon="shirt"
                title="Fan Apparel"
                value="Print on Demand"
              />
              <CareerRailCard
                actionLabel="View items"
                description="Album cover posters, tour prints, and sticker packs"
                href="/dashboard/career/merch"
                icon="image"
                title="Art & Posters"
                value="Merch Studio"
              />
            </NativeRail>
          </NativeSection>

          {/* 4. Ads Section */}
          <NativeSection
            description="Campaigns and paid discovery on SoundKit"
            title="Ads"
            viewAllHref="/dashboard/career/ads"
          >
            <NativeRail>
              <CareerRailCard
                actionLabel="Start ad"
                badge="Spotlight"
                description="Drive regional streams and Discover chart placement"
                href="/dashboard/career/ads"
                icon="megaphone"
                title="Promote Track"
                value="Launch Ad"
              />
              <CareerRailCard
                actionLabel="Manage funds"
                description="Ad credits, billing history, and daily spend caps"
                href="/dashboard/career/ads"
                icon="wallet"
                title="Ad Wallet"
                value="Manage Wallet"
              />
              <CareerRailCard
                actionLabel="View targeting"
                description="Target audiences by favorite genres, regions, and artists"
                href="/dashboard/career/ads"
                icon="analytics"
                title="Targeting"
                value="Demographics"
              />
            </NativeRail>
          </NativeSection>

          {/* 5. Workspace Section */}
          <NativeSection
            description="Team members, split sheets, and collaborator access"
            title="Workspace"
            viewAllHref="/dashboard/career/team"
          >
            <NativeRail>
              <CareerRailCard
                actionLabel="Manage team"
                description="Producers, engineers, and artist management seats"
                href="/dashboard/career/team"
                icon="people"
                title="Team Members"
                value={`${network.data?.counts?.friends ?? network.data?.friends?.length ?? 0} Active`}
              />
              <CareerRailCard
                actionLabel="Send invite"
                badge="Collab"
                description="Add new collaborators and split-sheet partners"
                href="/dashboard/career/team"
                icon="person-add"
                title="Invite Member"
                value="New Invite"
              />
              <CareerRailCard
                actionLabel="View splits"
                description="Publishing, master royalties, and writer credit splits"
                href="/dashboard/career/team"
                icon="git-branch"
                title="Split Sheets"
                value="Master Splits"
              />
            </NativeRail>
          </NativeSection>
        </View>
      </ScrollView>

      {/* Jump to Career Menu */}
      <DashboardJumpModal
        items={CAREER_ITEMS}
        onClose={() => setJumpModalVisible(false)}
        subtitle="Quick access to all career and business tools"
        title="Career & Business"
        visible={jumpModalVisible}
      />
    </Container>
  );
}

const styles = StyleSheet.create({
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
  avatar: {
    borderRadius: 999,
    height: 52,
    width: 52,
  },
  avatarWrap: {
    borderRadius: 999,
    overflow: "hidden",
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
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
  nameRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  profileActions: {
    flexDirection: "row",
    gap: 8,
  },
  profileBtn: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    paddingVertical: 10,
  },
  profileBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  profileCard: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
    marginBottom: 24,
    padding: 16,
  },
  profileEmail: {
    fontSize: 12,
    marginTop: 2,
  },
  profileMeta: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: "800",
  },
  profileTopRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
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
  settingsBtn: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  chartContainer: {
    marginBottom: 16,
  },
  profileNetworkSub: {
    fontSize: 11,
    marginTop: 4,
  },
});
