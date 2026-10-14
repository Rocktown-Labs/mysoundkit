/* eslint-disable one-var, sort-vars, sort-keys, no-nested-ternary, complexity, eqeqeq, no-eq-null, react/preserve-manual-memoization, no-negated-condition */
import { Ionicons } from "@expo/vector-icons";
import { Link, useLocalSearchParams, Stack } from "expo-router";
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

import { TrackCard } from "@/components/cards/track-card";
import { Container } from "@/components/container";
import { NativeEmptyState } from "@/components/native-collection-grid";
import { NativeImage } from "@/components/native-image";
import { NativeRail } from "@/components/native-rail";
import { NativeSection } from "@/components/native-section";
import { useAudioPlayerContext } from "@/contexts/audio-player-context";
import { NAV_THEME } from "@/lib/constants";
import type { PlayerTrack } from "@/lib/player-queue";
import {
  resolveApiUrl,
  useTrackQuery,
  useTracksQuery,
} from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

const RELATED_ARTIST_LIMIT = 5;

const assetIconFor = (assetKind: string): keyof typeof Ionicons.glyphMap => {
  const kind = assetKind.toLowerCase();
  if (kind.includes("stem") || kind.includes("session")) {
    return "layers-outline";
  }
  if (kind.includes("midi")) {
    return "cube-outline";
  }
  if (kind.includes("image") || kind.includes("art")) {
    return "image-outline";
  }
  if (kind.includes("license") || kind.includes("contract")) {
    return "shield-checkmark-outline";
  }
  if (kind.includes("booklet") || kind.includes("document")) {
    return "document-text-outline";
  }
  return "musical-notes-outline";
};

const formatBytes = (bytes?: null | number): null | string => {
  if (bytes == null) {
    return null;
  }
  if (bytes >= 1_000_000) {
    return `${(bytes / 1_000_000).toFixed(1)} MB`;
  }
  if (bytes >= 1000) {
    return `${(bytes / 1000).toFixed(0)} KB`;
  }
  return `${bytes} B`;
};

const creditGroupFor = (
  role: string
): { icon: keyof typeof Ionicons.glyphMap; title: string } => {
  const normalized = role.toLowerCase();
  if (/vocal|artist|perform/u.test(normalized)) {
    return { icon: "mic-outline", title: "Performance" };
  }
  if (/songwrit|writer|lyric/u.test(normalized)) {
    return { icon: "create-outline", title: "Songwriting" };
  }
  if (/produc|engineer|mix|master/u.test(normalized)) {
    return { icon: "settings-outline", title: "Production" };
  }
  return { icon: "people-outline", title: "Credits" };
};

export default function TrackDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    track = useTrackQuery(id ?? ""),
    { data } = track,
    [isSaved, setIsSaved] = useState(false),
    { addToQueue, playTrack } = useAudioPlayerContext(),
    relatedQuery = useTracksQuery({
      limit: 100,
      region: "all",
      regionType: "global",
      scope: "public",
      sort: "title-desc",
    }),
    relatedTracks = useMemo(() => {
      if (data?.artistUsername == null) {
        return [];
      }
      return (relatedQuery.data ?? [])
        .filter(
          (item) =>
            item.id !== data.id && item.artistUsername === data.artistUsername
        )
        .toSorted(
          (a, b) =>
            new Date(b.updatedAt ?? 0).getTime() -
            new Date(a.updatedAt ?? 0).getTime()
        )
        .slice(0, RELATED_ARTIST_LIMIT);
    }, [data?.artistUsername, data?.id, relatedQuery.data]);

  if (track.isLoading || data == null) {
    return (
      <>
        <Stack.Screen
          options={{
            headerBackTitle: "Back",
            headerShown: true,
            headerStyle: { backgroundColor: theme.background },
            headerTintColor: theme.text,
            title: "Track",
          }}
        />
        <Container>
          <ActivityIndicator color={theme.primary} style={styles.loaderWrap} />
        </Container>
      </>
    );
  }

  const playbackSrc = resolveApiUrl(
      data.playbackUrl ?? data.previewUrl ?? null
    ),
    canPlay = playbackSrc != null,
    playerTrack: PlayerTrack = {
      artist: data.artistName,
      cover: data.coverArtUrl ?? null,
      duration: null,
      id: data.id,
      src: playbackSrc ?? "",
      title: data.title,
      trackHref: `/tracks/${data.id}`,
    },
    typeLabel = data.catalogItemType
      ? data.catalogItemType.replaceAll("_", " ")
      : "Single",
    streamingEntries = data.streamingLinks
      ? (
          [
            {
              icon: "logo-apple",
              label: "Apple Music",
              url: data.streamingLinks.appleMusic,
            },
            {
              icon: "musical-notes",
              label: "Spotify",
              url: data.streamingLinks.spotify,
            },
            {
              icon: "logo-youtube",
              label: "YouTube",
              url: data.streamingLinks.youtube,
            },
          ] as const
        ).filter((entry) => entry.url != null)
      : [];

  return (
    <>
      <Stack.Screen
        options={{
          headerBackTitle: "Catalog",
          headerShown: true,
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          title: data.title,
        }}
      />
      <Container>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          style={{ backgroundColor: theme.background }}
        >
          {/* Hero */}
          <View style={styles.heroRow}>
            <View style={styles.cover}>
              <NativeImage
                source={data.coverArtUrl ?? undefined}
                style={styles.coverImage}
              />
              {canPlay ? (
                <Pressable
                  accessibilityLabel="Play track"
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => {
                    playTrack(playerTrack);
                  }}
                  style={({ pressed }) => [
                    styles.playOverlay,
                    pressed && { opacity: 0.8, transform: [{ scale: 0.94 }] },
                  ]}
                >
                  <Ionicons color="#FFFFFF" name="play" size={26} />
                </Pressable>
              ) : null}
            </View>

            <View style={styles.heroInfo}>
              <View style={styles.badgeRow}>
                <View style={styles.typePill}>
                  <Text style={styles.typePillText}>{typeLabel}</Text>
                </View>
                <View style={styles.verifiedPill}>
                  <Ionicons color="#FFFFFF" name="checkmark" size={11} />
                  <Text style={styles.verifiedPillText}>Verified</Text>
                </View>
              </View>
              <Text style={styles.title}>{data.title}</Text>
              {data.artistUsername ? (
                <Link href={`/artist/${data.artistUsername}` as never} asChild>
                  <Text style={styles.artistLink}>{data.artistName}</Text>
                </Link>
              ) : (
                <Text style={styles.artistLink}>{data.artistName}</Text>
              )}
              <View style={styles.genrePillRow}>
                <View style={styles.genrePill}>
                  <Text style={styles.genrePillText}>{data.genre}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Action row */}
          <View style={styles.actionRow}>
            <Pressable
              accessibilityLabel={
                canPlay ? "Plays track" : "Playback unavailable"
              }
              accessibilityRole="button"
              disabled={!canPlay}
              onPress={() => {
                playTrack(playerTrack);
              }}
              style={({ pressed }) => [
                styles.playButton,
                !canPlay && styles.actionDisabled,
                pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
              ]}
            >
              <Ionicons color={theme.primaryForeground} name="play" size={17} />
              <Text
                style={[
                  styles.playButtonText,
                  { color: theme.primaryForeground },
                ]}
              >
                Play
              </Text>
            </Pressable>
            <Pressable
              accessibilityHint="Adds track to the Up Next queue"
              accessibilityLabel="Queue"
              accessibilityRole="button"
              disabled={!canPlay}
              onPress={() => {
                addToQueue(playerTrack);
              }}
              style={({ pressed }) => [
                styles.secondaryButton,
                !canPlay && styles.actionDisabled,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Ionicons color="#F8F8F8" name="list-outline" size={17} />
              <Text style={styles.secondaryButtonText}>Queue</Text>
            </Pressable>
            {data.isForSale && data.price != null ? (
              <Pressable
                accessibilityHint="Opens purchase flow"
                accessibilityLabel={`Buy for ${data.price}`}
                accessibilityRole="button"
                onPress={() => {
                  // Purchase flow lands with the storefront phase.
                }}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Ionicons color="#F8F8F8" name="bag-outline" size={17} />
                <Text style={styles.secondaryButtonText}>
                  Buy ${data.price}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityHint={isSaved ? "Removes from saved" : "Saves track"}
              accessibilityLabel={isSaved ? "Saved" : "Save"}
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => {
                setIsSaved((prev) => !prev);
              }}
              style={({ pressed }) => [
                styles.iconButton,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Ionicons
                color={isSaved ? "#B8A3FF" : "#8F8F8F"}
                name={isSaved ? "heart" : "heart-outline"}
                size={20}
              />
            </Pressable>
          </View>

          {/* Metadata grid */}
          <View style={styles.metaGrid}>
            <MetaChip label="Streams" value={data.plays.toLocaleString()} />
            {data.bpm == null ? null : (
              <MetaChip label="BPM" value={String(data.bpm)} />
            )}
            {data.musicalKey == null ? null : (
              <MetaChip label="Key" value={data.musicalKey} />
            )}
            <MetaChip label="Runtime" value={data.duration} />
          </View>

          {data.description ? (
            <Text style={styles.description}>{data.description}</Text>
          ) : null}

          {/* Included Files */}
          {data.assets.length > 0 ? (
            <NativeSection
              description="Files bundled with this release."
              title="Included Files"
            >
              <View style={styles.assetList}>
                {data.assets.map((asset) => {
                  const downloadUrl = asset.downloadUrl
                      ? resolveApiUrl(asset.downloadUrl)
                      : null,
                    sizeLabel = formatBytes(asset.sizeBytes);
                  return (
                    <View
                      key={asset.id}
                      style={[styles.assetRow, { borderColor: theme.border }]}
                    >
                      <View style={styles.assetIcon}>
                        <Ionicons
                          color="#B8A3FF"
                          name={assetIconFor(asset.assetKind)}
                          size={18}
                        />
                      </View>
                      <View style={styles.assetCopy}>
                        <Text style={styles.assetKind}>
                          {asset.assetKind.replaceAll("_", " ")}
                        </Text>
                        {sizeLabel ? (
                          <Text style={styles.assetSize}>{sizeLabel}</Text>
                        ) : null}
                      </View>
                      {downloadUrl ? (
                        <Pressable
                          accessibilityLabel={`Download ${asset.assetKind}`}
                          accessibilityRole="button"
                          hitSlop={6}
                          onPress={() => {
                            void Linking.openURL(downloadUrl);
                          }}
                          style={({ pressed }) => [
                            styles.assetDownload,
                            pressed && { opacity: 0.7 },
                          ]}
                        >
                          <Ionicons
                            color="#F8F8F8"
                            name="download-outline"
                            size={18}
                          />
                        </Pressable>
                      ) : (
                        <View style={styles.assetLocked}>
                          <Ionicons
                            color="#8F8F8F"
                            name="lock-closed-outline"
                            size={16}
                          />
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </NativeSection>
          ) : null}

          {/* Also on */}
          {streamingEntries.length > 0 ? (
            <NativeSection title="Also On">
              <View style={styles.streamingRow}>
                {streamingEntries.map((entry) => (
                  <Pressable
                    accessibilityLabel={`Listen on ${entry.label}`}
                    accessibilityRole="button"
                    hitSlop={6}
                    key={entry.label}
                    onPress={() => {
                      void Linking.openURL(entry.url as string);
                    }}
                    style={({ pressed }) => [
                      styles.streamingButton,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Ionicons color="#F8F8F8" name={entry.icon} size={18} />
                  </Pressable>
                ))}
              </View>
            </NativeSection>
          ) : null}

          {/* More from this artist */}
          {relatedTracks.length > 0 ? (
            <NativeSection
              description={`More from ${data.artistName}.`}
              title="More From This Artist"
            >
              <NativeRail>
                {relatedTracks.map((related) => (
                  <TrackCard key={related.id} track={related} />
                ))}
              </NativeRail>
            </NativeSection>
          ) : null}

          {/* Credits */}
          {data.collaborators.length > 0 ? (
            <NativeSection title="Credits">
              <View style={styles.creditGrid}>
                {data.collaborators.map((collaborator) => {
                  const group = creditGroupFor(collaborator.role ?? "");
                  return (
                    <View
                      key={collaborator.id}
                      style={[styles.creditChip, { borderColor: theme.border }]}
                    >
                      <Ionicons color="#B8A3FF" name={group.icon} size={14} />
                      <View style={styles.creditCopy}>
                        <Text style={styles.creditName}>
                          {collaborator.name ?? "Collaborator"}
                        </Text>
                        <Text style={styles.creditRole}>
                          {collaborator.role}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </NativeSection>
          ) : null}

          {data.assets.length === 0 &&
          relatedTracks.length === 0 &&
          data.collaborators.length === 0 &&
          data.description == null ? (
            <NativeEmptyState>
              Nothing else has been shared for this track yet.
            </NativeEmptyState>
          ) : null}
        </ScrollView>
      </Container>
    </>
  );
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaChip}>
      <Text style={styles.metaValue}>{value}</Text>
      <Text style={styles.metaLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  actionDisabled: { opacity: 0.4 },
  actionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  artistLink: { color: "#B8A3FF", fontSize: 15, fontWeight: "700" },
  assetCopy: { flex: 1, gap: 2 },
  assetDownload: {
    alignItems: "center",
    backgroundColor: "rgba(184, 163, 255, 0.14)",
    borderRadius: 10,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  assetIcon: {
    alignItems: "center",
    backgroundColor: "#111111",
    borderRadius: 10,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  assetKind: { color: "#F8F8F8", fontSize: 13, fontWeight: "700" },
  assetList: { gap: 8 },
  assetLocked: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 10,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  assetRow: {
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
  assetSize: { color: "#8F8F8F", fontSize: 11 },
  badgeRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  content: {
    gap: 24,
    paddingBottom: 48,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  cover: {
    aspectRatio: 1,
    borderRadius: 16,
    overflow: "hidden",
    width: 148,
  },
  coverImage: { backgroundColor: "#0B0B0B", height: "100%", width: "100%" },
  creditChip: {
    alignItems: "center",
    backgroundColor: "#060606",
    borderColor: "#212121",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    flexBasis: "47%",
    gap: 10,
    flexGrow: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  creditCopy: { flex: 1 },
  creditGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  creditName: { color: "#F8F8F8", fontSize: 13, fontWeight: "700" },
  creditRole: { color: "#8F8F8F", fontSize: 11, textTransform: "capitalize" },
  description: {
    color: "#F8F8F8",
    fontSize: 14,
    lineHeight: 20,
  },
  genrePill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(184, 163, 255, 0.14)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  genrePillRow: { marginTop: 2 },
  genrePillText: {
    color: "#B8A3FF",
    fontSize: 11,
    fontWeight: "700",
  },
  heroInfo: { flex: 1, gap: 5 },
  heroRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 16,
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderColor: "#212121",
    borderRadius: 12,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  loaderWrap: { marginTop: 48 },
  metaChip: {
    alignItems: "center",
    backgroundColor: "#060606",
    borderColor: "#212121",
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 10,
  },
  metaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metaLabel: { color: "#8F8F8F", fontSize: 11, fontWeight: "600" },
  metaValue: { color: "#F8F8F8", fontSize: 14, fontWeight: "800" },
  playButton: {
    alignItems: "center",
    backgroundColor: "#B8A3FF",
    borderRadius: 999,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  playButtonText: { fontSize: 14, fontWeight: "800" },
  playOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 999,
    bottom: 8,
    height: 44,
    justifyContent: "center",
    position: "absolute",
    right: 8,
    width: 44,
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderColor: "#212121",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  secondaryButtonText: { color: "#F8F8F8", fontSize: 13, fontWeight: "700" },
  streamingButton: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderColor: "#212121",
    borderRadius: 999,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  streamingRow: { flexDirection: "row", gap: 8 },
  title: {
    color: "#F8F8F8",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  typePill: {
    backgroundColor: "rgba(184, 163, 255, 0.14)",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  typePillText: {
    color: "#B8A3FF",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  verifiedPill: {
    alignItems: "center",
    backgroundColor: "#B8A3FF",
    borderRadius: 6,
    flexDirection: "row",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  verifiedPillText: {
    color: "#171717",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
});
