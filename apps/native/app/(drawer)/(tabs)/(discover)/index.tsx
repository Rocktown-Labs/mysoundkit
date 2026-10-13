import { useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { AvatarHeaderButton } from "@/components/avatar-header-button";
import { BottomMenuSheet } from "@/components/bottom-menu-sheet";
import type { BottomMenuSheetHandle } from "@/components/bottom-menu-sheet";
import { Container } from "@/components/container";
import { DiscoverSection } from "@/components/discover-section";
import type { DiscoverCardData } from "@/components/discover-section";
import { RegionPickerCard } from "@/components/region-picker-card";
import { useTabMenu } from "@/components/tab-menu-sheets";
import { NAV_THEME } from "@/lib/constants";
import { mapScopes } from "@/lib/map-scopes";
import type { MapScope } from "@/lib/map-scopes";
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
    headerCopy: { flex: 1 },
    headerRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 12,
    },
    tagline: { fontSize: 14, lineHeight: 20, marginTop: -14 },
    title: {
      fontSize: 32,
      fontWeight: "800",
      letterSpacing: -0.8,
    },
  });

function toArtistCards(artists?: readonly ArtistSummary[]): DiscoverCardData[] {
  return (artists ?? []).map((artist) => ({
    href: "/artist",
    id: artist.id,
    imageUrl: artist.avatarUrl,
    subtitle: artist.location,
    title: artist.name,
  }));
}

function toBattleCards(battles?: readonly BattleSummary[]): DiscoverCardData[] {
  return (battles ?? []).map((battle) => ({
    badge: battle.status === "live" ? "LIVE" : undefined,
    href: "/live/battles",
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
    href: "/live/parties",
    id: party.id,
    subtitle: party.genre ?? "Listening party",
    title: party.title,
  }));
}

function toProjectCards(
  projects?: readonly ProjectSummary[]
): DiscoverCardData[] {
  return (projects ?? []).map((project) => ({
    href: "/projects",
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
    href: "/live/streams",
    id: stream.id,
    subtitle: stream.creatorName ?? "SoundKit creator",
    title: stream.title,
  }));
}

function toTrackCards(tracks?: readonly TrackSummary[]): DiscoverCardData[] {
  return (tracks ?? []).map((track) => ({
    href: "/tracks",
    id: track.id,
    imageUrl: track.coverArtUrl,
    subtitle: track.artistName,
    title: track.title,
  }));
}

function toVideoCards(videos?: readonly VideoSummary[]): DiscoverCardData[] {
  return (videos ?? []).map((video) => ({
    href: "/videos",
    id: video.id,
    imageUrl: video.thumbnailUrl,
    subtitle: video.creatorName ?? "SoundKit creator",
    title: video.title,
  }));
}

export default function DiscoverScreen() {
  const [activeScope, setActiveScope] = useState<MapScope>("global"),
    { colorScheme } = useColorScheme(),
    discoverQuery = {
      region: activeScope === "global" ? "all" : activeScope,
      regionType:
        activeScope === "global"
          ? ("global" as const)
          : ("north-america" as const),
    },
    liveBattles = useDiscoverBattlesQuery(discoverQuery),
    liveParties = useDiscoverPartiesQuery(discoverQuery),
    liveStreams = useDiscoverStreamsQuery(discoverQuery),
    newReleases = useDiscoverNewReleasesQuery(discoverQuery),
    { openLibraryMenu } = useTabMenu(),
    projects = useDiscoverProjectsQuery(discoverQuery),
    regionOptions = mapScopes.map((option) => ({
      description: option.description,
      icon: option.icon,
      label: option.label,
      onPress: () => {
        setActiveScope(option.id);
      },
    })),
    regionSheetRef = useRef<BottomMenuSheetHandle>(null),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    topArtists = useDiscoverTopArtistsQuery(discoverQuery),
    topSongs = useDiscoverTopSongsQuery(discoverQuery),
    videos = useDiscoverVideosQuery(discoverQuery);

  return (
    <Container>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, { color: theme.primary }]}>
              SoundKit
            </Text>
            <Text selectable style={[styles.title, { color: theme.text }]}>
              Discover
            </Text>
          </View>
          <AvatarHeaderButton onSinglePress={openLibraryMenu} />
        </View>
        <Text selectable style={[styles.tagline, { color: theme.mutedText }]}>
          Top songs, new releases, live moments, and rising artists — picked for
          your region.
        </Text>
        <RegionPickerCard
          onPress={() => {
            regionSheetRef.current?.present();
          }}
          scope={activeScope}
        />
        <DiscoverSection
          data={toTrackCards(topSongs.data)}
          emptyMessage={SECTION_EMPTY}
          isLoading={topSongs.isLoading}
          seeAllHref="/tracks"
          title="Top Songs"
        />
        <DiscoverSection
          data={toTrackCards(newReleases.data)}
          emptyMessage={SECTION_EMPTY}
          isLoading={newReleases.isLoading}
          seeAllHref="/tracks"
          title="New Releases"
        />
        <DiscoverSection
          data={toBattleCards(liveBattles.data)}
          emptyMessage="No battles scheduled in this region yet."
          isLoading={liveBattles.isLoading}
          seeAllHref="/live/battles"
          title="Live Battles"
        />
        <DiscoverSection
          data={toArtistCards(topArtists.data)}
          emptyMessage={SECTION_EMPTY}
          isLoading={topArtists.isLoading}
          seeAllHref="/artist"
          title="Top Artists"
        />
        <DiscoverSection
          data={toVideoCards(videos.data)}
          emptyMessage={SECTION_EMPTY}
          isLoading={videos.isLoading}
          seeAllHref="/videos"
          title="Featured Videos"
        />
        <DiscoverSection
          data={toStreamCards(liveStreams.data)}
          emptyMessage="No creator streams happening right now."
          isLoading={liveStreams.isLoading}
          seeAllHref="/live/streams"
          title="Live Streams"
        />
        <DiscoverSection
          data={toProjectCards(projects.data)}
          emptyMessage={SECTION_EMPTY}
          isLoading={projects.isLoading}
          seeAllHref="/projects"
          title="Featured Projects"
        />
        <DiscoverSection
          data={toPartyCards(liveParties.data)}
          emptyMessage="No listening parties scheduled yet."
          isLoading={liveParties.isLoading}
          seeAllHref="/live/parties"
          title="Listening Parties"
        />
      </ScrollView>
      <BottomMenuSheet
        description="Charts and drops from the region you pick."
        items={regionOptions}
        ref={regionSheetRef}
        title="Choose a region"
      />
    </Container>
  );
}
