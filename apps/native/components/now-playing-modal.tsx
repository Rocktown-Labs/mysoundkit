/* eslint-disable one-var, sort-vars, sort-keys, react/capitalized-calls, react/immutability */
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NativeImage } from "@/components/native-image";
import { useAudioPlayerContext } from "@/contexts/audio-player-context";
import type { PlayerTrack, RepeatMode } from "@/contexts/audio-player-context";
import { NAV_THEME } from "@/lib/constants";
import { formatPlayerTime, formatRemainingTime } from "@/lib/player-queue";
import { useColorScheme } from "@/lib/use-color-scheme";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");

const styles = StyleSheet.create({
  actionBtn: {
    alignItems: "center",
    borderRadius: 999,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  activeLyricLine: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  artContainer: {
    alignItems: "center",
    alignSelf: "center",
    borderRadius: 20,
    elevation: 20,
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.55,
    shadowRadius: 28,
  },
  bottomActionsBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  centerStage: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingVertical: 12,
  },
  dragHandleBar: {
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 3,
    height: 5,
    width: 38,
  },
  dragHandleContainer: {
    alignItems: "center",
    height: 24,
    justifyContent: "center",
    width: "100%",
  },
  eyebrowText: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  headerBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  headerRight: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  inactiveLyricLine: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.3,
    lineHeight: 32,
  },
  lyricsContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 12,
    width: "100%",
  },
  lyricsScroll: {
    flex: 1,
    gap: 16,
  },
  mainContent: {
    flex: 1,
    justifyContent: "space-between",
  },
  playPauseBtn: {
    alignItems: "center",
    borderRadius: 999,
    height: 68,
    justifyContent: "center",
    width: 68,
  },
  queueBadge: {
    alignItems: "center",
    borderRadius: 999,
    height: 16,
    justifyContent: "center",
    minWidth: 16,
    paddingHorizontal: 4,
    position: "absolute",
    right: 2,
    top: 2,
  },
  queueBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
  },
  queueDrawer: {
    backgroundColor: "rgba(24, 24, 28, 0.96)",
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    bottom: 0,
    left: 0,
    maxHeight: "75%",
    paddingBottom: 24,
    position: "absolute",
    right: 0,
    zIndex: 50,
  },
  queueHeader: {
    alignItems: "center",
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  queueItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  queueItemArt: {
    borderRadius: 6,
    height: 42,
    overflow: "hidden",
    width: 42,
  },
  repeatBadge: {
    bottom: 6,
    color: "#B8A3FF",
    fontSize: 9,
    fontWeight: "900",
    position: "absolute",
    right: 8,
  },
  rootOverlay: {
    flex: 1,
  },
  scrubberContainer: {
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  scrubberHitArea: {
    height: 30,
    justifyContent: "center",
  },
  scrubberKnob: {
    backgroundColor: "#ffffff",
    borderRadius: 999,
    elevation: 3,
    height: 12,
    position: "absolute",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    top: -4,
    width: 12,
  },
  scrubberTimesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  scrubberTrack: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 2,
    height: 4,
    overflow: "visible",
    position: "relative",
    width: "100%",
  },
  scrubberTrackFill: {
    borderRadius: 2,
    height: "100%",
  },
  sheetContainer: {
    backgroundColor: "#101014",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    flex: 1,
    overflow: "hidden",
  },
  timeText: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    fontWeight: "500",
  },
  titleArtistRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 18,
    paddingHorizontal: 24,
    width: "100%",
  },
  trackArtist: {
    color: "#8F8F8F",
    fontSize: 17,
    fontWeight: "500",
    letterSpacing: -0.2,
  },
  trackTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  transportControlsRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  volumeRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 32,
    paddingVertical: 6,
  },
  volumeTrack: {
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    borderRadius: 2,
    flex: 1,
    height: 4,
    overflow: "hidden",
    position: "relative",
  },
  volumeTrackFill: {
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderRadius: 2,
    height: "100%",
  },
});

function NowPlayingHeader({ onDismiss }: { onDismiss: () => void }) {
  const [isFavorite, setIsFavorite] = useState(false);

  return (
    <View style={styles.headerBar}>
      <Pressable
        accessibilityHint="Dismisses now playing view"
        accessibilityLabel="Dismiss"
        accessibilityRole="button"
        hitSlop={12}
        onPress={onDismiss}
        style={styles.actionBtn}
      >
        <Ionicons color="#f4f4f5" name="chevron-down" size={26} />
      </Pressable>

      <Text style={styles.eyebrowText}>Playing from SoundKit</Text>

      <View style={styles.headerRight}>
        <Pressable
          accessibilityHint="Toggles favorite"
          accessibilityLabel="Favorite"
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setIsFavorite((prev) => !prev);
          }}
          style={styles.actionBtn}
        >
          <Ionicons
            color={isFavorite ? "#ec4899" : "#f4f4f5"}
            name={isFavorite ? "star" : "star-outline"}
            size={22}
          />
        </Pressable>

        <Pressable
          accessibilityHint="More options"
          accessibilityLabel="Options"
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          style={styles.actionBtn}
        >
          <Ionicons color="#f4f4f5" name="ellipsis-horizontal" size={22} />
        </Pressable>
      </View>
    </View>
  );
}

function NowPlayingLyricsView({
  displayPosition,
  lyricLines,
}: {
  displayPosition: number;
  lyricLines: string[];
}) {
  return (
    <View style={styles.lyricsContainer}>
      <ScrollView
        contentContainerStyle={styles.lyricsScroll}
        showsVerticalScrollIndicator={false}
      >
        {lyricLines.map((line, index) => {
          const isActive =
            index === 0 ||
            (displayPosition > 15 && index === 1) ||
            (displayPosition > 35 && index === 2);
          return (
            <Text
              key={`lyric-${line}`}
              style={
                isActive ? styles.activeLyricLine : styles.inactiveLyricLine
              }
            >
              {line}
            </Text>
          );
        })}
      </ScrollView>
    </View>
  );
}

function NowPlayingArtworkView({
  artSize,
  currentTrack,
}: {
  artSize: number;
  currentTrack: PlayerTrack;
}) {
  return (
    <View style={[styles.artContainer, { height: artSize, width: artSize }]}>
      {currentTrack.cover ? (
        <NativeImage
          accessibilityLabel={`${currentTrack.title} cover`}
          source={currentTrack.cover}
          style={{ height: "100%", width: "100%" }}
        />
      ) : (
        <View
          style={{
            alignItems: "center",
            backgroundColor: "#212121",
            height: "100%",
            justifyContent: "center",
            width: "100%",
          }}
        >
          <Ionicons color="#B8A3FF" name="musical-notes" size={64} />
        </View>
      )}
    </View>
  );
}

function NowPlayingScrubber({
  displayPosition,
  displayProgress,
  duration,
  onSeekRelease,
  onSeekTouch,
  onTrackLayout,
}: {
  displayPosition: number;
  displayProgress: number;
  duration: number;
  onSeekRelease: () => void;
  onSeekTouch: (x: number) => void;
  onTrackLayout: (width: number) => void;
}) {
  return (
    <View style={styles.scrubberContainer}>
      <View
        onLayout={(e) => {
          onTrackLayout(e.nativeEvent.layout.width);
        }}
        onResponderGrant={(e) => {
          onSeekTouch(e.nativeEvent.locationX);
        }}
        onResponderMove={(e) => {
          onSeekTouch(e.nativeEvent.locationX);
        }}
        onResponderRelease={onSeekRelease}
        onStartShouldSetResponder={() => true}
        style={styles.scrubberHitArea}
      >
        <View style={styles.scrubberTrack}>
          <View
            style={[
              styles.scrubberTrackFill,
              {
                backgroundColor: "#ffffff",
                width: `${displayProgress * 100}%`,
              },
            ]}
          />
          <View
            style={[
              styles.scrubberKnob,
              {
                left: `${displayProgress * 100}%`,
                marginLeft: -6,
              },
            ]}
          />
        </View>
      </View>

      <View style={styles.scrubberTimesRow}>
        <Text style={styles.timeText}>{formatPlayerTime(displayPosition)}</Text>
        <Text style={styles.timeText}>
          {formatRemainingTime(displayPosition, duration)}
        </Text>
      </View>
    </View>
  );
}

function NowPlayingTransportControls({
  isPlaying,
  isShuffle,
  nextTrack,
  previousTrack,
  repeatMode,
  togglePlay,
  toggleRepeat,
  toggleShuffle,
}: {
  isPlaying: boolean;
  isShuffle: boolean;
  nextTrack: () => void;
  previousTrack: () => void;
  repeatMode: RepeatMode;
  togglePlay: () => void;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
}) {
  return (
    <View style={styles.transportControlsRow}>
      {/* Shuffle */}
      <Pressable
        accessibilityHint="Toggles shuffle"
        accessibilityLabel="Shuffle"
        accessibilityRole="button"
        hitSlop={10}
        onPress={toggleShuffle}
        style={styles.actionBtn}
      >
        <Ionicons
          color={isShuffle ? "#B8A3FF" : "#f4f4f5"}
          name="shuffle"
          size={24}
        />
      </Pressable>

      {/* Previous */}
      <Pressable
        accessibilityHint="Restarts the track, or plays the previous one when pressed near the start"
        accessibilityLabel="Previous"
        accessibilityRole="button"
        hitSlop={10}
        onPress={previousTrack}
        style={styles.actionBtn}
      >
        <Ionicons color="#f4f4f5" name="play-skip-back-sharp" size={30} />
      </Pressable>

      {/* Play / Pause */}
      <Pressable
        accessibilityHint={isPlaying ? "Pauses playback" : "Starts playback"}
        accessibilityLabel={isPlaying ? "Pause" : "Play"}
        accessibilityRole="button"
        onPress={togglePlay}
        style={({ pressed }) => [
          styles.playPauseBtn,
          {
            backgroundColor: "#ffffff",
            opacity: pressed ? 0.8 : 1,
            transform: [{ scale: pressed ? 0.94 : 1 }],
          },
        ]}
      >
        <Ionicons
          color="#000000"
          name={isPlaying ? "pause" : "play"}
          size={34}
          style={isPlaying ? undefined : { marginLeft: 3 }}
        />
      </Pressable>

      {/* Next */}
      <Pressable
        accessibilityHint="Skips to next track"
        accessibilityLabel="Next"
        accessibilityRole="button"
        hitSlop={10}
        onPress={nextTrack}
        style={styles.actionBtn}
      >
        <Ionicons color="#f4f4f5" name="play-skip-forward-sharp" size={30} />
      </Pressable>

      {/* Repeat */}
      <Pressable
        accessibilityHint="Toggles repeat mode"
        accessibilityLabel="Repeat"
        accessibilityRole="button"
        hitSlop={10}
        onPress={toggleRepeat}
        style={styles.actionBtn}
      >
        <View style={{ position: "relative" }}>
          <Ionicons
            color={repeatMode === "off" ? "#f4f4f5" : "#B8A3FF"}
            name="repeat"
            size={24}
          />
          {repeatMode === "one" ? (
            <Text style={styles.repeatBadge}>1</Text>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

function NowPlayingQueueDrawer({
  clearQueue,
  onClose,
  playTrack,
  queue,
  removeFromQueue,
}: {
  clearQueue: () => void;
  onClose: () => void;
  playTrack: (t: PlayerTrack) => void;
  queue: PlayerTrack[];
  removeFromQueue: (id: string) => void;
}) {
  return (
    <View style={styles.queueDrawer}>
      <View style={styles.queueHeader}>
        <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "700" }}>
          Up Next ({queue.length})
        </Text>
        <View style={{ flexDirection: "row", gap: 12 }}>
          {queue.length > 0 ? (
            <Pressable accessibilityRole="button" onPress={clearQueue}>
              <Text
                style={{ color: "#ef4444", fontSize: 13, fontWeight: "600" }}
              >
                Clear
              </Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" onPress={onClose}>
            <Ionicons color="#f4f4f5" name="close" size={20} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={{ maxHeight: 320 }}
        showsVerticalScrollIndicator={true}
      >
        {queue.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 32 }}>
            <Text style={{ color: "#8F8F8F", fontSize: 13 }}>
              No tracks in queue. Play songs to build your mix.
            </Text>
          </View>
        ) : (
          queue.map((track) => (
            <Pressable
              key={track.id}
              onPress={() => {
                playTrack(track);
                onClose();
              }}
              style={({ pressed }) => [
                styles.queueItem,
                {
                  backgroundColor: pressed
                    ? "rgba(255, 255, 255, 0.06)"
                    : "transparent",
                },
              ]}
            >
              <View style={styles.queueItemArt}>
                {track.cover ? (
                  <NativeImage
                    source={track.cover}
                    style={{ height: "100%", width: "100%" }}
                  />
                ) : (
                  <View
                    style={{
                      alignItems: "center",
                      backgroundColor: "#212121",
                      height: "100%",
                      justifyContent: "center",
                      width: "100%",
                    }}
                  >
                    <Ionicons color="#8F8F8F" name="musical-notes" size={14} />
                  </View>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  numberOfLines={1}
                  style={{ color: "#ffffff", fontSize: 14, fontWeight: "600" }}
                >
                  {track.title}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{ color: "#8F8F8F", fontSize: 12 }}
                >
                  {track.artist}
                </Text>
              </View>
              <Pressable
                hitSlop={8}
                onPress={(e) => {
                  e.stopPropagation?.();
                  removeFromQueue(track.id);
                }}
              >
                <Ionicons
                  color="rgba(255, 255, 255, 0.4)"
                  name="close-circle-outline"
                  size={18}
                />
              </Pressable>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

/**
 * Apple Music-inspired full-screen Now Playing modal sheet.
 * Fluid gestures, ambient artwork backdrop, synced kinetic lyrics, timeline scrubber,
 * transport controls, volume control, and Up Next queue management.
 */
export function NowPlayingModal() {
  const {
    clearQueue,
    closeNowPlaying,
    currentTrack,
    duration,
    isLyricsVisible,
    isNowPlayingVisible,
    isPlaying,
    isQueueVisible,
    isShuffle,
    nextTrack,
    playbackPosition,
    playTrack,
    previousTrack,
    queue,
    removeFromQueue,
    repeatMode,
    seekTo,
    setIsQueueVisible,
    setVolume,
    toggleLyrics,
    togglePlay,
    toggleQueue,
    toggleRepeat,
    toggleShuffle,
    volume,
  } = useAudioPlayerContext();

  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;

  const [seekingPosition, setSeekingPosition] = useState<number | null>(null);
  const scrubberWidthRef = useRef<number>(SCREEN_WIDTH - 48);
  const volumeTrackWidthRef = useRef<number>(0);

  const translateY = useSharedValue(0);

  useEffect(() => {
    if (isNowPlayingVisible) {
      translateY.set(
        withSpring(0, {
          dampingRatio: 0.85,
          duration: 350,
        })
      );
    }
  }, [isNowPlayingVisible, translateY]);

  const handleDismiss = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    closeNowPlaying();
  }, [closeNowPlaying]);

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 0) {
        translateY.set(event.translationY);
      }
    })
    .onEnd((event) => {
      translateY.set(
        event.translationY > 160 || event.velocityY > 750
          ? withSpring(
              SCREEN_HEIGHT,
              { dampingRatio: 0.8, velocity: event.velocityY },
              () => {
                runOnJS(handleDismiss)();
              }
            )
          : withSpring(0, { dampingRatio: 0.85 })
      );
    });

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.get() }],
  }));

  if (!isNowPlayingVisible || !currentTrack) {
    return null;
  }

  const handleScrubberTouch = (x: number) => {
    const width = scrubberWidthRef.current || SCREEN_WIDTH - 48;
    const ratio = Math.max(0, Math.min(1, x / width));
    const targetSeconds = ratio * (duration || 1);
    setSeekingPosition(targetSeconds);
  };

  const handleScrubberRelease = () => {
    if (typeof seekingPosition === "number") {
      void seekTo(seekingPosition);
      setSeekingPosition(null);
    }
  };

  const handleVolumeTouch = (x: number) => {
    const width = volumeTrackWidthRef.current;
    if (width <= 0) {
      return;
    }
    setVolume(Math.max(0, Math.min(1, x / width)));
  };

  const displayPosition = seekingPosition ?? playbackPosition;
  const displayProgress =
    duration > 0 ? Math.min(1, Math.max(0, displayPosition / duration)) : 0;

  const artSize = Math.min(SCREEN_WIDTH - 64, SCREEN_HEIGHT * 0.36);

  const lyricLines = currentTrack.lyrics
    ? currentTrack.lyrics
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
    : [
        "No synced lyrics available for this release.",
        "Enjoy the music with SoundKit High-Fidelity Audio.",
      ];

  return (
    <Modal
      animationType="slide"
      hardwareAccelerated={true}
      onRequestClose={handleDismiss}
      statusBarTranslucent={true}
      transparent={true}
      visible={isNowPlayingVisible}
    >
      <View
        style={[styles.rootOverlay, { paddingTop: Math.max(12, insets.top) }]}
      >
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.sheetContainer, animatedSheetStyle]}>
            {/* Ambient background blur */}
            <BlurView
              intensity={90}
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: "rgba(16, 16, 20, 0.94)" },
              ]}
              tint="dark"
            />

            {/* Top drag handle */}
            <View style={styles.dragHandleContainer}>
              <View style={styles.dragHandleBar} />
            </View>

            {/* Header bar */}
            <NowPlayingHeader onDismiss={handleDismiss} />

            {/* Center Stage: Artwork View vs Kinetic Lyrics View */}
            <View style={styles.mainContent}>
              <View style={styles.centerStage}>
                {isLyricsVisible ? (
                  <NowPlayingLyricsView
                    displayPosition={displayPosition}
                    lyricLines={lyricLines}
                  />
                ) : (
                  <NowPlayingArtworkView
                    artSize={artSize}
                    currentTrack={currentTrack}
                  />
                )}
              </View>

              {/* Title & Artist info */}
              <View style={styles.titleArtistRow}>
                <View style={{ flex: 1, paddingRight: 16 }}>
                  <Text numberOfLines={1} style={styles.trackTitle}>
                    {currentTrack.title}
                  </Text>
                  <Text numberOfLines={1} style={styles.trackArtist}>
                    {currentTrack.artist}
                  </Text>
                </View>

                {/* Quick lyrics / sing toggle on right (Image 2) */}
                <Pressable
                  accessibilityHint="Toggles lyrics"
                  accessibilityLabel="Lyrics"
                  accessibilityRole="button"
                  onPress={toggleLyrics}
                  style={[
                    styles.actionBtn,
                    {
                      backgroundColor: isLyricsVisible
                        ? "rgba(192, 132, 252, 0.25)"
                        : "rgba(255, 255, 255, 0.08)",
                    },
                  ]}
                >
                  <Ionicons
                    color={isLyricsVisible ? "#B8A3FF" : "#f4f4f5"}
                    name={isLyricsVisible ? "mic" : "mic-outline"}
                    size={20}
                  />
                </Pressable>
              </View>

              {/* Scrubber Timeline */}
              <NowPlayingScrubber
                displayPosition={displayPosition}
                displayProgress={displayProgress}
                duration={duration}
                onSeekRelease={handleScrubberRelease}
                onSeekTouch={handleScrubberTouch}
                onTrackLayout={(width) => {
                  scrubberWidthRef.current = width;
                }}
              />

              {/* Transport Controls Row */}
              <NowPlayingTransportControls
                isPlaying={isPlaying}
                isShuffle={isShuffle}
                nextTrack={nextTrack}
                previousTrack={previousTrack}
                repeatMode={repeatMode}
                togglePlay={togglePlay}
                toggleRepeat={toggleRepeat}
                toggleShuffle={toggleShuffle}
              />

              {/* Volume Slider Row (from Image 2) */}
              <View style={styles.volumeRow}>
                <Ionicons
                  color="rgba(255, 255, 255, 0.5)"
                  name="volume-low-sharp"
                  size={16}
                />
                <View
                  onLayout={(e) => {
                    volumeTrackWidthRef.current = e.nativeEvent.layout.width;
                  }}
                  onResponderGrant={(e) => {
                    handleVolumeTouch(e.nativeEvent.locationX);
                  }}
                  onResponderMove={(e) => {
                    handleVolumeTouch(e.nativeEvent.locationX);
                  }}
                  onStartShouldSetResponder={() => true}
                  style={styles.volumeTrack}
                >
                  <View
                    style={[
                      styles.volumeTrackFill,
                      { width: `${volume * 100}%` },
                    ]}
                  />
                </View>
                <Ionicons
                  color="rgba(255, 255, 255, 0.5)"
                  name="volume-high-sharp"
                  size={16}
                />
              </View>

              {/* Bottom Accessory Bar (Lyrics, AirPlay/Audio Route, Queue) */}
              <View
                style={[
                  styles.bottomActionsBar,
                  { paddingBottom: Math.max(16, insets.bottom) },
                ]}
              >
                {/* Lyrics mode */}
                <Pressable
                  accessibilityHint="Toggles lyrics mode"
                  accessibilityLabel="Lyrics"
                  accessibilityRole="button"
                  onPress={toggleLyrics}
                  style={styles.actionBtn}
                >
                  <Ionicons
                    color={isLyricsVisible ? "#B8A3FF" : "#f4f4f5"}
                    name={
                      isLyricsVisible
                        ? "chatbubble-ellipses"
                        : "chatbubble-ellipses-outline"
                    }
                    size={22}
                  />
                </Pressable>

                {/* AirPlay / Route Output */}
                <Pressable
                  accessibilityHint="Audio routing options"
                  accessibilityLabel="Audio Route"
                  accessibilityRole="button"
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={styles.actionBtn}
                >
                  <Ionicons color="#f4f4f5" name="radio-outline" size={22} />
                </Pressable>

                {/* Queue / Up Next Sheet Button */}
                <Pressable
                  accessibilityHint="Toggles up next queue"
                  accessibilityLabel="Queue"
                  accessibilityRole="button"
                  onPress={toggleQueue}
                  style={styles.actionBtn}
                >
                  <View style={{ position: "relative" }}>
                    <Ionicons
                      color={isQueueVisible ? "#B8A3FF" : "#f4f4f5"}
                      name="list"
                      size={24}
                    />
                    {queue.length > 0 ? (
                      <View
                        style={[
                          styles.queueBadge,
                          { backgroundColor: theme.primary },
                        ]}
                      >
                        <Text style={styles.queueBadgeText}>
                          {queue.length > 9 ? "9+" : queue.length}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              </View>
            </View>

            {/* Up Next Queue Drawer Sheet */}
            {isQueueVisible ? (
              <NowPlayingQueueDrawer
                clearQueue={clearQueue}
                onClose={() => setIsQueueVisible(false)}
                playTrack={playTrack}
                queue={queue}
                removeFromQueue={removeFromQueue}
              />
            ) : null}
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}
