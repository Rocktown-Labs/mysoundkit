/* eslint-disable sort-vars */
import { Stack } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { authClient } from "@/lib/auth-client";
import { DashboardPageHeader } from "@/components/dashboard/page-header";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import type { DashboardStat } from "@/components/dashboard/stats-grid";
import { DashboardSectionCard } from "@/components/dashboard/section-card";
import { NAV_THEME } from "@/lib/constants";
import { useNetworkQuery } from "@/lib/soundkit-api";
import type { NetworkResponse } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

const styles = StyleSheet.create({
    avatar: {
      backgroundColor: "transparent",
      borderRadius: 18,
      height: 36,
      width: 36,
    },
    content: { gap: 16, padding: 20, paddingBottom: 48 },
    friendRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    personName: { fontSize: 14, fontWeight: "700" },
    personTag: { fontSize: 11 },
    sectionBody: { paddingBottom: 6 },
  }),
  initialsFor = (name: string): string =>
    name.slice(0, 2).toUpperCase();

export default function DashboardNetworkScreen() {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    { data: session } = authClient.useSession(),
    signedIn = Boolean(session?.user),
    networkQuery = useNetworkQuery(signedIn),
    network = networkQuery.data,
    counts = network?.counts,
    stats: DashboardStat[] = [
      {
        description: "Mutual connections",
        icon: "people",
        title: "Friends",
        value: String(counts?.friends ?? 0),
      },
      {
        description: "People following you",
        icon: "person-add",
        title: "Followers",
        value: String(counts?.followers ?? 0),
      },
      {
        description: "People you follow",
        icon: "person",
        title: "Following",
        value: String(counts?.following ?? 0),
      },
      {
        description: "Awaiting response",
        icon: "hourglass",
        title: "Pending",
        value: String(counts?.pendingRequests ?? 0),
      },
    ];

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          title: "Network",
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: theme.background }}
      >
        <View style={styles.content}>
          <DashboardPageHeader
            ctaHref="/dashboard/music/messages"
            ctaLabel="Messages"
            subtitle="Friends, followers, and collaborators"
            title="Network"
          />
          <StatsGrid stats={stats} />

          <DashboardSectionCard
            description={`${counts?.artistFollowers ?? 0} artists · ${counts?.fanFollowers ?? 0} fans`}
            title="Followers"
          >
            <FollowerList network={network} theme={theme} />
          </DashboardSectionCard>
        </View>
      </ScrollView>
    </>
  );
}

function FollowerList({
  network,
  theme,
}: {
  network?: NetworkResponse;
  theme: typeof NAV_THEME.dark | typeof NAV_THEME.light;
}) {
  const followers = network?.followers ?? [];

  if (followers.length === 0) {
    return (
      <Text style={{ color: theme.mutedText, fontSize: 13, paddingBottom: 14, paddingHorizontal: 14 }}>
        No followers yet. Share your music to grow your network.
      </Text>
    );
  }

  return (
    <View style={styles.sectionBody}>
      {followers.slice(0, 8).map((person) => (
        <View key={person.id} style={styles.friendRow}>
          <View
            style={[
              styles.avatar,
              { alignItems: "center", backgroundColor: theme.muted, justifyContent: "center" },
            ]}
          >
            <Text style={{ color: theme.mutedText, fontSize: 12, fontWeight: "800" }}>
              {initialsFor(person.name)}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={[styles.personName, { color: theme.text }]}>
              {person.name}
            </Text>
            <Text style={[styles.personTag, { color: theme.mutedText }]}>
              {person.accountType === "artist" ? "Artist" : "Fan"}
              {person.followsYou ? " · follows you" : ""}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
