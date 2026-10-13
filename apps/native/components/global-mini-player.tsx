import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { useEffect, useRef, useState } from "react";
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
  }),
  unloadQuietly = async (sound: Audio.Sound) => {
    try {
      await sound.unloadAsync();
    } catch {
      // Ignore unload failures during teardown.
    }
  };

/**
 * Compact global mini-player rendered in the tab bar's bottom accessory.
 * Plays a public demo stream with play/pause controls.
 */
export function GlobalMiniPlayer() {
  const { colorScheme } = useColorScheme(),
    [isLoaded, setIsLoaded] = useState(false),
    [isPlaying, setIsPlaying] = useState(false),
    soundRef = useRef<Audio.Sound | null>(null),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    togglePlayback = async () => {
      const sound = soundRef.current;
      if (!sound) {
        return;
      }
      await sound.setStatusAsync({ shouldPlay: !isPlaying });
    };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
        });
        const { sound } = await Audio.Sound.createAsync(
          { uri: RADIO_STREAM_URL },
          { progressUpdateIntervalMillis: 1000, shouldPlay: false },
          (status) => {
            if (cancelled) {
              return;
            }
            setIsLoaded(Boolean(status.isLoaded));
            setIsPlaying(Boolean(status.isLoaded && status.isPlaying));
          }
        );
        if (cancelled) {
          await unloadQuietly(sound);
          return;
        }
        soundRef.current = sound;
        setIsLoaded(true);
      } catch {
        // The player stays inert if the stream cannot be reached.
      }
    };

    void load();

    return () => {
      cancelled = true;
      const sound = soundRef.current;
      soundRef.current = null;
      if (sound) {
        void unloadQuietly(sound);
      }
    };
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
          void togglePlayback();
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
