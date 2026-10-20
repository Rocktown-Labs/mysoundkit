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
import { NativeImage } from "@/components/native-image";
import { NativeRail } from "@/components/native-rail";
import { NativeSection } from "@/components/native-section";
import { authClient } from "@/lib/auth-client";
import { NAV_THEME } from "@/lib/constants";
import {
  useDashboardTracksQuery,
  useMeEntitlementsQuery,
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
    description: "Release dates, promo tasks, and milestones",
    href: "/dashboard/career/calendar",
    icon: "calendar",
    title: "Calendar",
  },
  {
    description: "Team members, roles, and workspace seats",
    href: "/dashboard/career/team",
    icon: "people",
    title: "Workspace",
  },
  {
    description: "Ad campaigns, audience reach, and wallet",
    href: "/dashboard/career/ads",
    icon: "megaphone",
    title: "Ads & Promotion",
  },
  {
    description: "Revenue, payouts, and financial summary",
    href: "/dashboard/career/payments",
    icon: "card",
    title: "Finance & Payouts",
  },
  {
    description: "Account preferences and artist settings",
    href: "/dashboard/career/settings",
    icon: "settings",
    title: "Settings",
  },
];

const FINANCE_CHART_TABS: [ChartTabConfig, ChartTabConfig, ChartTabConfig] = [
  {
    badge: "+24.5%",
    data: [
      { label: "May", value: 310 },
      { label: "Jun", value: 420 },
      { label: "Jul", value: 380 },
      { label: "Aug", value: 540 },
      { label: "Sep", value: 490 },
      { label: "Oct", value: 700 },
    ],
    id: "revenue",
    label: "Revenue",
    sublabel: "Past 6 months earnings",
    unitPrefix: "$",
    valueLabel: "$2,840.00",
  },
  {
    badge: "+14.2%",
    data: [
      { label: "May", value: 40 },
      { label: "Jun", value: 75 },
      { label: "Jul", value: 60 },
      { label: "Aug", value: 110 },
      { label: "Sep", value: 85 },
      { label: "Oct", value: 90 },
    ],
    id: "tips",
    label: "Direct Tips",
    sublabel: "Fan contributions during live drops",
    unitPrefix: "$",
    valueLabel: "$460.00",
  },
  {
    badge: "Deposited",
    data: [
      { label: "May", value: 290 },
      { label: "Jun", value: 400 },
      { label: "Jul", value: 360 },
      { label: "Aug", value: 500 },
      { label: "Sep", value: 430 },
      { label: "Oct", value: 400 },
    ],
    id: "payouts",
    label: "Payouts",
    sublabel: "Transferred to verified Stripe bank",
    unitPrefix: "$",
    valueLabel: "$2,380.00",
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
    entitlementsQuery = useMeEntitlementsQuery(signedIn),
    network = useNetworkQuery(signedIn),
    tracks = useDashboardTracksQuery(signedIn),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    user = session?.user,
    meData = meQuery.data?.user,
    displayName = meData?.displayName || user?.name || "SoundKit Artist",
    email = user?.email || "",
    avatarUrl = meData?.avatarUrl || user?.image || null,
    isPremium = entitlementsQuery.data?.isPremium ?? false,
    totalPlays = useMemo(
      () =>
        (tracks.data ?? []).reduce((sum, track) => sum + (track.plays || 0), 0),
      [tracks.data]
    ),
    stats: DashboardStat[] = useMemo(
      () => [
        {
          description: "Across catalog",
          icon: "play",
          title: "Plays",
          value: totalPlays > 0 ? totalPlays.toLocaleString() : "0",
        },
        {
          description: "Active fans",
          icon: "people",
          title: "Followers",
          value: (network.data?.counts?.followers ?? 0).toString(),
        },
        {
          description: "Stripe payouts",
          icon: "card",
          title: "Earnings",
          value: isPremium ? "$2.8K" : "$0",
        },
      ],
      [totalPlays, network.data, isPremium]
    );

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

          {/* Profile CTA buttons */}
          <View style={styles.profileActions}>
            <Pressable
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/dashboard/career/profile" as never);
              }}
              style={({ pressed }) => [
                styles.profileBtn,
                {
                  backgroundColor: pressed ? "#212121" : "#141414",
                  borderColor: theme.border,
                },
              ]}
            >
              <Ionicons color={theme.text} name="person-outline" size={13} />
              <Text style={[styles.profileBtnText, { color: theme.text }]}>
                Edit
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/dashboard/career/account-profile" as never);
              }}
              style={({ pressed }) => [
                styles.profileBtn,
                {
                  backgroundColor: pressed ? "#212121" : "#141414",
                  borderColor: theme.border,
                },
              ]}
            >
              <Ionicons color={theme.text} name="id-card-outline" size={13} />
              <Text style={[styles.profileBtnText, { color: theme.text }]}>
                Account
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/dashboard/career/team" as never);
              }}
              style={({ pressed }) => [
                styles.profileBtn,
                {
                  backgroundColor: pressed ? "#212121" : "#141414",
                  borderColor: theme.border,
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
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/dashboard/career/settings" as never);
              }}
              style={({ pressed }) => [
                styles.settingsBtn,
                {
                  backgroundColor: pressed ? "#212121" : "#141414",
                  borderColor: theme.border,
                },
              ]}
            >
              <Ionicons color={theme.text} name="settings-outline" size={16} />
            </Pressable>
          </View>
        </View>

        {/* 3 Condensed Stat Cards */}
        <View style={styles.statsSection}>
          <StatsGrid stats={stats} />
        </View>

        {/* Interactive Finance Chart */}
        <View style={styles.chartSection}>
          <StatChartCard
            tabs={FINANCE_CHART_TABS}
            title="Finance & Revenue"
            viewAllHref="/dashboard/career/payments"
          />
        </View>

        {/* Feature Rails */}
        <View style={styles.railsContainer}>
          {/* Analytics Rail */}
          <NativeSection
            description="Audience reach and streaming performance"
            title="Analytics"
            viewAllHref="/dashboard/career/analytics"
          >
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
                value={tracks.data?.[0]?.title ?? "Upload Tracks"}
              />
              <CareerRailCard
                actionLabel="View cities"
                description="Listener concentration across top metro regions"
                href="/dashboard/career/analytics"
                icon="globe"
                title="Audience Reach"
                value="Global & US"
              />
            </NativeRail>
          </NativeSection>

          {/* Workspace Rail */}
          <NativeSection
            description="Team members and collaborator access"
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
            </NativeRail>
          </NativeSection>

          {/* Ads Rail */}
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
            </NativeRail>
          </NativeSection>

          {/* Finance Rail */}
          <NativeSection
            description="Revenue, payouts, and sales earnings"
            title="Finance"
            viewAllHref="/dashboard/career/payments"
          >
            <NativeRail>
              <CareerRailCard
                actionLabel="View balance"
                badge="Direct"
                description="Net payouts from beat sales, stems, and tips"
                href="/dashboard/career/payments"
                icon="card"
                title="Earnings"
                value="Payouts"
              />
              <CareerRailCard
                actionLabel="Check status"
                description="Automated deposits into your verified bank account"
                href="/dashboard/career/payments"
                icon="checkmark-circle"
                title="Stripe Payouts"
                value="Connected"
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
  statsSection: {
    marginBottom: 20,
  },
  chartSection: {
    marginBottom: 24,
  },
  profileNetworkSub: {
    fontSize: 11,
    marginTop: 4,
  },
});
