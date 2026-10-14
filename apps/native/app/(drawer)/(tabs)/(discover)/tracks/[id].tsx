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

import { Container } from "@/components/container";
import { NativeEmptyState } from "@/components/native-collection-grid";
import { NativeImage } from "@/components/native-image";
import { useAudioPlayerContext } from "@/contexts/audio-player-context";
import { useCart } from "@/contexts/cart-context";
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

export default function TrackDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    track = useTrackQuery(id ?? ""),
    { data } = track,
    [isSaved, setIsSaved] = useState(false),
    { addToQueue, playTrack } = useAudioPlayerContext(),
    { addItem } = useCart(),
    rawArtist =
      data && "artist" in data
        ? (data.artist as {
            avatarUrl?: string | null;
            handle?: string;
            name?: string;
            verified?: boolean;
          })
        : undefined,
    artistName =
      (typeof rawArtist?.name === "string" && rawArtist.name.length > 0
        ? rawArtist.name
        : undefined) ??
      (data &&
      "artistName" in data &&
      typeof data.artistName === "string" &&
      data.artistName.length > 0
        ? data.artistName
        : "SoundKit Artist"),
    artistUsername =
      (typeof rawArtist?.handle === "string" && rawArtist.handle.length > 0
        ? rawArtist.handle
        : undefined) ??
      (data &&
      "artistUsername" in data &&
      typeof data.artistUsername === "string" &&
      data.artistUsername.length > 0
        ? data.artistUsername
        : null),
    isArtistVerified =
      typeof rawArtist?.verified === "boolean"
        ? rawArtist.verified
        : Boolean(data && "verified" in data && data.verified),
    relatedQuery = useTracksQuery({
      limit: 100,
      region: "all",
      regionType: "global",
      scope: "public",
      sort: "title-desc",
    }),
    relatedTracks = useMemo(() => {
      if (artistUsername == null || data?.id == null) {
        return [];
      }
      return (relatedQuery.data ?? [])
        .filter(
          (item) =>
            item.id !== data.id && item.artistUsername === artistUsername
        )
        .toSorted(
          (a, b) =>
            new Date(b.updatedAt ?? 0).getTime() -
            new Date(a.updatedAt ?? 0).getTime()
        )
        .slice(0, RELATED_ARTIST_LIMIT);
    }, [artistUsername, data?.id, relatedQuery.data]);

  if (track.isLoading) {
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

  if (data == null) {
    return (
      <>
        <Stack.Screen
          options={{
            headerBackTitle: "Back",
            headerShown: true,
            headerStyle: { backgroundColor: theme.background },
            headerTintColor: theme.text,
            title: "Track Not Found",
          }}
        />
        <Container>
          <NativeEmptyState>
            We couldn&apos;t find a track with that ID.
          </NativeEmptyState>
        </Container>
      </>
    );
  }

  const playbackSrc = resolveApiUrl(
      data.playbackUrl ?? data.previewUrl ?? null
    ),
    canPlay = playbackSrc != null,
    playerTrack: PlayerTrack = {
      artist: artistName,
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
    isPurchasable =
      data.isForSale ||
      ("isPurchasable" in data && Boolean(data.isPurchasable)),
    priceCents =
      typeof data.priceCents === "number"
        ? data.priceCents
        : typeof data.price === "number"
          ? Math.round(data.price * 100)
          : null,
    priceLabel =
      ("priceLabel" in data && typeof data.priceLabel === "string"
        ? data.priceLabel
        : null) ??
      (typeof priceCents === "number"
        ? `$${(priceCents / 100).toFixed(2)}`
        : "$1.99");

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
          {/* Centered Hero matching Screenshot */}
          <View style={styles.heroCenter}>
            <View style={styles.coverLarge}>
              <NativeImage
                source={data.coverArtUrl ?? undefined}
                style={styles.coverLargeImage}
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
                    styles.playCircleOverlay,
                    pressed && { opacity: 0.85, transform: [{ scale: 0.94 }] },
                  ]}
                >
                  <Ionicons
                    color="#000000"
                    name="play"
                    size={28}
                    style={{ marginLeft: 3 }}
                  />
                </Pressable>
              ) : null}
            </View>

            <View style={styles.heroMetaCenter}>
              <View style={styles.typePill}>
                <Text style={styles.typePillText}>
                  {typeLabel.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.titleLarge}>{data.title.toUpperCase()}</Text>
              {artistUsername ? (
                <Link href={`/artist/${artistUsername}` as never} asChild>
                  <Pressable style={styles.artistRow}>
                    <Text style={styles.artistNameLarge}>
                      {artistName.toUpperCase()}
                    </Text>
                    {isArtistVerified ? (
                      <Ionicons
                        color="#B8A3FF"
                        name="checkmark-circle"
                        size={17}
                      />
                    ) : null}
                  </Pressable>
                </Link>
              ) : (
                <View style={styles.artistRow}>
                  <Text style={styles.artistNameLarge}>
                    {artistName.toUpperCase()}
                  </Text>
                  {isArtistVerified ? (
                    <Ionicons
                      color="#B8A3FF"
                      name="checkmark-circle"
                      size={17}
                    />
                  ) : null}
                </View>
              )}
            </View>
          </View>

          {/* Action row centered */}
          <View style={styles.actionRowCenter}>
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
                styles.playPrimaryBtn,
                !canPlay && styles.actionDisabled,
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
            >
              <Ionicons color="#000000" name="play" size={18} />
              <Text style={styles.playPrimaryBtnText}>PLAY</Text>
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
                styles.queueBtn,
                !canPlay && styles.actionDisabled,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Ionicons color="#FFFFFF" name="add" size={18} />
              <Text style={styles.queueBtnText}>QUEUE</Text>
            </Pressable>

            {isPurchasable && priceCents !== null ? (
              <Pressable
                accessibilityHint="Adds to cart and opens checkout"
                accessibilityLabel={`Buy for ${priceLabel}`}
                accessibilityRole="button"
                onPress={() => {
                  addItem({
                    artistName,
                    coverArtUrl: data.coverArtUrl,
                    id: data.id,
                    priceCents: priceCents ?? 199,
                    purchaseMode: "digital_release",
                    title: data.title,
                  });
                }}
                style={({ pressed }) => [
                  styles.queueBtn,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Ionicons color="#FFFFFF" name="bag-handle-outline" size={17} />
                <Text style={styles.queueBtnText}>BUY {priceLabel}</Text>
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
                styles.heartRoundBtn,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Ionicons
                color={isSaved ? "#E05D4D" : "#FFFFFF"}
                name={isSaved ? "heart" : "heart-outline"}
                size={20}
              />
            </Pressable>
          </View>

          {/* RUNTIME */}
          <View style={styles.runtimeBlock}>
            <Text style={styles.sectionEyebrow}>RUNTIME</Text>
            <Text style={styles.runtimeValue}>{data.duration ?? "2:57"}</Text>
          </View>

          {/* INCLUDED FILES */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionEyebrow}>INCLUDED FILES</Text>
            <View style={styles.includedFilesCard}>
              {data.assets && data.assets.length > 0 ? (
                data.assets.map((asset, idx) => {
                  const rawAsset = asset as Record<string, unknown>,
                    assetKind =
                      typeof rawAsset.assetKind === "string"
                        ? rawAsset.assetKind
                        : typeof rawAsset.kind === "string"
                          ? rawAsset.kind
                          : "master",
                    assetFileName =
                      typeof rawAsset.fileName === "string"
                        ? rawAsset.fileName
                        : typeof rawAsset.objectKey === "string"
                          ? rawAsset.objectKey.split("/").pop()
                          : null,
                    downloadUrl = asset.downloadUrl
                      ? resolveApiUrl(asset.downloadUrl)
                      : null;
                  return (
                    <View
                      key={asset.id}
                      style={[styles.fileRow, idx > 0 && styles.fileRowBorder]}
                    >
                      <View style={styles.fileIconBadge}>
                        <Ionicons
                          color="#8F8F8F"
                          name={assetIconFor(assetKind)}
                          size={18}
                        />
                      </View>
                      <View style={styles.fileInfo}>
                        <Text numberOfLines={1} style={styles.fileName}>
                          {(
                            assetFileName ??
                            `${data.title.replaceAll(/\s+/gu, "-").toUpperCase()}.${assetKind.toLowerCase()}`
                          ).toUpperCase()}
                        </Text>
                        <Text style={styles.fileType}>
                          {assetKind.replaceAll("_", " ").toUpperCase()}
                        </Text>
                      </View>
                      {downloadUrl ? (
                        <Pressable
                          accessibilityLabel={`Download ${assetKind}`}
                          accessibilityRole="button"
                          onPress={() => {
                            void Linking.openURL(downloadUrl);
                          }}
                          style={styles.fileDownloadBtn}
                        >
                          <Ionicons
                            color="#FFFFFF"
                            name="download-outline"
                            size={18}
                          />
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })
              ) : (
                <>
                  <View style={styles.fileRow}>
                    <View style={styles.fileIconBadge}>
                      <Ionicons
                        color="#8F8F8F"
                        name="image-outline"
                        size={18}
                      />
                    </View>
                    <View style={styles.fileInfo}>
                      <Text numberOfLines={1} style={styles.fileName}>
                        {data.title.replaceAll(/\s+/gu, "-").toUpperCase()}
                        -COVER.JPG
                      </Text>
                      <Text style={styles.fileType}>IMAGE/JPEG</Text>
                    </View>
                    <Pressable
                      accessibilityLabel="Download cover image"
                      accessibilityRole="button"
                      onPress={() => {
                        if (data.coverArtUrl) {
                          void Linking.openURL(data.coverArtUrl);
                        }
                      }}
                      style={styles.fileDownloadBtn}
                    >
                      <Ionicons
                        color="#FFFFFF"
                        name="download-outline"
                        size={18}
                      />
                    </Pressable>
                  </View>

                  <View style={[styles.fileRow, styles.fileRowBorder]}>
                    <View style={styles.fileIconBadge}>
                      <Ionicons
                        color="#8F8F8F"
                        name="musical-notes-outline"
                        size={18}
                      />
                    </View>
                    <View style={styles.fileInfo}>
                      <Text numberOfLines={1} style={styles.fileName}>
                        {data.title.replaceAll(/\s+/gu, "-").toUpperCase()}.WAV
                      </Text>
                      <Text style={styles.fileType}>AUDIO/WAV</Text>
                    </View>
                    <Pressable
                      accessibilityLabel="Download audio track"
                      accessibilityRole="button"
                      onPress={() => {
                        if (playbackSrc) {
                          void Linking.openURL(playbackSrc);
                        }
                      }}
                      style={styles.fileDownloadBtn}
                    >
                      <Ionicons
                        color="#FFFFFF"
                        name="download-outline"
                        size={18}
                      />
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          </View>

          {/* MORE FROM THIS ARTIST */}
          {relatedTracks.length > 0 ? (
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionEyebrow}>MORE FROM THIS ARTIST</Text>
                {artistUsername ? (
                  <Link href={`/artist/${artistUsername}` as never} asChild>
                    <Pressable>
                      <Text style={styles.viewAllText}>View All →</Text>
                    </Pressable>
                  </Link>
                ) : null}
              </View>
              <ScrollView
                contentContainerStyle={styles.relatedRow}
                horizontal
                showsHorizontalScrollIndicator={false}
              >
                {relatedTracks.map((item) => (
                  <Link
                    asChild
                    href={`/tracks/${item.id}` as never}
                    key={item.id}
                  >
                    <Pressable style={styles.relatedCard}>
                      <View style={styles.relatedCover}>
                        <NativeImage
                          source={item.coverArtUrl ?? undefined}
                          style={styles.relatedImage}
                        />
                        <View style={styles.relatedPlayPill}>
                          <Text style={styles.relatedPlayText}>Play</Text>
                        </View>
                      </View>
                      <Text numberOfLines={1} style={styles.relatedTitle}>
                        {item.title}
                      </Text>
                      <Text numberOfLines={1} style={styles.relatedArtist}>
                        {item.artistName}
                      </Text>
                    </Pressable>
                  </Link>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {/* CREDITS */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionEyebrow}>CREDITS</Text>
            <Text style={styles.creditCategory}>SONGWRITING</Text>
            <View style={styles.creditCardBox}>
              <Text style={styles.creditCardRole}>Written by</Text>
              <Text style={styles.creditCardName}>{artistName}</Text>
            </View>
          </View>
        </ScrollView>
      </Container>
    </>
  );
}

const styles = StyleSheet.create({
  actionDisabled: { opacity: 0.4 },
  actionRowCenter: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
  },
  artistNameLarge: {
    color: "#B8A3FF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  artistRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  content: {
    gap: 28,
    paddingBottom: 56,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  coverLarge: {
    aspectRatio: 1,
    borderRadius: 18,
    maxWidth: 320,
    overflow: "hidden",
    position: "relative",
    width: "100%",
  },
  coverLargeImage: {
    backgroundColor: "#0B0B0B",
    height: "100%",
    width: "100%",
  },
  creditCardBox: {
    backgroundColor: "#060606",
    borderColor: "#212121",
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
    padding: 16,
  },
  creditCardName: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  creditCardRole: {
    color: "#8F8F8F",
    fontSize: 12,
  },
  creditCategory: {
    color: "#8F8F8F",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  fileDownloadBtn: {
    alignItems: "center",
    backgroundColor: "#161616",
    borderRadius: 10,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  fileIconBadge: {
    alignItems: "center",
    backgroundColor: "#111111",
    borderRadius: 10,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  fileInfo: {
    flex: 1,
    gap: 2,
  },
  fileName: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  fileRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  fileRowBorder: {
    borderTopColor: "#1e1e1e",
    borderTopWidth: 1,
  },
  fileType: {
    color: "#8F8F8F",
    fontSize: 11,
    fontWeight: "600",
  },
  heartRoundBtn: {
    alignItems: "center",
    backgroundColor: "#111111",
    borderColor: "#212121",
    borderRadius: 999,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  heroCenter: {
    alignItems: "center",
    gap: 16,
  },
  heroMetaCenter: {
    alignItems: "center",
    gap: 8,
  },
  includedFilesCard: {
    backgroundColor: "#060606",
    borderColor: "#212121",
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  loaderWrap: {
    marginTop: 48,
  },
  playCircleOverlay: {
    alignItems: "center",
    backgroundColor: "#B8A3FF",
    borderRadius: 999,
    height: 60,
    justifyContent: "center",
    left: "50%",
    marginLeft: -30,
    marginTop: -30,
    position: "absolute",
    top: "50%",
    width: 60,
  },
  playPrimaryBtn: {
    alignItems: "center",
    backgroundColor: "#B8A3FF",
    borderRadius: 999,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  playPrimaryBtnText: {
    color: "#000000",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  queueBtn: {
    alignItems: "center",
    backgroundColor: "#111111",
    borderColor: "#212121",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  queueBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  relatedArtist: {
    color: "#8F8F8F",
    fontSize: 12,
  },
  relatedCard: {
    width: 140,
  },
  relatedCover: {
    aspectRatio: 1,
    borderRadius: 14,
    marginBottom: 8,
    overflow: "hidden",
    position: "relative",
    width: 140,
  },
  relatedImage: {
    height: "100%",
    width: "100%",
  },
  relatedPlayPill: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    position: "absolute",
    right: 6,
    top: 6,
  },
  relatedPlayText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  relatedRow: {
    gap: 14,
    paddingRight: 20,
  },
  relatedTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  runtimeBlock: {
    gap: 4,
  },
  runtimeValue: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
  },
  sectionBlock: {
    gap: 12,
  },
  sectionEyebrow: {
    color: "#8F8F8F",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  sectionHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  titleLarge: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.5,
    textAlign: "center",
  },
  typePill: {
    backgroundColor: "rgba(184, 163, 255, 0.14)",
    borderColor: "rgba(184, 163, 255, 0.3)",
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  typePillText: {
    color: "#B8A3FF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  viewAllText: {
    color: "#B8A3FF",
    fontSize: 13,
    fontWeight: "700",
  },
});
