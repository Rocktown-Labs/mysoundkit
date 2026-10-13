import { Ionicons } from "@expo/vector-icons";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { NAV_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/use-color-scheme";

// Placeholder public stream until the player is wired to real SoundKit
// playback sessions.
const RADIO_STREAM_URL =
    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  styles = StyleSheet.create({
    art: {
      alignItems: "center",
      borderRadius: 10,
      height: 34,
      justifyContent: "center",
      width: 34,
    },
    container: {
      alignItems: "center",
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: 10,
      width: "100%",
    },
    copy: { flex: 1, gap: 1 },
    playButton: {
      alignItems: "center",
      borderRadius: 999,
      height: 30,
      justifyContent: "center",
      width: 30,
    },
    subtitle: { fontSize: 11 },
    title: { fontSize: 12, fontWeight: "800" },
  });

/**
 * Compact global mini-player rendered in the tab bar's bottom accessory.
 * Plays a public demo stream with play/pause controls.
 */
export function GlobalMiniPlayer() {
  const player = useAudioPlayer(RADIO_STREAM_URL, { updateInterval: 1000 }),
    status = useAudioPlayerStatus(player),
    { colorScheme } = useColorScheme(),
    isLoaded = Boolean(status.isLoaded),
    isPlaying = Boolean(status.playing),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;

  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true });
  }, []);

  return (
    <View style={styles.container}>
      <View style={[styles.art, { backgroundColor: theme.primary }]}>
        <Ionicons
          color={theme.primaryForeground}
          name="musical-notes"
          size={14}
        />
      </View>
      <View style={styles.copy}>
        <Text numberOfLines={1} style={[styles.title, { color: theme.text }]}>
          SoundKit Radio
        </Text>
        <Text
          numberOfLines={1}
          style={[styles.subtitle, { color: theme.mutedText }]}
        >
          Now playing · SoundKit picks
        </Text>
      </View>
      <Pressable
        accessibilityHint={isPlaying ? "Pauses the stream" : "Plays the stream"}
        accessibilityLabel={isPlaying ? "Pause" : "Play"}
        accessibilityRole="button"
        disabled={!isLoaded}
        onPress={() => {
          if (isPlaying) {
            player.pause();
          } else {
            player.play();
          }
        }}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      >
        <View style={[styles.playButton, { backgroundColor: theme.text }]}>
          <Ionicons
            color={theme.background}
            name={isPlaying ? "pause" : "play"}
            size={16}
          />
        </View>
      </Pressable>
    </View>
  );
}
