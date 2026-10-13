/* eslint-disable sort-vars */
import { Stack } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";

import { authClient } from "@/lib/auth-client";
import { FramelessGrid } from "@/components/dashboard/frameless-grid";
import { DashboardPageHeader } from "@/components/dashboard/page-header";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import type { DashboardStat } from "@/components/dashboard/stats-grid";
import { NAV_THEME } from "@/lib/constants";
import { useDashboardProjectsQuery } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

const styles = StyleSheet.create({
  content: { gap: 16, padding: 20, paddingBottom: 48 },
});

export default function DashboardProjectsScreen() {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    { data: session } = authClient.useSession(),
    signedIn = Boolean(session?.user),
    projectsQuery = useDashboardProjectsQuery(signedIn),
    projects = projectsQuery.data ?? [],
    releasedCount = projects.filter(
      (project) => project.status === "released"
    ).length,
    collaboratorCount = Math.max(
      0,
      ...projects.map((project) => project.collaboratorCount)
    ),
    stats: DashboardStat[] = [
      {
        description: "Albums, EPs, and singles",
        icon: "albums",
        title: "Total Projects",
        value: String(projects.length),
      },
      {
        description: "Published to your audience",
        icon: "checkmark-circle",
        title: "Released",
        value: String(releasedCount),
      },
      {
        description: "In progress and upcoming",
        icon: "construct",
        title: "In Progress",
        value: String(projects.length - releasedCount),
      },
      {
        description: "Credited collaborators",
        icon: "people",
        title: "Collaborators",
        value: String(collaboratorCount),
      },
    ];

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          title: "Projects",
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: theme.background }}
      >
        <View style={styles.content}>
          <DashboardPageHeader
            ctaHref="/dashboard/music/projects/new"
            ctaLabel="New Project"
            subtitle="Albums, EPs, mixtapes, and bundles"
            title="Projects"
          />
          <StatsGrid stats={stats} />
          <FramelessGrid
            empty="No projects yet. Create one to collect tracks, credits, and release dates."
            isLoading={projectsQuery.isLoading}
            items={projects.map((project) => ({
              href: `/projects/${project.slug || project.id}`,
              id: project.id,
              image: project.coverArtUrl,
              title: project.title,
            }))}
          />
        </View>
      </ScrollView>
    </>
  );
}
