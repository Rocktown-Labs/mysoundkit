/* oxlint-disable one-var, sort-vars, sort-keys */
/* eslint-disable one-var, sort-vars, sort-keys */
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Container } from "@/components/container";
import { FramelessCard } from "@/components/dashboard/frameless-card";
import { DashboardJumpModal } from "@/components/dashboard/jump-modal";
import type { DashboardJumpItem } from "@/components/dashboard/jump-modal";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import type { DashboardStat } from "@/components/dashboard/stats-grid";
import { DashboardTopBar } from "@/components/dashboard/top-bar";
import { NativeRail } from "@/components/native-rail";
import { NativeSection } from "@/components/native-section";
import { authClient } from "@/lib/auth-client";
import { NAV_THEME } from "@/lib/constants";
import {
  useDashboardProjectsQuery,
  useDashboardTracksQuery,
  useDashboardVideosQuery,
  useOpenVersesInfiniteQuery,
} from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

const MUSIC_ITEMS: DashboardJumpItem[] = [
  {
    description: "Songs, masters, metadata, and files",
    href: "/dashboard/music/tracks",
    icon: "musical-notes",
    title: "Tracks",
  },
  {
    description: "Albums, EPs, mixtapes, and bundles",
    href: "/dashboard/music/projects",
    icon: "albums",
    title: "Projects",
  },
  {
    description: "Music videos and visual releases",
    href: "/dashboard/music/videos",
    icon: "videocam",
    title: "Videos",
  },
  {
    description: "Open verse listings and submissions",
    href: "/dashboard/music/open-verses",
    icon: "mic",
    title: "Open Verses",
  },
  {
    description: "Messages from artists, fans, and collaborators",
    href: "/dashboard/messages",
    icon: "chatbubble-ellipses",
    title: "Messages",
  },
  {
    description: "Followers, friends, and artist relationships",
    href: "/dashboard/music/network",
    icon: "person-add",
    title: "Network",
  },
  {
    description: "Community posts, fan movement, and updates",
    href: "/dashboard/music/community",
    icon: "people",
    title: "Community",
  },
];

export default function MusicOverviewScreen() {
  const { colorScheme } = useColorScheme(),
    { data: session } = authClient.useSession(),
    signedIn = Boolean(session?.user),
    [jumpModalVisible, setJumpModalVisible] = useState(false),
    openVerses = useOpenVersesInfiniteQuery(signedIn, { limit: "10" }),
    projects = useDashboardProjectsQuery(signedIn),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    tracks = useDashboardTracksQuery(signedIn),
    videos = useDashboardVideosQuery(signedIn),
    trackItems = tracks.data ?? [],
    projectItems = projects.data ?? [],
    videoItems = videos.data ?? [],
    openVerseItems = openVerses.data?.pages[0]?.items ?? [],
    stats: DashboardStat[] = [
      {
        description: "Masters & stems",
        icon: "musical-notes",
        title: "Tracks",
        value: trackItems.length.toString(),
      },
      {
        description: "Albums & EPs",
        icon: "albums",
        title: "Projects",
        value: projectItems.length.toString(),
      },
      {
        description: "Music visuals",
        icon: "videocam",
        title: "Videos",
        value: videoItems.length.toString(),
      },
    ];

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
          subtitle="Catalog releases, audio masters, and official visuals."
          title="Music"
        />

        {/* 3 Condensed Stat Cards */}
        <StatsGrid stats={stats} />

        {/* Quick Action Pills */}
        <View style={styles.quickActionsRow}>
          <Pressable
            onPress={() => {
              router.push("/dashboard/music/tracks/new" as never);
            }}
            style={({ pressed }) => [
              styles.quickActionPill,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Ionicons color={theme.primary} name="musical-notes" size={13} />
            <Text style={[styles.quickActionText, { color: theme.text }]}>
              + Track
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              router.push("/dashboard/music/projects/new" as never);
            }}
            style={({ pressed }) => [
              styles.quickActionPill,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Ionicons color={theme.primary} name="albums" size={13} />
            <Text style={[styles.quickActionText, { color: theme.text }]}>
              + Project
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              router.push("/dashboard/music/videos/new" as never);
            }}
            style={({ pressed }) => [
              styles.quickActionPill,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Ionicons color={theme.primary} name="videocam" size={13} />
            <Text style={[styles.quickActionText, { color: theme.text }]}>
              + Video
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              router.push("/dashboard/music/open-verses" as never);
            }}
            style={({ pressed }) => [
              styles.quickActionPill,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Ionicons color={theme.primary} name="mic" size={13} />
            <Text style={[styles.quickActionText, { color: theme.text }]}>
              + Verse
            </Text>
          </Pressable>
        </View>

        <View style={styles.sections}>
          {/* Tracks Section */}
          <NativeSection
            description="Songs, masters, and metadata"
            title="Tracks"
            viewAllHref="/dashboard/music/tracks"
          >
            <NativeRail>
              {trackItems.slice(0, 10).map((track) => (
                <FramelessCard
                  href={`/tracks/${track.id}`}
                  image={track.coverArtUrl}
                  key={track.id}
                  subtitle={
                    track.plays
                      ? `${track.plays.toLocaleString()} plays`
                      : undefined
                  }
                  title={track.title}
                  width={124}
                />
              ))}
              {trackItems.length === 0 ? (
                <View style={[styles.emptyBox, { borderColor: theme.border }]}>
                  <Text style={[styles.emptyText, { color: theme.mutedText }]}>
                    No tracks in your catalog yet.
                  </Text>
                </View>
              ) : null}
            </NativeRail>
          </NativeSection>

          {/* Projects Section */}
          <NativeSection
            description="Albums, EPs, mixtapes, and bundles"
            title="Projects"
            viewAllHref="/dashboard/music/projects"
          >
            <NativeRail>
              {projectItems.slice(0, 10).map((project) => (
                <FramelessCard
                  href={`/projects/${project.slug || project.id}`}
                  image={project.coverArtUrl}
                  key={project.id}
                  subtitle={
                    project.trackCount
                      ? `${project.trackCount} tracks`
                      : undefined
                  }
                  title={project.title}
                  width={124}
                />
              ))}
              {projectItems.length === 0 ? (
                <View style={[styles.emptyBox, { borderColor: theme.border }]}>
                  <Text style={[styles.emptyText, { color: theme.mutedText }]}>
                    No albums or EPs released yet.
                  </Text>
                </View>
              ) : null}
            </NativeRail>
          </NativeSection>

          {/* Videos Section */}
          <NativeSection
            description="Music videos and visual releases"
            title="Videos"
            viewAllHref="/dashboard/music/videos"
          >
            <NativeRail>
              {videoItems.slice(0, 10).map((video) => (
                <FramelessCard
                  aspectRatio={16 / 9}
                  href={`/videos/${video.id}`}
                  image={video.thumbnailUrl}
                  key={video.id}
                  title={video.title}
                  width={180}
                />
              ))}
              {videoItems.length === 0 ? (
                <View style={[styles.emptyBox, { borderColor: theme.border }]}>
                  <Text style={[styles.emptyText, { color: theme.mutedText }]}>
                    No videos uploaded yet.
                  </Text>
                </View>
              ) : null}
            </NativeRail>
          </NativeSection>

          {/* Open Verses Section */}
          <NativeSection
            description="Open verse listings and submissions"
            title="Open Verses"
            viewAllHref="/dashboard/music/open-verses"
          >
            <NativeRail>
              {openVerseItems.slice(0, 10).map((listing) => (
                <FramelessCard
                  href="/dashboard/music/open-verses"
                  image={listing.coverArtUrl}
                  key={listing.id}
                  title={listing.title}
                  width={124}
                />
              ))}
              {openVerseItems.length === 0 ? (
                <View style={[styles.emptyBox, { borderColor: theme.border }]}>
                  <Text style={[styles.emptyText, { color: theme.mutedText }]}>
                    No active open verses.
                  </Text>
                </View>
              ) : null}
            </NativeRail>
          </NativeSection>
        </View>
      </ScrollView>

      {/* Jump Menu Modal */}
      <DashboardJumpModal
        items={MUSIC_ITEMS}
        onClose={() => setJumpModalVisible(false)}
        subtitle="Quick access to all catalog destinations"
        title="Music Catalog"
        visible={jumpModalVisible}
      />
    </Container>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 64,
  },
  emptyBox: {
    borderRadius: 12,
    borderStyle: "dashed",
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  emptyText: {
    fontSize: 13,
  },
  iconBadge: {
    alignItems: "center",
    borderRadius: 10,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  menuDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  menuGrid: {
    gap: 8,
  },
  menuItem: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  sections: {
    gap: 28,
  },
  quickActionPill: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 4,
    justifyContent: "center",
    paddingVertical: 9,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: "700",
  },
  quickActionsRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 20,
    marginTop: 16,
  },
});
