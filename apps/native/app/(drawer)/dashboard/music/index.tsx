/* eslint-disable sort-vars */
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Container } from "@/components/container";
import { FramelessCard } from "@/components/dashboard/frameless-card";
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

const MUSIC_ITEMS = [
    {
      description: "Songs, masters, metadata, and files",
      href: "/dashboard/music/tracks",
      icon: "musical-notes" as const,
      title: "Tracks",
    },
    {
      description: "Albums, EPs, mixtapes, and bundles",
      href: "/dashboard/music/projects",
      icon: "albums" as const,
      title: "Projects",
    },
    {
      description: "Music videos and visual releases",
      href: "/dashboard/music/videos",
      icon: "videocam" as const,
      title: "Videos",
    },
    {
      description: "Open verse listings and submissions",
      href: "/dashboard/music/open-verses",
      icon: "mic" as const,
      title: "Open Verses",
    },
    {
      description: "Messages from artists, fans, and collaborators",
      href: "/dashboard/music/messages",
      icon: "chatbubble-ellipses" as const,
      title: "Messages",
    },
    {
      description: "Followers, friends, and artist relationships",
      href: "/dashboard/music/network",
      icon: "person-add" as const,
      title: "Network",
    },
    {
      description: "Community posts, fan movement, and updates",
      href: "/dashboard/music/community",
      icon: "people" as const,
      title: "Community",
    },
  ],
  styles = StyleSheet.create({
    cta: {
      alignSelf: "flex-start",
      borderRadius: 12,
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    ctaText: { fontSize: 13, fontWeight: "700" },
    menuGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    menuItem: {
      alignItems: "center",
      borderRadius: 14,
      borderWidth: 1,
      flexBasis: "48%",
      flexDirection: "row",
      flexGrow: 1,
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    menuTitle: { fontSize: 13, fontWeight: "700" },
    screenTitle: {
      fontSize: 30,
      fontWeight: "800",
      letterSpacing: -0.6,
      marginBottom: 4,
    },
    sections: { gap: 24 },
    subtitle: { fontSize: 14, marginBottom: 16 },
  });

export default function MusicOverviewScreen() {
  const { colorScheme } = useColorScheme(),
    { data: session } = authClient.useSession(),
    signedIn = Boolean(session?.user),
    openVerses = useOpenVersesInfiniteQuery(signedIn, { limit: "10" }),
    projects = useDashboardProjectsQuery(signedIn),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    tracks = useDashboardTracksQuery(signedIn),
    videos = useDashboardVideosQuery(signedIn);

  return (
    <Container>
      <View style={{ flex: 1, padding: 20 }}>
        <Text style={[styles.screenTitle, { color: theme.text }]}>Music</Text>
        <Text style={[styles.subtitle, { color: theme.mutedText }]}>
          Your catalog: tracks, projects, videos, and collaborations.
        </Text>
        <Pressable
          onPress={() => {
            router.push("/dashboard/music/tracks/new" as never);
          }}
          style={({ pressed }) => [
            styles.cta,
            {
              backgroundColor: theme.primary,
              marginBottom: 20,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Ionicons color={theme.primaryForeground} name="add" size={16} />
          <Text style={[styles.ctaText, { color: theme.primaryForeground }]}>
            New Track
          </Text>
        </Pressable>

        <View style={styles.sections}>
          <NativeSection
            description="Songs, masters, and metadata"
            title="Tracks"
            viewAllHref="/dashboard/music/tracks"
          >
            <NativeRail>
              {(tracks.data ?? []).slice(0, 8).map((track) => (
                <FramelessCard
                  href={`/tracks/${track.id}`}
                  image={track.coverArtUrl}
                  key={track.id}
                  title={track.title}
                />
              ))}
              {(tracks.data ?? []).length === 0 ? (
                <Text style={{ color: theme.mutedText, fontSize: 13 }}>
                  No tracks yet.
                </Text>
              ) : null}
            </NativeRail>
          </NativeSection>

          <NativeSection
            description="Albums, EPs, mixtapes, and bundles"
            title="Projects"
            viewAllHref="/dashboard/music/projects"
          >
            <NativeRail>
              {(projects.data ?? []).slice(0, 8).map((project) => (
                <FramelessCard
                  href={`/projects/${project.slug || project.id}`}
                  image={project.coverArtUrl}
                  key={project.id}
                  title={project.title}
                />
              ))}
              {(projects.data ?? []).length === 0 ? (
                <Text style={{ color: theme.mutedText, fontSize: 13 }}>
                  No projects yet.
                </Text>
              ) : null}
            </NativeRail>
          </NativeSection>

          <NativeSection
            description="Music videos and visual releases"
            title="Videos"
            viewAllHref="/dashboard/music/videos"
          >
            <NativeRail>
              {(videos.data ?? []).slice(0, 8).map((video) => (
                <FramelessCard
                  href={`/videos/${video.id}`}
                  image={video.thumbnailUrl}
                  key={video.id}
                  title={video.title}
                  width={180}
                />
              ))}
              {(videos.data ?? []).length === 0 ? (
                <Text style={{ color: theme.mutedText, fontSize: 13 }}>
                  No videos yet.
                </Text>
              ) : null}
            </NativeRail>
          </NativeSection>

          <NativeSection
            description="Open verse listings and submissions"
            title="Open Verses"
            viewAllHref="/dashboard/music/open-verses"
          >
            <NativeRail>
              {(openVerses.data?.pages[0]?.items ?? [])
                .slice(0, 8)
                .map((listing) => (
                  <FramelessCard
                    href="/dashboard/music/open-verses"
                    image={listing.coverArtUrl}
                    key={listing.id}
                    title={listing.title}
                  />
                ))}
              {(openVerses.data?.pages[0]?.items ?? []).length === 0 ? (
                <Text style={{ color: theme.mutedText, fontSize: 13 }}>
                  No open verses yet.
                </Text>
              ) : null}
            </NativeRail>
          </NativeSection>

          <NativeSection title="Browse">
            <View style={styles.menuGrid}>
              {MUSIC_ITEMS.map((item) => (
                <Pressable
                  key={item.title}
                  onPress={() => {
                    router.push(item.href as never);
                  }}
                  style={({ pressed }) => [
                    styles.menuItem,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.border,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Ionicons color={theme.primary} name={item.icon} size={18} />
                  <Text
                    numberOfLines={1}
                    style={[styles.menuTitle, { color: theme.text }]}
                  >
                    {item.title}
                  </Text>
                </Pressable>
              ))}
            </View>
          </NativeSection>
        </View>
      </View>
    </Container>
  );
}
