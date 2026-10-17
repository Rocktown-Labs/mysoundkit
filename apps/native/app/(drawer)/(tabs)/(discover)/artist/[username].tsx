/* oxlint-disable one-var, sort-vars, sort-keys, no-nested-ternary, complexity, eqeqeq, no-eq-null, react-hooks/set-state-in-render */
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, Link as ExpoLink, Stack } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { ProjectCard } from "@/components/cards/project-card";
import { TrackCard } from "@/components/cards/track-card";
import { VideoCard } from "@/components/cards/video-card";
import { Container } from "@/components/container";
import { LiquidGlassView } from "@/components/liquid-glass";
import { NativeEmptyState } from "@/components/native-collection-grid";
import { NativeImage } from "@/components/native-image";
import { NativeRail } from "@/components/native-rail";
import { NativeSection } from "@/components/native-section";
import { NAV_THEME } from "@/lib/constants";
import { useArtistMediaQuery, useArtistQuery } from "@/lib/soundkit-api";
import type { ArtistDetail, ArtistMedia } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

type ProfileTab = "credits" | "feed" | "projects" | "tracks" | "videos";

const TABS: { id: ProfileTab; label: string }[] = [
    { id: "feed", label: "Feed" },
    { id: "tracks", label: "Tracks" },
    { id: "projects", label: "Projects" },
    { id: "videos", label: "Videos" },
    { id: "credits", label: "Credits" },
  ],
  FEED_TRACKS_PREVIEW = 6,
  FEED_RAIL_PREVIEW = 6,
  STATS_SPRING = { dampingRatio: 0.85, duration: 250 };

const hasLinkUrl = <T extends { url?: string }>(
  link: T
): link is T & { url: string } => Boolean(link.url);

export default function ArtistDetailScreen() {
  const { username, tab } = useLocalSearchParams<{
      username: string;
      tab?: string;
    }>(),
    cleanUsername = (username ?? "").replace(/^@/u, ""),
    { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    artist = useArtistQuery(cleanUsername),
    media = useArtistMediaQuery(cleanUsername),
    [activeTab, setActiveTab] = useState<ProfileTab>(
      TABS.some((t) => t.id === tab) ? (tab as ProfileTab) : "feed"
    ),
    [followOverride, setFollowOverride] = useState<boolean | null>(null),
    { data } = artist,
    mediaData = media.data,
    // Server-seeded follow state with a local optimistic override (no effect
    // sync — the override wins until the server value changes identities).
    isFollowing = followOverride ?? Boolean(data?.isFollowing);

  if (artist.isLoading) {
    return (
      <>
        <Stack.Screen
          options={{
            headerBackTitle: "Back",
            headerShown: true,
            headerStyle: { backgroundColor: theme.background },
            headerTintColor: theme.text,
            headerTransparent: false,
            title: "Artist",
          }}
        />
        <Container>
          <ActivityIndicator color={theme.primary} style={styles.loaderWrap} />
        </Container>
      </>
    );
  }

  if (data == null) {
    return (
      <>
        <Stack.Screen
          options={{
            headerBackTitle: "Back",
            headerShown: true,
            headerStyle: { backgroundColor: theme.background },
            headerTintColor: theme.text,
            headerTransparent: false,
            title: "Artist Not Found",
          }}
        />
        <Container>
          <NativeEmptyState>
            We couldn&apos;t find an artist with that username.
          </NativeEmptyState>
        </Container>
      </>
    );
  }

  const cleanRank = data.rank ? String(data.rank).replace(/^#+/u, "") : "",
    stats = [
      { label: "Tracks", value: (data.trackCount ?? 0).toLocaleString() },
      { label: "Followers", value: (data.followers ?? 0).toLocaleString() },
      { label: "Rank", value: cleanRank ? `#${cleanRank}` : "—" },
      { label: "Listeners", value: (data.weeklyPlays ?? 0).toLocaleString() },
    ];

  return (
    <>
      <Stack.Screen
        options={{
          headerBackTitle: "Back",
          headerShown: true,
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerTransparent: false,
          title: data.name,
        }}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: theme.background, flex: 1 }}
      >
        <ArtistHero artist={data} />

        <ProfileCard
          artist={data}
          isFollowing={isFollowing}
          onFollowToggle={() => {
            setFollowOverride(!isFollowing);
          }}
          stats={stats}
        />

        <ArtistTabs
          activeTab={activeTab}
          onSelect={setActiveTab}
          themeText={theme.text}
        />
        <View style={styles.tabBody}>
          {activeTab === "feed" ? (
            <ArtistFeed media={mediaData} onSelectTab={setActiveTab} />
          ) : null}
          {activeTab === "tracks" ? (
            <ArtistTracksGrid tracks={mediaData?.tracks ?? []} />
          ) : null}
          {activeTab === "projects" ? (
            <ArtistProjectsGrid projects={mediaData?.projects ?? []} />
          ) : null}
          {activeTab === "videos" ? (
            <ArtistVideosGrid videos={mediaData?.videos ?? []} />
          ) : null}
          {activeTab === "credits" ? (
            <ArtistCredits credits={mediaData?.credits ?? []} />
          ) : null}
        </View>
      </ScrollView>
    </>
  );
}

/** Hero cover with a gradient into the page background. */
function ArtistHero({ artist }: { artist: ArtistDetail }) {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;

  return (
    <View style={styles.heroWrap}>
      <View style={[styles.hero, { backgroundColor: theme.muted }]}>
        {artist.coverImageUrl ? (
          <NativeImage
            source={artist.coverImageUrl}
            contentFit="cover"
            style={styles.heroImage}
          />
        ) : (
          <View style={styles.heroFallback}>
            <Ionicons
              color={theme.primary}
              name="color-palette-outline"
              size={44}
            />
          </View>
        )}
        <View
          style={[
            styles.heroGradient,
            { backgroundColor: theme.background },
            { bottom: -1 },
          ]}
        />
      </View>
    </View>
  );
}

/** Overlapping translucent profile card with identity, stats, and links. */
function ProfileCard({
  artist,
  isFollowing,
  onFollowToggle,
  stats,
}: {
  artist: ArtistDetail;
  isFollowing: boolean;
  onFollowToggle: () => void;
  stats: { label: string; value: string }[];
}) {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    followScale = useSharedValue(1),
    followSpringStyle = useAnimatedStyle(() => ({
      transform: [{ scale: followScale.get() }],
    })),
    joinedLabel = useMemo(() => {
      if (!artist.joinedAt) {
        return null;
      }
      const date = new Date(artist.joinedAt);
      return Number.isNaN(date.getTime())
        ? null
        : `Joined ${date.toLocaleDateString(undefined, {
            month: "long",
            year: "numeric",
          })}`;
    }, [artist.joinedAt]);

  const listenLinks = (
      [
        { icon: "musical-notes", label: "Spotify", url: artist.links?.spotify },
        { icon: "logo-apple", label: "Apple Music", url: artist.links?.apple },
        { icon: "logo-youtube", label: "YouTube", url: artist.links?.youtube },
      ] as const
    ).filter(hasLinkUrl),
    followLinks = (
      [
        {
          icon: "logo-instagram",
          label: "Instagram",
          url: artist.links?.instagram,
        },
        { icon: "logo-tiktok", label: "TikTok", url: artist.links?.tiktok },
        { icon: "logo-twitter", label: "X", url: artist.links?.twitter },
        {
          icon: "logo-soundcloud",
          label: "SoundCloud",
          url: artist.links?.soundcloud,
        },
        {
          icon: "globe-outline",
          label: "Website",
          url: artist.links?.personalSite,
        },
      ] as const
    ).filter(hasLinkUrl);

  return (
    <LiquidGlassView
      borderRadius={22}
      style={styles.profileCard}
      variant="card"
    >
      <View style={styles.identityRow}>
        <View style={styles.avatarWrap}>
          <NativeImage
            source={artist.avatarUrl ?? undefined}
            style={styles.avatarImage}
          />
          {artist.verified ? (
            <View style={styles.verifiedBadge}>
              <Ionicons color="#FFFFFF" name="checkmark" size={14} />
            </View>
          ) : null}
        </View>
        <View style={styles.identityText}>
          <Text style={styles.name}>{artist.name}</Text>
          <Text style={styles.handle}>@{artist.username}</Text>
          {artist.genre ? (
            <View style={styles.genrePill}>
              <Text style={styles.genrePillText}>{artist.genre}</Text>
            </View>
          ) : null}
        </View>
        <Pressable
          accessibilityHint={
            isFollowing ? "Unfollows artist" : "Follows artist"
          }
          accessibilityLabel={isFollowing ? "Following" : "Follow"}
          accessibilityRole="button"
          onPressIn={() => {
            followScale.set(
              withSpring(0.96, { dampingRatio: 0.8, duration: 120 })
            );
          }}
          onPressOut={() => {
            followScale.set(withSpring(1, STATS_SPRING));
          }}
          onPress={onFollowToggle}
          style={styles.followButtonSlot}
        >
          <Animated.View
            style={[
              styles.followButton,
              {
                backgroundColor: isFollowing
                  ? "rgba(184, 163, 255, 0.16)"
                  : theme.primary,
              },
              followSpringStyle,
            ]}
          >
            <Text
              style={[
                styles.followButtonText,
                {
                  color: isFollowing ? theme.primary : theme.primaryForeground,
                },
              ]}
            >
              {isFollowing ? "Following" : "Follow"}
            </Text>
          </Animated.View>
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        {stats.map((stat) => (
          <View key={stat.label} style={styles.statChip}>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {artist.bio ? <Text style={styles.bio}>{artist.bio}</Text> : null}

      <View style={styles.metaRow}>
        {artist.location ? (
          <View style={styles.metaItem}>
            <Ionicons color="#8F8F8F" name="location-sharp" size={13} />
            <Text style={styles.metaText}>{artist.location}</Text>
          </View>
        ) : null}
        {joinedLabel ? (
          <View style={styles.metaItem}>
            <Ionicons color="#8F8F8F" name="calendar-outline" size={13} />
            <Text style={styles.metaText}>{joinedLabel}</Text>
          </View>
        ) : null}
        {artist.battleCount ? (
          <View style={styles.metaItem}>
            <Ionicons color="#8F8F8F" name="flash-outline" size={13} />
            <Text style={styles.metaText}>{artist.battleCount} battles</Text>
          </View>
        ) : null}
      </View>

      {listenLinks.length > 0 ? (
        <LinkRow icon="headset-outline" label="Listen On" links={listenLinks} />
      ) : null}
      {followLinks.length > 0 ? (
        <LinkRow
          icon="person-add-outline"
          label="Follow On"
          links={followLinks}
        />
      ) : null}
    </LiquidGlassView>
  );
}

function LinkRow({
  icon,
  label,
  links,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  links: readonly {
    icon:
      | "globe-outline"
      | "logo-apple"
      | "logo-instagram"
      | "logo-soundcloud"
      | "logo-tiktok"
      | "logo-twitter"
      | "logo-youtube"
      | "musical-notes";
    label: string;
    url: string;
  }[];
}) {
  return (
    <View style={styles.linkRow}>
      <Ionicons color="#8F8F8F" name={icon} size={14} />
      <Text style={styles.linkLabel}>{label}</Text>
      <View style={styles.linkButtons}>
        {links.map((link) => (
          <Pressable
            accessibilityLabel={link.label}
            accessibilityRole="button"
            hitSlop={6}
            key={link.label}
            onPress={() => {
              void Linking.openURL(link.url);
            }}
            style={({ pressed }) => [
              styles.linkButton,
              pressed && styles.linkButtonPressed,
            ]}
          >
            <Ionicons color="#F8F8F8" name={link.icon} size={17} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Underline tab strip, horizontally scrollable like the web artist page.
 * Static underline placement only — tab switches are a high-frequency
 * interaction, so there is no transition here (per the motion gate). */
function ArtistTabs({
  activeTab,
  onSelect,
  themeText,
}: {
  activeTab: ProfileTab;
  onSelect: (tab: ProfileTab) => void;
  themeText: string;
}) {
  return (
    <ScrollView
      contentContainerStyle={styles.tabsContent}
      horizontal
      showsHorizontalScrollIndicator={false}
    >
      {TABS.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <Pressable
            accessibilityLabel={`${tab.label} tab`}
            accessibilityRole="tab"
            key={tab.id}
            onPress={() => {
              onSelect(tab.id);
            }}
            style={({ pressed }) => [
              styles.tabItem,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text
              style={[
                styles.tabLabel,
                isActive ? { color: themeText } : { color: "#8F8F8F" },
              ]}
            >
              {tab.label}
            </Text>
            <View
              style={[
                styles.tabUnderline,
                { backgroundColor: isActive ? "#B8A3FF" : "transparent" },
              ]}
            />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function ArtistFeed({
  media,
  onSelectTab,
}: {
  media?: ArtistMedia;
  onSelectTab: (tab: ProfileTab) => void;
}) {
  const tracks = media?.tracks ?? [],
    projects = media?.projects ?? [],
    videos = media?.videos ?? [],
    featured = media?.featuredTracks ?? [];

  return (
    <View style={styles.feedGap}>
      {tracks.length > 0 ? (
        <NativeSection
          onViewAllPress={() => {
            onSelectTab("tracks");
          }}
          title="Tracks"
        >
          <NativeRail>
            {tracks.slice(0, FEED_TRACKS_PREVIEW).map((track) => (
              <TrackCard compact key={track.id} track={track} />
            ))}
          </NativeRail>
        </NativeSection>
      ) : null}

      {projects.length > 0 ? (
        <NativeSection
          onViewAllPress={() => {
            onSelectTab("projects");
          }}
          title="Projects"
        >
          <NativeRail>
            {projects.slice(0, FEED_RAIL_PREVIEW).map((project) => (
              <ProjectCard compact key={project.id} project={project} />
            ))}
          </NativeRail>
        </NativeSection>
      ) : null}

      {videos.length > 0 ? (
        <NativeSection
          onViewAllPress={() => {
            onSelectTab("videos");
          }}
          title="Videos"
        >
          <NativeRail>
            {videos.slice(0, FEED_RAIL_PREVIEW).map((video) => (
              <VideoCard compact key={video.id} video={video} />
            ))}
          </NativeRail>
        </NativeSection>
      ) : null}

      {featured.length > 0 ? (
        <NativeSection
          description="Appears on releases from other artists."
          title="Also Featured On"
        >
          <NativeRail>
            {featured.map((track) => (
              <TrackCard compact key={track.id} track={track} />
            ))}
          </NativeRail>
        </NativeSection>
      ) : null}

      {tracks.length === 0 && projects.length === 0 && videos.length === 0 ? (
        <NativeEmptyState>Nothing published yet.</NativeEmptyState>
      ) : null}
    </View>
  );
}

function ArtistTracksGrid({ tracks }: { tracks: ArtistMedia["tracks"] }) {
  if (tracks.length === 0) {
    return <NativeEmptyState>No public tracks yet.</NativeEmptyState>;
  }
  return (
    <View style={styles.tripleGrid}>
      {tracks.map((track) => (
        <TrackCard key={track.id} track={track} />
      ))}
    </View>
  );
}

function ArtistProjectsGrid({
  projects,
}: {
  projects: ArtistMedia["projects"];
}) {
  if (projects.length === 0) {
    return <NativeEmptyState>No projects yet.</NativeEmptyState>;
  }
  return (
    <View style={styles.tripleGrid}>
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </View>
  );
}

function ArtistVideosGrid({ videos }: { videos: ArtistMedia["videos"] }) {
  if (videos.length === 0) {
    return <NativeEmptyState>No videos yet.</NativeEmptyState>;
  }
  return (
    <View style={styles.tripleGrid}>
      {videos.map((video) => (
        <VideoCard key={video.id} video={video} />
      ))}
    </View>
  );
}

const CREDIT_GROUPS: {
  icon: keyof typeof Ionicons.glyphMap;
  roles: ("engineer" | "producer" | "songwriter")[];
  title: string;
}[] = [
  { icon: "flash-outline", roles: ["producer"], title: "Production" },
  { icon: "create-outline", roles: ["songwriter"], title: "Songwriting" },
  { icon: "settings-outline", roles: ["engineer"], title: "Engineering" },
];

function ArtistCredits({ credits }: { credits: ArtistMedia["credits"] }) {
  if (credits.length === 0) {
    return <NativeEmptyState>No credits yet.</NativeEmptyState>;
  }

  return (
    <View style={styles.feedGap}>
      {CREDIT_GROUPS.map((group) => {
        const groupCredits = credits.filter((credit) =>
          group.roles.includes(credit.role)
        );
        if (groupCredits.length === 0) {
          return null;
        }
        return (
          <NativeSection key={group.title} title={group.title}>
            <View style={styles.creditList}>
              {groupCredits.map((credit) => (
                <ExpoLink
                  asChild
                  href={
                    credit.contentType === "track"
                      ? `/tracks/${credit.contentId}`
                      : `/projects/${credit.contentId}`
                  }
                  key={`${credit.role}-${credit.contentId}`}
                >
                  <Pressable
                    style={({ pressed }) => [
                      styles.creditRow,
                      pressed && styles.creditRowPressed,
                    ]}
                  >
                    <View style={styles.creditThumb}>
                      <NativeImage
                        source={credit.coverArtUrl ?? undefined}
                        style={{ height: "100%", width: "100%" }}
                      />
                    </View>
                    <View style={styles.creditCopy}>
                      <Text style={styles.creditTitle}>{credit.title}</Text>
                      <Text style={styles.creditSubtitle}>
                        {credit.ownerName}
                      </Text>
                    </View>
                    <View style={styles.creditRolePill}>
                      <Ionicons color="#B8A3FF" name={group.icon} size={12} />
                    </View>
                  </Pressable>
                </ExpoLink>
              ))}
            </View>
          </NativeSection>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  avatarImage: {
    backgroundColor: "#0B0B0B",
    borderRadius: 24,
    height: "100%",
    width: "100%",
  },
  avatarWrap: {
    borderRadius: 25,
    height: 88,
    width: 88,
  },
  bio: {
    color: "#F8F8F8",
    fontSize: 14,
    lineHeight: 20,
  },
  content: {
    paddingBottom: 48,
  },
  creditCopy: { flex: 1, gap: 2 },
  creditList: { gap: 8 },
  creditRolePill: {
    alignItems: "center",
    backgroundColor: "rgba(184, 163, 255, 0.14)",
    borderRadius: 999,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  creditRow: {
    alignItems: "center",
    backgroundColor: "#060606",
    borderColor: "#212121",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  creditRowPressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
  creditSubtitle: { color: "#8F8F8F", fontSize: 12 },
  creditThumb: {
    backgroundColor: "#111111",
    borderRadius: 10,
    height: 44,
    overflow: "hidden",
    width: 44,
  },
  creditTitle: { color: "#F8F8F8", fontSize: 14, fontWeight: "700" },
  feedGap: { gap: 26 },
  followButton: {
    alignItems: "center",
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  followButtonSlot: { alignSelf: "center" },
  followButtonText: { fontSize: 13, fontWeight: "800" },
  genrePill: {
    alignSelf: "center",
    backgroundColor: "rgba(184, 163, 255, 0.14)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  genrePillText: {
    color: "#B8A3FF",
    fontSize: 11,
    fontWeight: "700",
  },
  handle: { color: "#8F8F8F", fontSize: 13 },
  hero: { height: 140, width: "100%" },
  heroFallback: {
    alignItems: "center",
    height: "100%",
    justifyContent: "center",
    width: "100%",
  },
  heroGradient: {
    height: 56,
    opacity: 0.9,
    position: "absolute",
    width: "100%",
  },
  heroWrap: { backgroundColor: "#020202" },
  heroImage: { height: "100%", width: "100%" },
  identityRow: {
    alignItems: "center",
    flexDirection: "column",
    gap: 14,
    width: "100%",
  },
  identityText: { alignItems: "center", gap: 3, marginTop: 4, width: "100%" },
  linkButton: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderColor: "rgba(255, 255, 255, 0.14)",
    borderRadius: 999,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  linkButtonPressed: { opacity: 0.7 },
  linkButtons: { flexDirection: "row", gap: 8 },
  linkLabel: { color: "#8F8F8F", fontSize: 12, fontWeight: "700" },
  linkRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  loaderWrap: { marginTop: 48 },
  metaItem: { alignItems: "center", flexDirection: "row", gap: 4 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  metaText: { color: "#8F8F8F", fontSize: 12 },
  name: {
    color: "#F8F8F8",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  profileCard: {
    gap: 14,
    marginHorizontal: 16,
    marginTop: -24,
    padding: 18,
  },
  statChip: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 10,
  },
  statLabel: { color: "#8F8F8F", fontSize: 11, fontWeight: "600" },
  statValue: { color: "#F8F8F8", fontSize: 15, fontWeight: "800" },
  statsRow: { flexDirection: "row", gap: 8 },
  tabBody: { marginTop: 4, paddingHorizontal: 16 },
  tabItem: {
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    position: "relative",
  },
  tabLabel: { fontSize: 14, fontWeight: "700" },
  tabUnderline: {
    alignSelf: "center",
    borderRadius: 999,
    bottom: 6,
    height: 3,
    width: 24,
  },
  tabsContent: { gap: 6, paddingHorizontal: 16 },
  tripleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  verifiedBadge: {
    alignItems: "center",
    backgroundColor: "#B8A3FF",
    borderColor: "#020202",
    borderRadius: 999,
    borderWidth: 2,
    bottom: 2,
    height: 26,
    justifyContent: "center",
    position: "absolute",
    right: -2,
    width: 26,
  },
});
