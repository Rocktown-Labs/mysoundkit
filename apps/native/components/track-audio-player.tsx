/* eslint-disable one-var, sort-vars */
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAudioPlayerContext } from "@/contexts/audio-player-context";
import { NAV_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/use-color-scheme";

const styles = StyleSheet.create({
  controlButton: {
    alignItems: "center",
    backgroundColor: "transparent",
    justifyContent: "center",
    padding: 8,
  },
  controlsRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
  },
  expandButton: {
    alignItems: "center",
    backgroundColor: "transparent",
    justifyContent: "center",
    padding: 6,
  },
  playButton: {
    alignItems: "center",
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  time: { fontSize: 11, fontVariant: ["tabular-nums"] as never },
  track: {
    borderRadius: 2,
    height: 4,
    overflow: "hidden",
  },
  trackFill: { flex: 1 },
  trackRow: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 8,
  },
  wrapper: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 12,
  },
}),

 formatTime = (seconds: number) => {
  const total = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

/**
 * Inline audio player for a track URL.
 * Automatically synchronizes with the global audio player context so playback
 * seamlessly controls the floating mini player and full Now Playing modal.
 */
export function TrackAudioPlayer({
  artistName,
  coverArtUrl,
  source,
  title,
}: {
  artistName?: null | string;
  coverArtUrl?: null | string;
  source: string;
  title: string;
}) {
  const { colorScheme } = useColorScheme(),
   theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
   {
    currentTrack,
    duration,
    isPlaying,
    openNowPlaying,
    playbackPosition,
    playTrack,
    seekTo,
    togglePlay,
  } = useAudioPlayerContext(),

   isCurrent = currentTrack?.src === source,
   isCurrentlyPlaying = isCurrent && isPlaying,
   currentDuration = isCurrent ? duration : 0,
   currentPosition = isCurrent ? playbackPosition : 0,
   progress =
    currentDuration > 0
      ? Math.min(1, Math.max(0, currentPosition / currentDuration))
      : 0,

   handlePlayToggle = () => {
    if (isCurrent) {
      togglePlay();
    } else {
      playTrack({
        artist: artistName || "SoundKit Artist",
        cover: coverArtUrl,
        id: source,
        src: source,
        title,
      });
    }
  };

  return (
    <View
      style={[
        styles.wrapper,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <Pressable
        accessibilityLabel={isCurrentlyPlaying ? "Pause" : "Play"}
        onPress={handlePlayToggle}
        style={[styles.playButton, { backgroundColor: theme.primary }]}
      >
        <Ionicons
          color={theme.primaryForeground}
          name={isCurrentlyPlaying ? "pause" : "play"}
          size={22}
          style={isCurrentlyPlaying ? undefined : { marginLeft: 2 }}
        />
      </Pressable>

      <View style={styles.trackRow}>
        <View style={[styles.track, { backgroundColor: theme.muted }]}>
          <View
            style={[
              styles.trackFill,
              { backgroundColor: theme.primary, width: `${progress * 100}%` },
            ]}
          />
        </View>
        <Text style={[styles.time, { color: theme.mutedText }]}>
          {formatTime(currentPosition)} / {formatTime(currentDuration)}
        </Text>
      </View>

      <View style={styles.controlsRow}>
        <Pressable
          accessibilityLabel="Restart"
          onPress={() => {
            if (isCurrent) {
              void seekTo(0);
            }
          }}
          style={styles.controlButton}
        >
          <Ionicons color={theme.mutedText} name="play-back" size={18} />
        </Pressable>

        <Pressable
          accessibilityLabel="Open in full player"
          onPress={() => {
            if (!isCurrent) {
              playTrack({
                artist: artistName || "SoundKit Artist",
                cover: coverArtUrl,
                id: source,
                src: source,
                title,
              });
            }
            openNowPlaying();
          }}
          style={styles.expandButton}
        >
          <Ionicons color={theme.primary} name="expand-outline" size={18} />
        </Pressable>
      </View>

      <Text
        numberOfLines={1}
        style={{
          color: theme.text,
          flexShrink: 1,
          fontSize: 13,
          fontWeight: "700",
        }}
      >
        {title}
        {artistName ? ` — ${artistName}` : ""}
      </Text>
    </View>
  );
}
