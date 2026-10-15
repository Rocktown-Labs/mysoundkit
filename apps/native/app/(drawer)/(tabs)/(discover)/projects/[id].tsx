/* eslint-disable one-var, sort-vars, eqeqeq, no-eq-null, unicorn/no-negated-condition, complexity */
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Share,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";

import { TrackCard } from "@/components/cards/track-card";
import { NativeImage } from "@/components/native-image";
import { useAudioPlayerContext } from "@/contexts/audio-player-context";
import { authClient } from "@/lib/auth-client";
import { NAV_THEME } from "@/lib/constants";
import type { PlayerTrack } from "@/lib/player-queue";
import {
  resolveApiUrl,
  usePublicProjectQuery,
  useTracksQuery,
} from "@/lib/soundkit-api";
import type { PublicProjectDetail } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

const styles = StyleSheet.create({
  actionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
    width: "100%",
  },
  actions: { flexDirection: "row", gap: 10 },
  content: { alignItems: "center", gap: 18, padding: 20, paddingBottom: 48 },
  cover: {
    aspectRatio: 1,
    borderRadius: 16,
    maxWidth: 320,
    overflow: "hidden",
    width: "100%",
  },
  coverFrame: {
    alignSelf: "center",
    aspectRatio: 1,
    borderRadius: 16,
    maxWidth: 320,
    overflow: "hidden",
    width: "100%",
  },
  description: { fontSize: 14, lineHeight: 21, textAlign: "center" },
  descriptionBlock: { alignItems: "center", gap: 6, width: "100%" },
  descriptionMore: {
    color: "#B8A3FF",
    fontSize: 13,
    fontWeight: "800",
    marginTop: -2,
  },
  iconAction: {
    alignItems: "center",
    backgroundColor: "#111111",
    borderColor: "#292929",
    borderRadius: 999,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  info: { alignItems: "center", gap: 8, width: "100%" },
  metaRow: { flexDirection: "row", gap: 10 },
  metaText: { fontSize: 12 },
  playCircleOverlay: {
    alignItems: "center",
    backgroundColor: "#B8A3FF",
    borderRadius: 999,
    height: 64,
    justifyContent: "center",
    left: "50%",
    marginLeft: -32,
    marginTop: -32,
    position: "absolute",
    top: "50%",
    width: 64,
  },
  primaryAction: {
    alignItems: "center",
    backgroundColor: "#B8A3FF",
    borderRadius: 999,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 56,
    paddingHorizontal: 30,
  },
  primaryActionText: { color: "#09090B", fontSize: 17, fontWeight: "900" },
  relatedRail: { gap: 14 },
  roundAction: {
    alignItems: "center",
    backgroundColor: "#292929",
    borderRadius: 999,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  section: { gap: 10, width: "100%" },
  sectionHeading: {
    color: "#8F8F8F",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  sheet: {
    backgroundColor: "rgba(24, 24, 24, 0.98)",
    borderColor: "#3A3A3A",
    borderRadius: 28,
    borderWidth: 1,
    gap: 8,
    marginBottom: 92,
    marginRight: 12,
    padding: 20,
    width: "88%",
  },
  sheetBackdrop: {
    alignItems: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.58)",
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetHandle: {
    alignSelf: "center",
    backgroundColor: "#666666",
    borderRadius: 999,
    height: 4,
    marginBottom: 12,
    width: 44,
  },
  sheetRow: {
    alignItems: "center",
    borderTopColor: "#292929",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 14,
    paddingVertical: 15,
  },
  sheetRowText: { color: "#FFFFFF", flex: 1, fontSize: 15, fontWeight: "700" },
  sheetScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.58)",
  },
  sheetSubtitle: { color: "#969696", fontSize: 12, marginBottom: 8 },
  sheetTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  sheetTopAction: { alignItems: "center", gap: 7, minWidth: 72 },
  sheetTopActionText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  sheetTopActions: {
    borderBottomColor: "#343434",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-around",
    paddingBottom: 18,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: -0.5,
    textAlign: "center",
  },
  trackCopy: { flex: 1, gap: 3 },
  trackIndex: { color: "#8F8F8F", fontSize: 12, width: 18 },
  trackList: { width: "100%" },
  trackMeta: { color: "#8F8F8F", fontSize: 11 },
  trackRow: {
    alignItems: "center",
    borderBottomColor: "#171717",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  trackTitle: { color: "#F8F8F8", fontSize: 14, fontWeight: "700" },
  type: {
    borderColor: "#8B78D8",
    borderWidth: 1,
    color: "#B8A3FF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
});

const toSeconds = (duration?: null | string) => {
  if (!duration) {
    return null;
  }
  const parts = duration.split(":").map(Number);
  return parts.every(Number.isFinite)
    ? parts.reduce((total, part) => total * 60 + part, 0)
    : null;
};

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    project = usePublicProjectQuery(id ?? ""),
    artistTracks = useTracksQuery({ limit: 24 }),
    router = useRouter(),
    { data: session } = authClient.useSession(),
    { addToQueue, playTrack, toggleShuffle } = useAudioPlayerContext(),
    [isFavorite, setIsFavorite] = useState(false),
    [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false),
    [isMenuVisible, setIsMenuVisible] = useState(false),
    [menuTrack, setMenuTrack] = useState<null | ProjectTrack>(null),
    { data } = project;
  const moreFromArtist = data?.artistName
    ? (artistTracks.data ?? [])
        .filter(
          (track) =>
            track.artistName === data.artistName &&
            !data.tracks?.some((projectTrack) => projectTrack.id === track.id)
        )
        .slice(0, 8)
    : [];

  return (
    <>
      <Stack.Screen
        options={{
          headerBackTitle: "Back",
          headerShown: true,
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          title: data?.title ?? "Project",
        }}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={[{ backgroundColor: theme.background }]}
      >
        {project.isLoading || data == null ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={styles.coverFrame}>
              <NativeImage
                contentFit="cover"
                source={data.coverArtUrl ?? undefined}
                style={styles.cover}
              />
              {data.tracks?.[0] ? (
                <Pressable
                  accessibilityLabel="Play project"
                  accessibilityRole="button"
                  onPress={() => playTrack(toPlayerTrack(data.tracks[0]))}
                  style={styles.playCircleOverlay}
                >
                  <Ionicons color="#09090B" name="play" size={28} />
                </Pressable>
              ) : null}
            </View>
            <View style={styles.info}>
              <Text style={[styles.title, { color: theme.text }]}>
                {data.title.toUpperCase()}
              </Text>
              <Text
                style={{
                  color: theme.mutedText,
                  fontSize: 14,
                  fontWeight: "600",
                }}
              >
                {data.artistName ?? data.genre ?? "SoundKit artist"}
              </Text>
              <View style={styles.descriptionBlock}>
                <Text
                  numberOfLines={isDescriptionExpanded ? undefined : 3}
                  style={[styles.description, { color: theme.mutedText }]}
                >
                  {data.description ??
                    "A SoundKit release from an independent creator."}
                </Text>
                {data.description && data.description.length > 180 ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setIsDescriptionExpanded((value) => !value)}
                  >
                    <Text style={styles.descriptionMore}>
                      {isDescriptionExpanded ? "Show less" : "Read more"}
                    </Text>
                  </Pressable>
                ) : null}
                <Text style={[styles.metaText, { color: theme.mutedText }]}>
                  {data.projectType}
                  {data.genre ? ` • ${data.genre}` : ""}
                  {data.duration ? ` • ${data.duration}` : ""}
                </Text>
              </View>
            </View>
            <View style={styles.actionRow}>
              <Pressable
                accessibilityLabel="Shuffle project"
                accessibilityRole="button"
                onPress={() => toggleShuffle()}
                style={styles.roundAction}
              >
                <Ionicons color="#FFFFFF" name="shuffle" size={24} />
              </Pressable>
              <Pressable
                onPress={() => {
                  const first = data.tracks?.[0];
                  if (first) {
                    playTrack({
                      artist: first.artistName,
                      cover: first.coverArtUrl,
                      duration: toSeconds(first.duration),
                      id: first.id,
                      src:
                        resolveApiUrl(first.playbackUrl ?? first.previewUrl) ??
                        "",
                      title: first.title,
                      trackHref: `/tracks/${first.id}`,
                    });
                  }
                }}
                style={styles.primaryAction}
              >
                <Ionicons color="#09090B" name="play" size={16} />
                <Text style={styles.primaryActionText}>Play</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Add project to queue"
                accessibilityRole="button"
                onPress={() => {
                  for (const track of data.tracks ?? []) {
                    const playerTrack: PlayerTrack = {
                      artist: track.artistName,
                      cover: track.coverArtUrl,
                      duration: toSeconds(track.duration),
                      id: track.id,
                      src:
                        resolveApiUrl(track.playbackUrl ?? track.previewUrl) ??
                        "",
                      title: track.title,
                      trackHref: `/tracks/${track.id}`,
                    };
                    addToQueue(playerTrack);
                  }
                }}
                style={styles.roundAction}
              >
                <Ionicons color="#FFFFFF" name="add" size={28} />
              </Pressable>
            </View>
            <View style={styles.section}>
              <Text style={styles.sectionHeading}>
                TRACKLIST ({data.tracks?.length ?? 0} SONGS)
              </Text>
              <View style={styles.trackList}>
                {(data.tracks ?? []).map((track) => (
                  <Pressable
                    key={track.id}
                    onPress={() => {
                      playTrack({
                        artist: track.artistName,
                        cover: track.coverArtUrl,
                        duration: toSeconds(track.duration),
                        id: track.id,
                        src:
                          resolveApiUrl(
                            track.playbackUrl ?? track.previewUrl
                          ) ?? "",
                        title: track.title,
                        trackHref: `/tracks/${track.id}`,
                      });
                    }}
                    style={styles.trackRow}
                  >
                    <Text style={styles.trackIndex}>
                      {(data.tracks ?? []).indexOf(track) + 1}
                    </Text>
                    <View style={styles.trackCopy}>
                      <Text numberOfLines={1} style={styles.trackTitle}>
                        {track.title}
                      </Text>
                      <Text style={styles.trackMeta}>
                        {track.genre ?? data.artistName ?? "SoundKit artist"}
                      </Text>
                    </View>
                    <Ionicons color="#F8F8F8" name="play" size={14} />
                    <Pressable
                      accessibilityLabel={`More actions for ${track.title}`}
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() => {
                        setMenuTrack(track);
                        setIsMenuVisible(true);
                      }}
                    >
                      <Ionicons
                        color="#8F8F8F"
                        name="ellipsis-horizontal"
                        size={18}
                      />
                    </Pressable>
                  </Pressable>
                ))}
                {(data.tracks ?? []).length === 0 ? (
                  <Text style={{ color: theme.mutedText, fontSize: 13 }}>
                    No tracks published in this project yet.
                  </Text>
                ) : null}
              </View>
            </View>
            {moreFromArtist.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionHeading}>MORE FROM THIS ARTIST</Text>
                <ScrollView
                  contentContainerStyle={styles.relatedRail}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                >
                  {moreFromArtist.map((artistTrack) => (
                    <TrackCard key={artistTrack.id} track={artistTrack} />
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
      <Modal
        animationType="none"
        onRequestClose={() => {
          setMenuTrack(null);
          setIsMenuVisible(false);
        }}
        transparent
        visible={isMenuVisible}
      >
        <Animated.View
          entering={FadeIn.duration(180)}
          style={styles.sheetBackdrop}
        >
          <Pressable
            accessibilityLabel="Close actions"
            onPress={() => {
              setMenuTrack(null);
              setIsMenuVisible(false);
            }}
            style={styles.sheetScrim}
          />
          <Animated.View
            entering={FadeInDown.springify().damping(18).stiffness(180)}
            exiting={FadeOut.duration(140)}
            style={styles.sheet}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>
              {menuTrack?.title ?? data?.title ?? "Project actions"}
            </Text>
            <Text style={styles.sheetSubtitle}>
              {menuTrack ? "Track actions" : "Release actions"}
            </Text>
            <View style={styles.sheetTopActions}>
              <ActionSheetTopAction
                icon="add-circle-outline"
                label="Add"
                onPress={() => {
                  if (menuTrack) {
                    addToQueue(toPlayerTrack(menuTrack));
                  } else {
                    for (const track of data?.tracks ?? []) {
                      addToQueue(toPlayerTrack(track));
                    }
                  }
                  setMenuTrack(null);
                  setIsMenuVisible(false);
                }}
              />
              <ActionSheetTopAction
                icon={isFavorite ? "heart" : "heart-outline"}
                label={isFavorite ? "Favorited" : "Favorite"}
                onPress={() => {
                  setIsFavorite((value) => !value);
                  setMenuTrack(null);
                  setIsMenuVisible(false);
                }}
              />
              <ActionSheetTopAction
                icon="share-outline"
                label="Share"
                onPress={() => {
                  void Share.share({
                    message: `Listen to ${menuTrack?.title ?? data?.title ?? "this release"} on SoundKit.`,
                  });
                  setMenuTrack(null);
                  setIsMenuVisible(false);
                }}
              />
            </View>
            <ActionSheetRow
              icon="list-outline"
              label="Add to Playlist"
              onPress={() => {
                setMenuTrack(null);
                setIsMenuVisible(false);
                router.push(session ? "/library/playlists" : "/(auth)/login");
              }}
            />
            <ActionSheetRow
              icon="add-circle-outline"
              label="Add to Queue"
              onPress={() => {
                if (menuTrack) {
                  addToQueue(toPlayerTrack(menuTrack));
                }
                setMenuTrack(null);
                setIsMenuVisible(false);
              }}
            />
          </Animated.View>
        </Animated.View>
      </Modal>
    </>
  );
}

type ProjectTrack = NonNullable<PublicProjectDetail["tracks"]>[number];

const toPlayerTrack = (track: ProjectTrack): PlayerTrack => ({
  artist: track.artistName,
  cover: track.coverArtUrl,
  duration: toSeconds(track.duration),
  id: track.id,
  src: resolveApiUrl(track.playbackUrl ?? track.previewUrl) ?? "",
  title: track.title,
  trackHref: `/tracks/${track.id}`,
});

function ActionSheetRow({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.sheetRow}>
      <Ionicons color="#B8A3FF" name={icon} size={22} />
      <Text style={styles.sheetRowText}>{label}</Text>
      <Ionicons color="#666666" name="chevron-forward" size={18} />
    </Pressable>
  );
}

function ActionSheetTopAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={styles.sheetTopAction}
    >
      <Ionicons color="#FFFFFF" name={icon} size={26} />
      <Text style={styles.sheetTopActionText}>{label}</Text>
    </Pressable>
  );
}
