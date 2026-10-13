import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ArtistCard } from "@/components/cards/artist-card";
import { BattleCard } from "@/components/cards/battle-card";
import { PartyCard } from "@/components/cards/party-card";
import { ProjectCard } from "@/components/cards/project-card";
import { StreamCard } from "@/components/cards/stream-card";
import { TrackCard } from "@/components/cards/track-card";
import { VideoCard } from "@/components/cards/video-card";
import { Container } from "@/components/container";
import { NativeEmptyState } from "@/components/native-collection-grid";
import { NativeMap } from "@/components/native-map";
import { NativeRail } from "@/components/native-rail";
import { NativeSection } from "@/components/native-section";
import { SoundKitBrand } from "@/components/soundkit-brand";
import { NAV_THEME } from "@/lib/constants";
import {
  exploreLocationPhrase,
  exploreRegionLabel,
  exploreRegionQuery,
  type MapScope,
} from "@/lib/explore-region";
import {
  useArtistsQuery,
  useBattlesQuery,
  useListeningPartiesQuery,
  usePublicLiveExperiencesQuery,
  usePublicProjectsQuery,
  useTracksQuery,
  useVideosQuery,
} from "@/lib/soundkit-api";
import type { TrackSummary } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

const styles = StyleSheet.create({
    brandRow: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    input: {
      borderRadius: 12,
      borderWidth: 1,
      fontSize: 15,
      marginBottom: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    locationText: { fontSize: 12, marginBottom: 10 },
    searchRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
    },
    sectionGap: { gap: 26 },
    title: {
      fontSize: 34,
      fontWeight: "800",
      letterSpacing: -0.8,
      marginBottom: 4,
    },
  }),
  PUBLIC_QUERY = { limit: 12, scope: "public" } as const;

export default function ExploreScreen() {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    queryClient = useQueryClient(),
    [mapScope, setMapScope] = useState<MapScope>("global"),
    [region, setRegion] = useState<string | null>(null),
    [search, setSearch] = useState(""),
    regionQuery = useMemo(
      () => exploreRegionQuery({ mapScope, region }),
      [mapScope, region]
    ),
    locationPhrase = exploreLocationPhrase({ mapScope, region }),
    tracksQuery = useTracksQuery({
      ...regionQuery,
      limit: 12,
      scope: "public",
      sort: "plays-desc",
    }),
    newTracksQuery = useTracksQuery({
      ...regionQuery,
      limit: 12,
      scope: "public",
      sort: "date-desc",
    }),
    battlesQuery = useBattlesQuery(regionQuery),
    artistsQuery = useArtistsQuery({
      ...regionQuery,
      category: "top",
      limit: 10,
      sort: "rank-asc",
    }),
    videosQuery = useVideosQuery({
      ...regionQuery,
      limit: 12,
      scope: "public",
    }),
    streamsQuery = usePublicLiveExperiencesQuery("stream", regionQuery),
    projectsQuery = usePublicProjectsQuery({
      ...regionQuery,
      limit: 12,
      sort: "date-desc",
    }),
    partiesQuery = useListeningPartiesQuery(regionQuery),
    searchTracksQuery = useTracksQuery({
      ...regionQuery,
      limit: 12,
      q: search.trim() || undefined,
      scope: "public",
      sort: "plays-desc",
    }),
    refresh = () => {
      void queryClient.invalidateQueries();
    };

  return (
    <ScrollView
      contentContainerStyle={styles.sectionGap}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      style={{ backgroundColor: theme.background }}
      refreshControl={
        <RefreshControl
          onRefresh={refresh}
          refreshing={false}
          tintColor={theme.primary}
        />
      }
    >
      <Container>
        <View style={styles.brandRow}>
          <SoundKitBrand />
          <Text style={[styles.locationText, { color: theme.mutedText }]}>
            MOBILE APP
          </Text>
        </View>
        <Text style={[styles.title, { color: theme.text }]}>
          Discover Music
        </Text>
        <Text style={[styles.locationText, { color: theme.mutedText }]}>
          {`Top music ${locationPhrase}. Tap the map to focus a region.`}
        </Text>

        <NativeMap
          onRegionSelect={(nextRegion) => {
            setRegion((current) =>
              current === nextRegion ? null : nextRegion
            );
          }}
          onScopeChange={(scope) => {
            setMapScope(scope);
            setRegion(null);
          }}
          scope={mapScope}
          selectedRegion={region}
        />

        <View style={styles.searchRow}>
          <TextInput
            autoCorrect={false}
            clearButtonMode="while-editing"
            onChangeText={setSearch}
            placeholder="Search songs…"
            placeholderTextColor={theme.mutedText}
            returnKeyType="search"
            style={[
              styles.input,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
            value={search}
          />
        </View>

        {search.trim().length > 0 ? (
          <NativeSection title={`Results for “${search.trim()}”`}>
            <NativeRail>
              {(searchTracksQuery.data ?? []).map((track: TrackSummary) => (
                <TrackCard key={track.id} track={track} />
              ))}
              {searchTracksQuery.data?.length === 0 ? (
                <NativeEmptyState>
                  No songs matched your search.
                </NativeEmptyState>
              ) : null}
            </NativeRail>
          </NativeSection>
        ) : null}

        <NativeSection
          description={
            region == null && mapScope === "global"
              ? "Most played tracks across the app this week"
              : `Most played tracks in ${exploreRegionLabel({ mapScope, region })} this week`
          }
          title={`Top Songs ${locationPhrase}`}
          viewAllHref={`/tracks?regionType=${regionQuery.regionType}&region=${regionQuery.region}&sort=plays-desc`}
        >
          <NativeRail>
            {tracksQuery.isLoading ? <RailLoading /> : null}
            {(tracksQuery.data ?? []).map((track: TrackSummary) => (
              <TrackCard key={track.id} track={track} />
            ))}
            {tracksQuery.data?.length === 0 ? (
              <NativeEmptyState>
                No songs are live for this view yet.
              </NativeEmptyState>
            ) : null}
          </NativeRail>
        </NativeSection>

        <NativeSection
          description="Fresh drops from every active scene"
          title={`New Releases ${locationPhrase}`}
          viewAllHref={`/tracks?regionType=${regionQuery.regionType}&region=${regionQuery.region}&sort=date-desc`}
        >
          <NativeRail>
            {newTracksQuery.isLoading ? <RailLoading /> : null}
            {(newTracksQuery.data ?? []).map((track: TrackSummary) => (
              <TrackCard key={track.id} track={track} />
            ))}
          </NativeRail>
        </NativeSection>

        <NativeSection
          description="Vote in head-to-head producer matchups"
          title={`Live Battles ${locationPhrase}`}
          viewAllHref="/live/battles"
        >
          <NativeRail>
            {battlesQuery.isLoading ? <RailLoading /> : null}
            {(battlesQuery.data ?? []).map((battle) => (
              <BattleCard battle={battle} key={battle.id} />
            ))}
            {battlesQuery.data?.length === 0 ? (
              <NativeEmptyState>
                No battles are live for this view yet.
              </NativeEmptyState>
            ) : null}
          </NativeRail>
        </NativeSection>

        <NativeSection
          description="Rising stars and top performers"
          title={`Top Artists ${locationPhrase}`}
          viewAllHref="/artist"
        >
          <NativeRail>
            {artistsQuery.isLoading ? <RailLoading /> : null}
            {(artistsQuery.data ?? []).map((artist) => (
              <ArtistCard artist={artist} key={artist.username} />
            ))}
          </NativeRail>
        </NativeSection>

        <NativeSection
          description="Official music videos, studio sessions, and live drops"
          title={`Featured Videos ${locationPhrase}`}
          viewAllHref="/videos"
        >
          <NativeRail>
            {videosQuery.isLoading ? <RailLoading /> : null}
            {(videosQuery.data ?? []).map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
            {videosQuery.data?.length === 0 ? (
              <NativeEmptyState>
                No videos are live for this view yet.
              </NativeEmptyState>
            ) : null}
          </NativeRail>
        </NativeSection>

        <NativeSection
          description="Real-time broadcasts and DJ sets live right now"
          title={`Live Streams ${locationPhrase}`}
          viewAllHref="/live/streams"
        >
          <NativeRail>
            {streamsQuery.isLoading ? <RailLoading /> : null}
            {(streamsQuery.data ?? []).map((stream) => (
              <StreamCard key={stream.id} stream={stream} />
            ))}
            {streamsQuery.data?.length === 0 ? (
              <NativeEmptyState>
                No live streams currently broadcasting.
              </NativeEmptyState>
            ) : null}
          </NativeRail>
        </NativeSection>

        <NativeSection
          description="Albums, EPs, beat kits, and mixtapes"
          title={`Featured Projects ${locationPhrase}`}
          viewAllHref="/projects"
        >
          <NativeRail>
            {projectsQuery.isLoading ? <RailLoading /> : null}
            {(projectsQuery.data ?? []).map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
            {projectsQuery.data?.length === 0 ? (
              <NativeEmptyState>
                No featured projects are live for this view yet.
              </NativeEmptyState>
            ) : null}
          </NativeRail>
        </NativeSection>

        <NativeSection
          description="Community listening parties and track premieres"
          title={`Listening Parties ${locationPhrase}`}
          viewAllHref="/live/parties"
        >
          <NativeRail>
            {partiesQuery.isLoading ? <RailLoading /> : null}
            {(partiesQuery.data ?? []).map((party) => (
              <PartyCard key={party.id} party={party} />
            ))}
            {partiesQuery.data?.length === 0 ? (
              <NativeEmptyState>
                No upcoming listening parties scheduled.
              </NativeEmptyState>
            ) : null}
          </NativeRail>
        </NativeSection>
      </Container>
    </ScrollView>
  );
}

function RailLoading() {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;

  return <ActivityIndicator color={theme.primary} style={{ padding: 16 }} />;
}
