import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

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

/** Inline audio player for a single track URL, mirroring the web track player. */
export function TrackAudioPlayer({
  artistName,
  source,
  title,
}: {
  artistName?: null | string;
  source: string;
  title: string;
}) {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    player = useAudioPlayer(source),
    status = useAudioPlayerStatus(player);

  useEffect(() => () => player.release(), [player]);

  const progress =
    status.duration > 0
      ? Math.min(1, (status.currentTime || 0) / status.duration)
      : 0;

  return (
    <View
      style={[
        styles.wrapper,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <Pressable
        accessibilityLabel={status.playing ? "Pause" : "Play"}
        onPress={() => {
          if (status.playing) {
            player.pause();
          } else {
            player.play();
          }
        }}
        style={[styles.playButton, { backgroundColor: theme.primary }]}
      >
        <Ionicons
          color={theme.primaryForeground}
          name={status.playing ? "pause" : "play"}
          size={22}
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
          {formatTime(status.currentTime)} / {formatTime(status.duration)}
        </Text>
      </View>
      <View style={styles.controlsRow}>
        <Pressable
          accessibilityLabel="Restart"
          onPress={() => {
            player.seekTo(0);
          }}
          style={styles.controlButton}
        >
          <Ionicons color={theme.mutedText} name="play-back" size={18} />
        </Pressable>
      </View>
      <Text
        numberOfLines={1}
        style={{
          color: theme.text,
          fontSize: 13,
          fontWeight: "700",
          flexShrink: 1,
        }}
      >
        {title}
        {artistName ? ` — ${artistName}` : ""}
      </Text>
    </View>
  );
}
