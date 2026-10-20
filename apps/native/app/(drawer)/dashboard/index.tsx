/* oxlint-disable one-var, sort-vars, complexity, react/purity */
/* eslint-disable one-var, sort-vars, complexity, react/purity */
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Container } from "@/components/container";
import { FramelessCard } from "@/components/dashboard/frameless-card";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import type { DashboardStat } from "@/components/dashboard/stats-grid";
import { NativeRail } from "@/components/native-rail";
import { NativeSection } from "@/components/native-section";
import { authClient } from "@/lib/auth-client";
import { NAV_THEME } from "@/lib/constants";
import {
  useDashboardProjectsQuery,
  useDashboardTracksQuery,
  useMeEntitlementsQuery,
  useMeQuery,
} from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

const BIO_LINK_DISMISSED_KEY = "@soundkit_bio_link_dismissed_v1";

function BioLinkCard({
  onDismiss,
  theme,
  username,
}: {
  onDismiss: () => void;
  theme: typeof NAV_THEME.dark | typeof NAV_THEME.light;
  username: string;
}) {
  const [copied, setCopied] = useState(false),
    bioUrl = `https://soundkit.bio/${encodeURIComponent(username)}`,
    copyBioLink = async () => {
      await Clipboard.setStringAsync(bioUrl);
      setCopied(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    };

  return (
    <View
      style={[
        styles.bioCard,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <View style={styles.bioHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.bioTitle, { color: theme.text }]}>
            Official Bio Link
          </Text>
          <Text style={[styles.bioSubtitle, { color: theme.mutedText }]}>
            Add this link to your Instagram, TikTok, and X bios.
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Dismiss bio link card"
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onDismiss();
          }}
          style={styles.dismissBtn}
        >
          <Ionicons color={theme.mutedText} name="close" size={16} />
        </Pressable>
      </View>

      <View style={styles.bioActionRow}>
        <Pressable
          onPress={() => {
            void copyBioLink();
          }}
          style={({ pressed }) => [
            styles.bioUrlPill,
            {
              backgroundColor: theme.background,
              borderColor: theme.border,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Ionicons
            color={theme.primary}
            name={copied ? "checkmark" : "copy-outline"}
            size={13}
          />
          <Text
            numberOfLines={1}
            style={[styles.bioUrlText, { color: theme.text }]}
          >
            {bioUrl}
          </Text>
          <Text style={[styles.bioCopyBadge, { color: theme.primary }]}>
            {copied ? "Copied" : "Copy"}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            void Share.share({
              message: `Check out my SoundKit: ${bioUrl}`,
              url: bioUrl,
            });
          }}
          style={({ pressed }) => [
            styles.bioShareBtn,
            {
              backgroundColor: theme.background,
              borderColor: theme.border,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Ionicons color={theme.text} name="share-outline" size={15} />
        </Pressable>
      </View>
    </View>
  );
}

function UpcomingCard({
  actionLabel,
  dateLabel,
  href,
  subtitle,
  title,
}: {
  actionLabel: string;
  dateLabel: string;
  href: string;
  subtitle: string;
  title: string;
}) {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;

  return (
    <Pressable
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(href as never);
      }}
      style={({ pressed }) => [
        styles.upcomingCard,
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.upcomingHeader}>
        <View
          style={[
            styles.dateBadge,
            { backgroundColor: "rgba(184, 163, 255, 0.15)" },
          ]}
        >
          <Ionicons color={theme.primary} name="calendar" size={12} />
          <Text style={[styles.dateBadgeText, { color: theme.primary }]}>
            {dateLabel}
          </Text>
        </View>
      </View>

      <Text numberOfLines={1} style={[styles.cardTitle, { color: theme.text }]}>
        {title}
      </Text>
      <Text
        numberOfLines={2}
        style={[styles.cardSubtitle, { color: theme.mutedText }]}
      >
        {subtitle}
      </Text>

      <View style={styles.actionRow}>
        <Text style={[styles.actionText, { color: theme.primary }]}>
          {actionLabel}
        </Text>
        <Ionicons color={theme.primary} name="chevron-forward" size={12} />
      </View>
    </Pressable>
  );
}

export default function DashboardHomeScreen() {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    { data: session, isPending: sessionPending } = authClient.useSession(),
    signedIn = Boolean(session?.user),
    meQuery = useMeQuery(signedIn),
    entitlementsQuery = useMeEntitlementsQuery(signedIn),
    tracksQuery = useDashboardTracksQuery(signedIn),
    projectsQuery = useDashboardProjectsQuery(signedIn),
    [bioDismissed, setBioDismissed] = useState(true),
    tracks = tracksQuery.data ?? [],
    projects = projectsQuery.data ?? [],
    user = meQuery.data?.user,
    displayName = user?.displayName ?? user?.username ?? "Artist",
    firstName = displayName.split(" ")[0] ?? displayName,
    isPremium = Boolean(entitlementsQuery.data?.isPremium),
    upcomingReleases = projects.filter(
      (project) =>
        project.releaseDate !== null &&
        project.releaseDate !== undefined &&
        new Date(project.releaseDate).getTime() >= Date.now()
    ),
    stats: DashboardStat[] = [
      {
        description: "Masters & stems",
        icon: "musical-notes",
        title: "Tracks",
        value: tracks.length.toString(),
      },
      {
        description: "Albums & EPs",
        icon: "albums",
        title: "Projects",
        value: projects.length.toString(),
      },
      {
        description: "Scheduled drops",
        icon: "calendar",
        title: "Upcoming",
        value: upcomingReleases.length.toString(),
      },
    ];

  useEffect(() => {
    async function checkDismissed() {
      const val = await AsyncStorage.getItem(BIO_LINK_DISMISSED_KEY);
      if (val !== "true") {
        setBioDismissed(false);
      }
    }
    void checkDismissed();
  }, []);

  const handleDismissBio = async () => {
    setBioDismissed(true);
    await AsyncStorage.setItem(BIO_LINK_DISMISSED_KEY, "true");
  };

  if (sessionPending) {
    return (
      <View style={{ backgroundColor: theme.background, flex: 1 }}>
        <ActivityIndicator color={theme.primary} style={{ marginTop: 80 }} />
      </View>
    );
  }

  if (!signedIn) {
    return (
      <Container>
        <View
          style={{ backgroundColor: theme.background, flex: 1, padding: 20 }}
        >
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
              Sign in with your artist account to upload music, manage releases,
              broadcast live, and view analytics.
            </Text>
            <Pressable
              onPress={() => {
                router.push("/(auth)/login" as never);
              }}
              style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
            >
              <Text
                style={[
                  styles.primaryBtnText,
                  { color: theme.primaryForeground },
                ]}
              >
                Sign In
              </Text>
            </Pressable>
          </View>
        </View>
      </Container>
    );
  }

  return (
    <Container>
      <Stack.Screen options={{ headerShown: false, title: "Dashboard" }} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: theme.background }}
      >
        {/* Welcome Header */}
        <View style={styles.headerArea}>
          <View style={styles.eyebrowRow}>
            <Text style={[styles.eyebrow, { color: theme.primary }]}>
              Artist Dashboard
            </Text>
            {isPremium ? (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: "rgba(184, 163, 255, 0.15)" },
                ]}
              >
                <Text style={[styles.badgeText, { color: theme.primary }]}>
                  Pro
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.greeting, { color: theme.text }]}>
            Welcome back, {firstName}
          </Text>
          <Text style={[styles.subtitle, { color: theme.mutedText }]}>
            Manage your catalog, scheduled releases, and live drops.
          </Text>
        </View>

        {/* 3 Condensed Stat Cards */}
        <StatsGrid stats={stats} />

        {/* Dismissible Official Bio Link Card */}
        {user?.accountType === "artist" && user.username && !bioDismissed ? (
          <BioLinkCard
            onDismiss={() => {
              void handleDismissBio();
            }}
            theme={theme}
            username={user.username}
          />
        ) : null}

        {/* Quick Actions Row */}
        <View style={styles.quickActionsRow}>
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
              Track
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
              Project
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/dashboard/live/streams" as never);
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
            <Ionicons color={theme.primary} name="radio" size={13} />
            <Text style={[styles.quickActionText, { color: theme.text }]}>
              Go Live
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/dashboard/create" as never);
            }}
            style={({ pressed }) => [
              styles.quickActionPill,
              {
                backgroundColor: theme.primary,
                borderColor: theme.primary,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Ionicons
              color={theme.primaryForeground}
              name="add-circle"
              size={13}
            />
            <Text
              style={[
                styles.quickActionText,
                { color: theme.primaryForeground },
              ]}
            >
              Create
            </Text>
          </Pressable>
        </View>

        {/* Rail 1: Recent Releases */}
        <View style={styles.railsContainer}>
          <NativeSection
            description="Your latest music collaborations and uploads"
            title="Recent Releases"
            viewAllHref="/dashboard/music/projects"
          >
            {projects.length === 0 && tracks.length === 0 ? (
              <View
                style={[
                  styles.emptyCard,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <Ionicons
                  color={theme.mutedText}
                  name="musical-notes-outline"
                  size={24}
                />
                <Text style={[styles.emptyTitle, { color: theme.text }]}>
                  No releases yet
                </Text>
                <Text
                  style={[styles.emptySubtitle, { color: theme.mutedText }]}
                >
                  Upload a track or project to populate your catalog.
                </Text>
              </View>
            ) : (
              <NativeRail>
                {projects.slice(0, 6).map((project) => (
                  <FramelessCard
                    aspectRatio={1}
                    href="/dashboard/music/projects"
                    image={project.coverArtUrl}
                    key={project.id}
                    subtitle={`${project.trackCount ?? 0} tracks`}
                    title={project.title}
                    width={130}
                  />
                ))}
                {tracks.slice(0, 6).map((track) => (
                  <FramelessCard
                    aspectRatio={1}
                    href="/dashboard/music/tracks"
                    image={track.coverArtUrl}
                    key={track.id}
                    subtitle={track.artistName}
                    title={track.title}
                    width={130}
                  />
                ))}
              </NativeRail>
            )}
          </NativeSection>

          {/* Rail 2: Upcoming (Calendar & Schedule) */}
          <NativeSection
            description="Scheduled drops, listening parties, and calendar events"
            title="Upcoming"
            viewAllHref="/dashboard/career/calendar"
          >
            <NativeRail>
              {upcomingReleases.length > 0 ? (
                upcomingReleases
                  .slice(0, 4)
                  .map((project) => (
                    <UpcomingCard
                      actionLabel="View details"
                      dateLabel={project.releaseDate ?? "Scheduled"}
                      href="/dashboard/career/calendar"
                      key={project.id}
                      subtitle="Upcoming record release"
                      title={project.title}
                    />
                  ))
              ) : (
                <>
                  <UpcomingCard
                    actionLabel="Schedule room"
                    dateLabel="This Weekend"
                    href="/dashboard/live/parties"
                    subtitle="Host a synchronized listening room"
                    title="Album Premiere"
                  />
                  <UpcomingCard
                    actionLabel="Open calendar"
                    dateLabel="Next Drop"
                    href="/dashboard/career/calendar"
                    subtitle="Plan release dates, marketing, and push campaigns"
                    title="Calendar Schedule"
                  />
                </>
              )}
            </NativeRail>
          </NativeSection>

          {/* Rail 3: Community & Messages */}
          <NativeSection
            description="Fan direct messages and open verses"
            title="Community & Messages"
            viewAllHref="/dashboard/music/messages"
          >
            <NativeRail>
              <UpcomingCard
                actionLabel="Open inbox"
                dateLabel="Messages"
                href="/dashboard/music/messages"
                subtitle="Fan feedback, direct inquiries, and collaborator notes"
                title="Direct Messages"
              />
              <UpcomingCard
                actionLabel="View verses"
                dateLabel="Open Verse"
                href="/dashboard/music/open-verses"
                subtitle="Community challenges and fan verse submissions"
                title="Open Verses"
              />
              <UpcomingCard
                actionLabel="Manage ads"
                dateLabel="Promote"
                href="/dashboard/career/ads"
                subtitle="Run discovery campaigns and sponsored track placements"
                title="Paid Spotlight"
              />
            </NativeRail>
          </NativeSection>
        </View>
      </ScrollView>
    </Container>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    marginTop: 10,
  },
  actionText: {
    fontSize: 12,
    fontWeight: "700",
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
  bioActionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  bioCard: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  bioCopyBadge: {
    fontSize: 11,
    fontWeight: "700",
  },
  bioHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  bioShareBtn: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  bioSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  bioTitle: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  bioUrlPill: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  bioUrlText: {
    flex: 1,
    fontSize: 12,
  },
  cardSubtitle: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 8,
  },
  content: {
    gap: 20,
    padding: 20,
    paddingBottom: 64,
  },
  dateBadge: {
    alignItems: "center",
    borderRadius: 6,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  dateBadgeText: {
    fontSize: 10,
    fontWeight: "800",
  },
  dismissBtn: {
    padding: 2,
  },
  emptyCard: {
    alignItems: "center",
    borderRadius: 14,
    borderStyle: "dashed",
    borderWidth: 1,
    gap: 6,
    padding: 24,
    width: "100%",
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: "center",
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  eyebrowRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  greeting: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  headerArea: {
    gap: 4,
  },
  primaryBtn: {
    alignItems: "center",
    borderRadius: 12,
    paddingVertical: 12,
  },
  primaryBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  quickActionPill: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 5,
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
  },
  railsContainer: {
    gap: 28,
  },
  signInCard: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    padding: 20,
  },
  signInText: {
    fontSize: 13,
    lineHeight: 19,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
  },
  upcomingCard: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 2,
    padding: 14,
    width: 200,
  },
  upcomingHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
});
