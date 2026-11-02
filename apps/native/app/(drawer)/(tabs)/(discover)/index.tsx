/* oxlint-disable one-var, sort-vars, no-nested-ternary, require-unicode-regexp */
/* eslint-disable one-var, sort-vars, no-nested-ternary, require-unicode-regexp */
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AvatarHeaderButton } from "@/components/avatar-header-button";
import { CartHeaderButton } from "@/components/cart/cart-header-button";
import { Container } from "@/components/container";
import { DiscoverSection } from "@/components/discover-section";
import type { DiscoverCardData } from "@/components/discover-section";
import { RegionPickerCard } from "@/components/region-picker-card";
import { RegionPickerSheet } from "@/components/region-picker-sheet";
import type { RegionPickerSheetHandle } from "@/components/region-picker-sheet";
import { useTabMenu } from "@/components/tab-menu-sheets";
import { NAV_THEME } from "@/lib/constants";
import { exploreRegionQuery } from "@/lib/explore-region";
import type { MapScope } from "@/lib/map-scopes";
import { loadRegionSelection, saveRegionSelection } from "@/lib/region-store";
import type {
  ArtistSummary,
  BattleSummary,
  ListeningPartySummary,
  LiveExperienceSummary,
  ProjectSummary,
  TrackSummary,
  VideoSummary,
} from "@/lib/soundkit-api";
import {
  useDiscoverBattlesQuery,
  useDiscoverNewReleasesQuery,
  useDiscoverPartiesQuery,
  useDiscoverProjectsQuery,
  useDiscoverStreamsQuery,
  useDiscoverTopArtistsQuery,
  useDiscoverTopSongsQuery,
  useDiscoverVideosQuery,
} from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

const SECTION_EMPTY = "Nothing here yet — check back soon.",
  styles = StyleSheet.create({
    content: {
      gap: 22,
      paddingBottom: 24,
      paddingHorizontal: 20,
      paddingTop: 16,
    },
    eyebrow: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.5,
      marginBottom: 2,
      textTransform: "uppercase",
    },
    headerActions: {
      alignItems: "center",
      flexDirection: "row",
      gap: 10,
    },
    headerCopy: { flex: 1 },
    headerRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 12,
    },
    stateAction: { paddingVertical: 12 },
    stateBox: { gap: 8 },
    stateCopy: { fontSize: 14, lineHeight: 20 },
    tagline: { fontSize: 14, lineHeight: 20, marginTop: -14 },
    title: {
      fontSize: 32,
      fontWeight: "800",
      letterSpacing: -0.8,
    },
  });

function toArtistCards(artists?: readonly ArtistSummary[]): DiscoverCardData[] {
  return (artists ?? []).map((artist) => ({
    href: `/artist/${artist.username ?? artist.id}`,
    id: artist.id,
    imageUrl: artist.avatarUrl,
    subtitle: artist.location,
    title: artist.name,
  }));
}

function toBattleCards(battles?: readonly BattleSummary[]): DiscoverCardData[] {
  return (battles ?? []).map((battle) => ({
    badge: battle.status === "live" ? "LIVE" : undefined,
    href: `/live/battles/${battle.id}`,
    id: battle.id,
    subtitle: battle.genre ?? "SoundKit battle",
    title: battle.title,
  }));
}

function toPartyCards(
  parties?: readonly ListeningPartySummary[]
): DiscoverCardData[] {
  return (parties ?? []).map((party) => ({
    badge: party.status === "live" ? "LIVE" : undefined,
    href: `/live/parties/${party.id}`,
    id: party.id,
    subtitle: party.genre ?? "Listening party",
    title: party.title,
  }));
}

function toProjectCards(
  projects?: readonly ProjectSummary[]
): DiscoverCardData[] {
  return (projects ?? []).map((project) => ({
    href: `/projects/${project.id}`,
    id: project.id,
    imageUrl: project.coverArtUrl ?? null,
    subtitle: project.artistName ?? "SoundKit project",
    title: project.title,
  }));
}

function toStreamCards(
  streams?: readonly LiveExperienceSummary[]
): DiscoverCardData[] {
  return (streams ?? []).map((stream) => ({
    badge: stream.status === "live" ? "LIVE" : undefined,
    href: `/live/streams/${stream.id}`,
    id: stream.id,
    subtitle: stream.creatorName ?? "SoundKit creator",
    title: stream.title,
  }));
}

function toTrackCards(tracks?: readonly TrackSummary[]): DiscoverCardData[] {
  return (tracks ?? []).map((track) => ({
    href: `/tracks/${track.id}`,
    id: track.id,
    imageUrl: track.coverArtUrl,
    meta: `${track.duration || "0:00"} • ${(track.plays ?? 0).toLocaleString()} plays`,
    showHeart: true,
    subtitle: track.artistName,
    title: track.title,
  }));
}

function toVideoCards(videos?: readonly VideoSummary[]): DiscoverCardData[] {
  return (videos ?? []).map((video) => ({
    href: `/videos/${video.id}`,
    id: video.id,
    imageUrl: video.thumbnailUrl,
    subtitle: video.creatorName ?? "SoundKit creator",
    title: video.title,
  }));
}

export default function DiscoverScreen() {
  const [activeScope, setActiveScope] = useState<MapScope>("global"),
    { colorScheme } = useColorScheme(),
    [selectedRegion, setSelectedRegion] = useState<string | null>(null),
    regionSheetRef = useRef<RegionPickerSheetHandle>(null),
    { openLibraryMenu } = useTabMenu(),
    discoverQuery = exploreRegionQuery({
      mapScope: activeScope,
      region: selectedRegion,
    }),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    topArtists = useDiscoverTopArtistsQuery(discoverQuery),
    topSongs = useDiscoverTopSongsQuery(discoverQuery),
    newReleases = useDiscoverNewReleasesQuery(discoverQuery),
    liveBattles = useDiscoverBattlesQuery(discoverQuery),
    videos = useDiscoverVideosQuery(discoverQuery),
    liveStreams = useDiscoverStreamsQuery(discoverQuery),
    projects = useDiscoverProjectsQuery(discoverQuery),
    liveParties = useDiscoverPartiesQuery(discoverQuery);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const restored = await loadRegionSelection();
        if (!active || !restored) {
          return;
        }
        setActiveScope(restored.mapScope);
        setSelectedRegion(restored.regionName);
      } catch {
        // Persisted selection is optional; keep the defaults.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const [isRetrying, setIsRetrying] = useState(false);
  const retryInFlightRef = useRef(false);
  const discoveryQueries = [
    topSongs,
    newReleases,
    liveBattles,
    topArtists,
    videos,
    liveStreams,
    projects,
    liveParties,
  ];
  const hasResults = discoveryQueries.some(
    (query) => (query.data?.length ?? 0) > 0
  );
  const settled = discoveryQueries.every((query) => !query.isPending);
  const hasError = discoveryQueries.some((query) => query.isError);
  const retryDiscovery = async () => {
    if (retryInFlightRef.current) {
      return;
    }
    retryInFlightRef.current = true;
    setIsRetrying(true);
    try {
      await Promise.allSettled(
        discoveryQueries.map((query) => query.refetch({ cancelRefetch: false }))
      );
    } catch {
      // Keep the current error message if creating a retry itself fails.
    }
    retryInFlightRef.current = false;
    setIsRetrying(false);
  };

  return (
    <Container>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text selectable style={[styles.title, { color: theme.text }]}>
              Discover
            </Text>
          </View>
          <View style={styles.headerActions}>
            <CartHeaderButton />
            <AvatarHeaderButton onSinglePress={openLibraryMenu} />
          </View>
        </View>
        <Text selectable style={[styles.tagline, { color: theme.mutedText }]}>
          Top songs, new releases, live moments, and rising artists — picked for
          your region.
        </Text>
        <RegionPickerCard
          onPress={() => {
            regionSheetRef.current?.present();
          }}
          regionName={selectedRegion}
          scope={activeScope}
        />
        {hasError ? (
          <View style={styles.stateBox}>
            <Text style={[styles.stateCopy, { color: theme.text }]}>
              Some discovery results couldn’t load.
            </Text>
            <Pressable
              accessibilityLabel="Retry loading discovery results"
              accessibilityRole="button"
              accessibilityState={{ busy: isRetrying, disabled: isRetrying }}
              disabled={isRetrying}
              style={styles.stateAction}
              onPress={() => {
                void retryDiscovery();
              }}
            >
              <Text style={{ color: theme.primary }}>
                {isRetrying ? "Retrying…" : "Try again"}
              </Text>
            </Pressable>
          </View>
        ) : null}
        {settled && !hasResults && !hasError ? (
          <View style={styles.stateBox}>
            <Text style={[styles.stateCopy, { color: theme.text }]}>
              No releases or live activity in this region yet.
            </Text>
            {activeScope !== "global" || selectedRegion ? (
              <Pressable
                accessibilityLabel="Explore all SoundKit"
                accessibilityRole="button"
                style={styles.stateAction}
                onPress={() => {
                  setActiveScope("global");
                  setSelectedRegion(null);
                  void saveRegionSelection({
                    mapScope: "global",
                    regionName: null,
                  });
                }}
              >
                <Text style={{ color: theme.primary }}>
                  Explore all SoundKit
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        <DiscoverSection
          hideWhenEmpty
          data={toTrackCards(topSongs.data)}
          emptyMessage={SECTION_EMPTY}
          isLoading={topSongs.isLoading}
          seeAllHref="/tracks"
          title="Top Songs"
        />
        <DiscoverSection
          hideWhenEmpty
          data={toTrackCards(newReleases.data)}
          emptyMessage={SECTION_EMPTY}
          isLoading={newReleases.isLoading}
          seeAllHref="/tracks"
          title="New Releases"
        />
        <DiscoverSection
          hideWhenEmpty
          data={toBattleCards(liveBattles.data)}
          emptyMessage="No battles scheduled in this region yet."
          isLoading={liveBattles.isLoading}
          seeAllHref="/live/battles"
          title="Live Battles"
        />
        <DiscoverSection
          hideWhenEmpty
          data={toArtistCards(topArtists.data)}
          emptyMessage={SECTION_EMPTY}
          isLoading={topArtists.isLoading}
          seeAllHref="/artist"
          title="Top Artists"
        />
        <DiscoverSection
          hideWhenEmpty
          data={toVideoCards(videos.data)}
          emptyMessage={SECTION_EMPTY}
          isLoading={videos.isLoading}
          seeAllHref="/videos"
          title="Featured Videos"
        />
        <DiscoverSection
          hideWhenEmpty
          data={toStreamCards(liveStreams.data)}
          emptyMessage="No creator streams happening right now."
          isLoading={liveStreams.isLoading}
          seeAllHref="/live/streams"
          title="Live Streams"
        />
        <DiscoverSection
          hideWhenEmpty
          data={toProjectCards(projects.data)}
          emptyMessage={SECTION_EMPTY}
          isLoading={projects.isLoading}
          seeAllHref="/projects"
          title="Featured Projects"
        />
        <DiscoverSection
          hideWhenEmpty
          data={toPartyCards(liveParties.data)}
          emptyMessage="No listening parties scheduled yet."
          isLoading={liveParties.isLoading}
          seeAllHref="/live/parties"
          title="Listening Parties"
        />
      </ScrollView>
      <RegionPickerSheet
        onRegionChange={(newScope, regionName) => {
          setActiveScope(newScope);
          setSelectedRegion(regionName);
          void saveRegionSelection({ mapScope: newScope, regionName });
        }}
        ref={regionSheetRef}
        scope={activeScope}
        selectedRegion={selectedRegion}
      />
    </Container>
  );
}
