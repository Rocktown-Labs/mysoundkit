/* eslint-disable sort-vars */
import { Stack } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";

import { authClient } from "@/lib/auth-client";
import { FramelessGrid } from "@/components/dashboard/frameless-grid";
import { DashboardPageHeader } from "@/components/dashboard/page-header";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import type { DashboardStat } from "@/components/dashboard/stats-grid";
import { NAV_THEME } from "@/lib/constants";
import { useDashboardTracksQuery } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

const styles = StyleSheet.create({
  content: { gap: 16, padding: 20, paddingBottom: 48 },
});

export default function DashboardTracksScreen() {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    { data: session } = authClient.useSession(),
    signedIn = Boolean(session?.user),
    tracksQuery = useDashboardTracksQuery(signedIn),
    tracks = tracksQuery.data ?? [],
    completedCount = tracks.filter(
      (track) => track.productionStatus === "complete"
    ).length,
    totalPlays = tracks.reduce((total, track) => total + track.plays, 0),
    stats: DashboardStat[] = [
      {
        description: "Across all genres and projects",
        icon: "musical-notes",
        title: "Total Tracks",
        value: String(tracks.length),
      },
      {
        description: "Active recording and processing",
        icon: "mic",
        title: "In Production",
        value: String(Math.max(tracks.length - completedCount, 0)),
      },
      {
        description: "Mixed, mastered and ready",
        icon: "disc",
        title: "Completed",
        value: String(completedCount),
      },
      {
        description: "Platform-wide engagement",
        icon: "play-circle",
        title: "Total Plays",
        value: totalPlays.toLocaleString(),
      },
    ];

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          title: "Tracks",
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: theme.background }}
      >
        <View style={styles.content}>
          <DashboardPageHeader
            ctaHref="/dashboard/music/tracks/new"
            ctaLabel="New Track"
            subtitle="Manage your individual music tracks"
            title="Tracks"
          />
          <StatsGrid stats={stats} />
          <FramelessGrid
            empty="No tracks yet. Upload your first master to make it playable."
            isLoading={tracksQuery.isLoading}
            items={tracks.map((track) => ({
              href: `/tracks/${track.id}`,
              id: track.id,
              image: track.coverArtUrl,
              title: track.title,
            }))}
          />
        </View>
      </ScrollView>
    </>
  );
}
