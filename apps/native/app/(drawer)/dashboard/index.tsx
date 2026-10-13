/* eslint-disable sort-vars, complexity, react/purity */
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { router, Stack } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { DashboardSectionCard } from "@/components/dashboard/section-card";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import type { DashboardStat } from "@/components/dashboard/stats-grid";
import { authClient } from "@/lib/auth-client";
import { NAV_THEME } from "@/lib/constants";
import {
  useDashboardProjectsQuery,
  useDashboardTracksQuery,
  useMeEntitlementsQuery,
  useMeQuery,
} from "@/lib/soundkit-api";
import type { ProjectSummary, TrackSummary } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

const styles = StyleSheet.create({
    activityDot: { borderRadius: 999, height: 8, marginTop: 6, width: 8 },
    activityItem: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: 12,
      paddingBottom: 14,
    },
    activityTitle: { flexShrink: 1, fontSize: 13, lineHeight: 19 },
    activityWhen: { fontSize: 10 },
    badge: {
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    badgeText: {
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    browRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
      marginBottom: 6,
    },
    browText: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.4,
      textTransform: "uppercase",
    },
    content: { gap: 16, padding: 20, paddingBottom: 48 },
    cta: {
      alignItems: "center",
      borderRadius: 12,
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    ctaText: { fontSize: 13, fontWeight: "700" },
    empty: {
      fontSize: 13,
      paddingBottom: 16,
      paddingLeft: 14,
      paddingRight: 14,
    },
    eyebrow: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.5,
      marginBottom: 4,
      textTransform: "uppercase",
    },
    hello: { fontSize: 30, fontWeight: "800", letterSpacing: -0.6 },
    pill: {
      alignItems: "center",
      borderRadius: 999,
      flexDirection: "row",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    pillText: { fontSize: 10, fontWeight: "700" },
    projectItem: {
      alignItems: "center",
      flexDirection: "row",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    projectTile: {
      alignItems: "center",
      borderRadius: 12,
      height: 44,
      justifyContent: "center",
      width: 44,
    },
    signInCard: {
      borderRadius: 16,
      borderWidth: 1,
      gap: 10,
      padding: 20,
    },
    signInText: { fontSize: 14, lineHeight: 20 },
    subtitle: { fontSize: 14, lineHeight: 20 },
    title: { fontSize: 18, fontWeight: "800" },
  }),
  relativeDate = (value: string) => {
    const diffDays = Math.max(
      0,
      Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000)
    );
    if (diffDays === 0) {
      return "Today";
    }
    if (diffDays === 1) {
      return "1 day ago";
    }
    return `${diffDays} days ago`;
  };

export default function DashboardHomeScreen() {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    { data: session, isPending: sessionPending } = authClient.useSession(),
    signedIn = Boolean(session?.user),
    meQuery = useMeQuery(signedIn),
    entitlementsQuery = useMeEntitlementsQuery(signedIn),
    tracksQuery = useDashboardTracksQuery(signedIn),
    projectsQuery = useDashboardProjectsQuery(signedIn),
    tracks = tracksQuery.data ?? [],
    projects = projectsQuery.data ?? [],
    user = meQuery.data?.user,
    displayName = user?.displayName ?? user?.username ?? "SoundKit Artist",
    firstName = displayName.split(" ")[0] ?? displayName,
    isPremium = Boolean(entitlementsQuery.data?.isPremium),
    collaboratorCount = Math.max(
      ...tracks.map((track) => track.collaboratorCount),
      ...projects.map((project) => project.collaboratorCount),
      0
    ),
    upcomingReleases = projects.filter(
      (project) =>
        project.releaseDate !== null &&
        project.releaseDate !== undefined &&
        new Date(project.releaseDate).getTime() >= Date.now()
    ),
    stats: DashboardStat[] = [
      {
        description: "From your track library",
        icon: "musical-notes",
        title: "Total Tracks",
        value: String(tracks.length),
      },
      {
        description: "Albums, EPs, and more",
        icon: "folder-open",
        title: "Active Projects",
        value: String(projects.length),
      },
      {
        description: "Credited on your work",
        icon: "people",
        title: "Collaborators",
        value: String(collaboratorCount),
      },
      {
        description: "Scheduled projects",
        icon: "sparkles",
        title: "Upcoming Releases",
        value: String(upcomingReleases.length),
      },
    ],
    recentProjects = projects.slice(0, 3),
    activities = ((): {
      id: string;
      itemId: string;
      kind: "track" | "project";
      label: string;
      title: string;
      updatedAt: string;
    }[] => {
      const fromTracks = tracks.map((track: TrackSummary) => ({
        id: `track-${track.id}`,
        itemId: track.id,
        kind: "track" as const,
        label: "updated track",
        title: track.title,
        updatedAt: track.updatedAt ?? new Date().toISOString(),
      }));
      return [
        ...fromTracks,
        ...projects.map((project: ProjectSummary) => ({
          id: `project-${project.id}`,
          itemId: project.id,
          kind: "project" as const,
          label: "updated project",
          title: project.title,
          updatedAt: project.updatedAt ?? new Date().toISOString(),
        })),
      ]
        // Hermes (RN's JS engine) lacks ES2023 Array#toSorted; sorting a
        // freshly-created literal, so in-place sort is safe.
        // eslint-disable-next-line unicorn/no-array-sort
        .sort(
          (left, right) =>
            new Date(right.updatedAt).getTime() -
            new Date(left.updatedAt).getTime()
        )
        .slice(0, 5);
    })();

  if (sessionPending) {
    return (
      <View style={{ backgroundColor: theme.background, flex: 1 }}>
        <ActivityIndicator color={theme.primary} style={{ marginTop: 80 }} />
      </View>
    );
  }

  if (!signedIn) {
    return (
      <View style={{ backgroundColor: theme.background, flex: 1, padding: 20 }}>
        <View
          style={[
            styles.signInCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.title, { color: theme.text }]}>
            Artist Dashboard
          </Text>
          <Text style={[styles.signInText, { color: theme.mutedText }]}>
            Sign in to see your tracks, projects, releases, and activity.
          </Text>
          <Pressable
            onPress={() => {
              router.push("/account" as never);
            }}
            style={[styles.cta, { backgroundColor: theme.primary }]}
          >
            <Ionicons color={theme.primaryForeground} name="log-in" size={16} />
            <Text style={[styles.ctaText, { color: theme.primaryForeground }]}>
              Sign In
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: "Dashboard" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: theme.background }}
      >
        <View style={styles.content}>
          <View>
            <View style={styles.browRow}>
              <Ionicons color={theme.primary} name="sparkles" size={14} />
              <Text style={[styles.browText, { color: theme.primary }]}>
                Artist Dashboard
              </Text>
              {isPremium ? (
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: theme.primary, opacity: 0.15 },
                  ]}
                >
                  <Text style={[styles.badgeText, { color: theme.primary }]}>
                    Premium
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.hello, { color: theme.text }]}>
              Welcome back, {firstName}
            </Text>
            <Text style={[styles.subtitle, { color: theme.mutedText }]}>
              {collaboratorCount} active collaborators and{" "}
              {upcomingReleases.length} upcoming releases in your catalog.
            </Text>
            <Pressable
              onPress={() => {
                router.push("/dashboard/create" as never);
              }}
              style={({ pressed }) => [
                styles.cta,
                {
                  backgroundColor: theme.primary,
                  marginTop: 14,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Ionicons
                color={theme.primaryForeground}
                name="flash"
                size={16}
              />
              <Text
                style={[styles.ctaText, { color: theme.primaryForeground }]}
              >
                Quickstart
              </Text>
            </Pressable>
          </View>

          {user?.accountType === "artist" && user.username ? (
            <BioLinkCard theme={theme} username={user.username} />
          ) : null}

          <StatsGrid stats={stats} />

          <DashboardSectionCard
            description="Your latest music collaborations and uploads"
            title="Recent Projects"
            viewAllHref="/dashboard/music/projects"
          >
            {projectsQuery.isLoading ? (
              <ActivityIndicator
                color={theme.primary}
                style={{ padding: 20 }}
              />
            ) : null}
            {!projectsQuery.isLoading && recentProjects.length === 0 ? (
              <Text style={[styles.empty, { color: theme.mutedText }]}>
                No projects yet. Create one to collect tracks, credits, and
                release dates.
              </Text>
            ) : null}
            {!projectsQuery.isLoading && recentProjects.length > 0
              ? recentProjects.map((project) => (
                  <Pressable
                    key={project.id}
                    onPress={() => {
                      router.push("/dashboard/music/projects" as never);
                    }}
                  >
                    <View style={styles.projectItem}>
                      <View
                        style={[
                          styles.projectTile,
                          { backgroundColor: theme.primary, opacity: 0.15 },
                        ]}
                      >
                        <Ionicons
                          color={theme.primary}
                          name="musical-notes"
                          size={20}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          numberOfLines={1}
                          style={{
                            color: theme.text,
                            fontSize: 14,
                            fontWeight: "700",
                          }}
                        >
                          {project.title}
                        </Text>
                        <View
                          style={{
                            alignItems: "center",
                            flexDirection: "row",
                            gap: 8,
                            marginTop: 4,
                          }}
                        >
                          <View
                            style={[
                              styles.badge,
                              {
                                backgroundColor:
                                  project.status === "released"
                                    ? theme.primary
                                    : "#F59E0B",
                                opacity: 0.18,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.badgeText,
                                {
                                  color:
                                    project.status === "released"
                                      ? theme.primary
                                      : "#F59E0B",
                                },
                              ]}
                            >
                              {project.status}
                            </Text>
                          </View>
                          <Text
                            style={{ color: theme.mutedText, fontSize: 10 }}
                          >
                            {relativeDate(
                              project.updatedAt ?? new Date().toISOString()
                            )}
                          </Text>
                        </View>
                      </View>
                      <View
                        style={[styles.pill, { backgroundColor: theme.muted }]}
                      >
                        <Ionicons
                          color={theme.primary}
                          name="musical-note"
                          size={12}
                        />
                        <Text
                          style={[styles.pillText, { color: theme.mutedText }]}
                        >
                          {project.trackCount} tracks
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                ))
              : null}
          </DashboardSectionCard>

          <DashboardSectionCard
            description="Scheduled releases and promotion dates"
            title="Upcoming Releases"
          >
            {upcomingReleases.length === 0 ? (
              <Text style={[styles.empty, { color: theme.mutedText }]}>
                No upcoming releases scheduled.
              </Text>
            ) : (
              upcomingReleases.slice(0, 3).map((project) => (
                <View key={project.id} style={styles.projectItem}>
                  <Ionicons color={theme.primary} name="calendar" size={18} />
                  <Text
                    numberOfLines={1}
                    style={{
                      color: theme.text,
                      flex: 1,
                      fontSize: 14,
                      fontWeight: "700",
                    }}
                  >
                    {project.title}
                  </Text>
                  <Text style={{ color: theme.mutedText, fontSize: 12 }}>
                    {project.releaseDate}
                  </Text>
                </View>
              ))
            )}
          </DashboardSectionCard>

          <DashboardSectionCard title="Activity">
            {activities.length === 0 ? (
              <Text style={[styles.empty, { color: theme.mutedText }]}>
                No activity yet. Upload tracks or create projects to build your
                log.
              </Text>
            ) : (
              <View style={{ paddingBottom: 8, paddingHorizontal: 14 }}>
                {activities.map((activity) => (
                  <View key={activity.id} style={styles.activityItem}>
                    <View
                      style={[
                        styles.activityDot,
                        {
                          backgroundColor:
                            activity.kind === "track"
                              ? theme.primary
                              : "#10B981",
                        },
                      ]}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.activityTitle,
                          { color: theme.mutedText },
                        ]}
                      >
                        <Text style={{ color: theme.text, fontWeight: "700" }}>
                          You{" "}
                        </Text>
                        {activity.label}{" "}
                        <Text
                          style={{ color: theme.primary, fontWeight: "700" }}
                        >
                          {activity.title}
                        </Text>
                      </Text>
                      <Text
                        style={[
                          styles.activityWhen,
                          { color: theme.mutedText },
                        ]}
                      >
                        {relativeDate(activity.updatedAt)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </DashboardSectionCard>

          <View
            style={[
              styles.signInCard,
              {
                backgroundColor: isPremium ? theme.primary : theme.card,
                borderColor: theme.border,
                opacity: 1,
              },
            ]}
          >
            <View
              style={{ alignItems: "center", flexDirection: "row", gap: 8 }}
            >
              <Ionicons color={theme.primary} name="ribbon" size={18} />
              <Text style={[styles.title, { color: theme.text }]}>
                {isPremium ? "Premium Active" : "Pro Artist Tip"}
              </Text>
            </View>
            <Text style={[styles.signInText, { color: theme.mutedText }]}>
              {isPremium
                ? `${entitlementsQuery.data?.activePlanCode?.replaceAll("_", " ") ?? "Premium"} is active on this account. Your premium artist tools are available across live, video, and release workflows.`
                : "Verified music videos get more engagement from the global SoundKit community. Upgrade when you are ready to unlock premium artist workflows."}
            </Text>
          </View>
        </View>
      </ScrollView>
    </>
  );
}

function BioLinkCard({
  theme,
  username,
}: {
  theme: typeof NAV_THEME.dark | typeof NAV_THEME.light;
  username: string;
}) {
  const [copied, setCopied] = useState(false),
    bioUrl = `https://soundkit.bio/${encodeURIComponent(username)}`,
    copyBioLink = async () => {
      await Clipboard.setStringAsync(bioUrl);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    };

  return (
    <DashboardSectionCard
      description="Paste this link in your Instagram, TikTok, and X profiles."
      title="Your Official Bio Link"
    >
      <View style={{ gap: 10, paddingBottom: 14, paddingHorizontal: 14 }}>
        <Pressable
          onPress={() => {
            void copyBioLink();
          }}
          style={({ pressed }) => [
            styles.cta,
            {
              backgroundColor: theme.muted,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Ionicons
            color={theme.primary}
            name={copied ? "checkmark" : "copy"}
            size={14}
          />
          <Text
            numberOfLines={1}
            style={{ color: theme.primary, flex: 1, fontSize: 12 }}
          >
            {bioUrl}
          </Text>
          <Text style={{ color: theme.text, fontSize: 12, fontWeight: "700" }}>
            {copied ? "Copied" : "Copy"}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            void Share.share({
              message: `My SoundKit bio: ${bioUrl}`,
              url: bioUrl,
            });
          }}
          style={({ pressed }) => [
            styles.cta,
            {
              alignSelf: "flex-start",
              borderColor: theme.primary,
              borderWidth: 1,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Ionicons color={theme.primary} name="share-social" size={14} />
          <Text style={[styles.ctaText, { color: theme.primary }]}>
            Share Link
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            void Linking.openURL(bioUrl);
          }}
        >
          <Text
            style={{ color: theme.primary, fontSize: 12, fontWeight: "700" }}
          >
            View your Bio link ↗
          </Text>
        </Pressable>
      </View>
    </DashboardSectionCard>
  );
}
