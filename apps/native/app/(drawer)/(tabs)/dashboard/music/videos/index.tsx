/* eslint-disable sort-vars */
import { Stack } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";

import { authClient } from "@/lib/auth-client";
import { FramelessGrid } from "@/components/dashboard/frameless-grid";
import { DashboardPageHeader } from "@/components/dashboard/page-header";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import type { DashboardStat } from "@/components/dashboard/stats-grid";
import { NAV_THEME } from "@/lib/constants";
import { useDashboardVideosQuery } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

const styles = StyleSheet.create({
  content: { gap: 16, padding: 20, paddingBottom: 48 },
});

export default function DashboardVideosScreen() {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    { data: session } = authClient.useSession(),
    signedIn = Boolean(session?.user),
    videosQuery = useDashboardVideosQuery(signedIn),
    videos = videosQuery.data ?? [],
    verifiedCount = videos.filter(
      (video) => video.verifiedOnPlatform
    ).length,
    externalCount = videos.filter(
      (video) => video.sourceProvider === "external"
    ).length,
    processingCount = videos.filter(
      (video) => video.status === "processing"
    ).length,
    stats: DashboardStat[] = [
      {
        description: "Your visual catalog",
        icon: "videocam",
        title: "Total Videos",
        value: String(videos.length),
      },
      {
        description: "Mux uploads on platform",
        icon: "shield-checkmark",
        title: "Verified Uploads",
        value: String(verifiedCount),
      },
      {
        description: "Linked YouTube sources",
        icon: "link",
        title: "External Sources",
        value: String(externalCount),
      },
      {
        description: "Being processed now",
        icon: "sync",
        title: "Processing",
        value: String(processingCount),
      },
    ];

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          title: "Videos",
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: theme.background }}
      >
        <View style={styles.content}>
          <DashboardPageHeader
            ctaHref="/dashboard/music/videos/new"
            ctaLabel="New Video"
            subtitle="Upload verified music videos or link external sources"
            title="Videos"
          />
          <StatsGrid stats={stats} />
          <FramelessGrid
            empty="Upload a verified video or link an external source to start your library."
            isLoading={videosQuery.isLoading}
            items={videos.map((video) => ({
              href: `/videos/${video.id}`,
              id: video.id,
              image: video.thumbnailUrl,
              title: video.title,
            }))}
          />
        </View>
      </ScrollView>
    </>
  );
}
