/* eslint-disable one-var, sort-vars */
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { NativeImage } from "@/components/native-image";
import { useAudioPlayerContext } from "@/contexts/audio-player-context";
import { NAV_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/use-color-scheme";

const styles = StyleSheet.create({
  actionButton: {
    alignItems: "center",
    borderRadius: 999,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  actionsRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  art: {
    alignItems: "center",
    borderRadius: 8,
    height: 38,
    justifyContent: "center",
    overflow: "hidden",
    width: 38,
  },
  badge: {
    alignItems: "center",
    borderRadius: 999,
    height: 14,
    justifyContent: "center",
    minWidth: 14,
    paddingHorizontal: 3,
    position: "absolute",
    right: -2,
    top: -2,
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "800",
  },
  blurContainer: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 7,
    position: "relative",
    width: "100%",
  },
  container: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    width: "100%",
  },
  copy: {
    flex: 1,
    gap: 2,
    justifyContent: "center",
  },
  playButton: {
    alignItems: "center",
    borderRadius: 999,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  progressBarBackground: {
    bottom: 0,
    height: 2.5,
    left: 0,
    position: "absolute",
    right: 0,
  },
  progressBarFill: {
    height: "100%",
  },
  subtitle: {
    fontSize: 11,
    fontWeight: "500",
  },
  title: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
});

/**
 * High-polish floating mini-player pill sitting docked in the tab bar bottom accessory.
 * Combines Apple Music's fluid typography & direct controls with SoundKit web's queue & expand actions.
 */
export function GlobalMiniPlayer() {
  const {
    currentTrack,
    isPlaying,
    nextTrack,
    openNowPlaying,
    progress,
    queue,
    togglePlay,
    toggleQueue,
  } = useAudioPlayerContext(),
   { colorScheme } = useColorScheme(),
   theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;

  if (!currentTrack) {
    return null;
  }

  const queueCount = queue.length;

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityHint="Opens full now playing view"
        accessibilityLabel={`${currentTrack.title} by ${currentTrack.artist}`}
        accessibilityRole="button"
        onPress={openNowPlaying}
        style={({ pressed }) => [
          {
            opacity: pressed ? 0.95 : 1,
            transform: [{ scale: pressed ? 0.985 : 1 }],
          },
        ]}
      >
        <BlurView
          intensity={85}
          style={[
            styles.blurContainer,
            {
              backgroundColor: "rgba(22, 22, 26, 0.85)",
              borderColor: "rgba(255, 255, 255, 0.12)",
            },
          ]}
          tint="dark"
        >
          {/* Album artwork thumbnail */}
          <View style={[styles.art, { backgroundColor: theme.muted }]}>
            {currentTrack.cover ? (
              <NativeImage
                accessibilityLabel={`${currentTrack.title} artwork`}
                source={currentTrack.cover}
                style={{ height: "100%", width: "100%" }}
              />
            ) : (
              <Ionicons color="#c084fc" name="musical-notes" size={18} />
            )}
          </View>

          {/* Title and artist */}
          <View style={styles.copy}>
            <Text
              numberOfLines={1}
              style={[styles.title, { color: "#f4f4f5" }]}
            >
              {currentTrack.title}
            </Text>
            <Text
              numberOfLines={1}
              style={[styles.subtitle, { color: "#a1a1aa" }]}
            >
              {currentTrack.artist}
            </Text>
          </View>

          {/* Quick controls row */}
          <View style={styles.actionsRow}>
            {/* Play/Pause Button */}
            <Pressable
              accessibilityHint={
                isPlaying ? "Pauses playback" : "Starts playback"
              }
              accessibilityLabel={isPlaying ? "Pause" : "Play"}
              accessibilityRole="button"
              hitSlop={8}
              onPress={(e) => {
                e.stopPropagation?.();
                togglePlay();
              }}
              style={({ pressed }) => [
                styles.playButton,
                {
                  backgroundColor: "#ffffff",
                  opacity: pressed ? 0.75 : 1,
                  transform: [{ scale: pressed ? 0.92 : 1 }],
                },
              ]}
            >
              <Ionicons
                color="#000000"
                name={isPlaying ? "pause" : "play"}
                size={16}
                style={isPlaying ? undefined : { marginLeft: 2 }}
              />
            </Pressable>

            {/* Next Track Button */}
            <Pressable
              accessibilityHint="Skips to next track"
              accessibilityLabel="Next track"
              accessibilityRole="button"
              hitSlop={8}
              onPress={(e) => {
                e.stopPropagation?.();
                nextTrack();
              }}
              style={({ pressed }) => [
                styles.actionButton,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Ionicons color="#f4f4f5" name="play-skip-forward" size={17} />
            </Pressable>

            {/* Queue Button with Badge count (from Image 3) */}
            <Pressable
              accessibilityHint="Toggles up next queue"
              accessibilityLabel="Queue"
              accessibilityRole="button"
              hitSlop={8}
              onPress={(e) => {
                e.stopPropagation?.();
                openNowPlaying();
                toggleQueue();
              }}
              style={({ pressed }) => [
                styles.actionButton,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <View style={{ position: "relative" }}>
                <Ionicons color="#a1a1aa" name="list" size={18} />
                {queueCount > 0 ? (
                  <View
                    style={[styles.badge, { backgroundColor: theme.primary }]}
                  >
                    <Text style={styles.badgeText}>
                      {queueCount > 9 ? "9+" : queueCount}
                    </Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          </View>

          {/* Bottom hairline progress indicator */}
          <View
            style={[
              styles.progressBarBackground,
              { backgroundColor: "rgba(255, 255, 255, 0.08)" },
            ]}
          >
            <View
              style={[
                styles.progressBarFill,
                {
                  backgroundColor: theme.primary,
                  width: `${progress * 100}%`,
                },
              ]}
            />
          </View>
        </BlurView>
      </Pressable>
    </View>
  );
}
