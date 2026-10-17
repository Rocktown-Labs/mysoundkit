/* eslint-disable one-var, sort-vars */
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { LiquidGlassView } from "@/components/liquid-glass";
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
    borderRadius: 10,
    height: 40,
    justifyContent: "center",
    overflow: "hidden",
    width: 40,
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
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    position: "relative",
    width: "100%",
  },
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 2,
    width: "100%",
  },
  copy: {
    flex: 1,
    gap: 2,
    justifyContent: "center",
  },
  playButton: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderRadius: 999,
    height: 34,
    justifyContent: "center",
    width: 34,
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
 * High-polish Liquid Glass floating mini-player pill sitting docked in the tab bar bottom accessory.
 */
export function GlobalMiniPlayer() {
  const {
      currentTrack,
      dismissPlayer,
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
            width: "100%",
          },
        ]}
      >
        <LiquidGlassView
          borderRadius={20}
          intensity={80}
          style={styles.blurContainer}
          variant="chrome"
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
              <Ionicons color="#B8A3FF" name="musical-notes" size={18} />
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
              style={[styles.subtitle, { color: "rgba(255, 255, 255, 0.65)" }]}
            >
              {currentTrack.artist}
            </Text>
          </View>

          {/* Quick controls row */}
          <View style={styles.actionsRow}>
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
                <Ionicons
                  color="rgba(255, 255, 255, 0.75)"
                  name="list"
                  size={18}
                />
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

            <Pressable
              accessibilityHint="Dismisses player"
              accessibilityLabel="Dismiss player"
              accessibilityRole="button"
              hitSlop={8}
              onPress={(e) => {
                e.stopPropagation?.();
                dismissPlayer();
              }}
              style={({ pressed }) => [
                styles.actionButton,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Ionicons
                color="rgba(255, 255, 255, 0.65)"
                name="close"
                size={18}
              />
            </Pressable>
          </View>

          {/* Bottom hairline progress indicator */}
          <View
            style={[
              styles.progressBarBackground,
              { backgroundColor: "rgba(255, 255, 255, 0.1)" },
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
        </LiquidGlassView>
      </Pressable>
    </View>
  );
}
