/* oxlint-disable one-var, sort-vars */
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { CardMeta, NativeCardShell } from "@/components/cards/card-shell";
import { NativeImage } from "@/components/native-image";
import { useAudioPlayerContext } from "@/contexts/audio-player-context";
import { NAV_THEME } from "@/lib/constants";
import type { TrackSummary } from "@/lib/soundkit-api";
import { resolveApiUrl } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

export const TRACK_CARD_WIDTH = 150;

const styles = StyleSheet.create({
    heartOverlayBtn: {
      alignItems: "center",
      backgroundColor: "rgba(0, 0, 0, 0.48)",
      borderRadius: 999,
      height: 28,
      justifyContent: "center",
      position: "absolute",
      right: 8,
      top: 8,
      width: 28,
    },
    metaRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 4,
      marginTop: -4,
      paddingHorizontal: 2,
    },
    metaText: { fontSize: 11 },
    playOverlayBtn: {
      alignItems: "center",
      backgroundColor: "rgba(0, 0, 0, 0.65)",
      borderColor: "rgba(255, 255, 255, 0.2)",
      borderRadius: 999,
      borderWidth: 1,
      bottom: 8,
      height: 30,
      justifyContent: "center",
      position: "absolute",
      right: 8,
      width: 30,
    },
    thumb: { height: "100%", width: "100%" },
    thumbRatio: {
      aspectRatio: 1,
      backgroundColor: "#141418",
      borderCurve: "continuous",
      borderRadius: 12,
      overflow: "hidden",
      position: "relative",
    },
  }),
  formatDuration = (track: TrackSummary) => {
    if (typeof track.duration === "string" && track.duration.length > 0) {
      return track.duration;
    }
    return "0:00";
  };

export function TrackCard({
  compact = false,
  track,
}: {
  compact?: boolean;
  track: TrackSummary;
}) {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    [isSaved, setIsSaved] = useState(false),
    { currentTrack, isPlaying, playTrack, togglePlay } =
      useAudioPlayerContext(),
    isCurrent = currentTrack?.id === track.id,
    isPlayingThis = isCurrent && isPlaying,
    audioSrc =
      resolveApiUrl(track.playbackUrl ?? track.previewUrl ?? null) ??
      "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";

  return (
    <NativeCardShell
      href={`/tracks/${track.id}`}
      width={compact ? 140 : TRACK_CARD_WIDTH}
    >
      <View style={styles.thumbRatio}>
        <NativeImage
          source={track.coverArtUrl ?? undefined}
          style={styles.thumb}
        />
        <Pressable
          accessibilityHint={
            isSaved ? "Removes track from saved" : "Saves track"
          }
          accessibilityLabel={
            isSaved ? `Unsave ${track.title}` : `Save ${track.title}`
          }
          accessibilityRole="button"
          hitSlop={8}
          onPress={(e) => {
            e.stopPropagation?.();
            setIsSaved((prev) => !prev);
          }}
          style={({ pressed }) => [
            styles.heartOverlayBtn,
            pressed && { opacity: 0.75, transform: [{ scale: 0.92 }] },
          ]}
        >
          <Ionicons
            color={isSaved ? "#F43F5E" : "#FFFFFF"}
            name={isSaved ? "heart" : "heart-outline"}
            size={15}
          />
        </Pressable>
        <Pressable
          accessibilityHint={isPlayingThis ? "Pauses track" : "Plays track"}
          accessibilityLabel={isPlayingThis ? "Pause" : "Play"}
          accessibilityRole="button"
          hitSlop={8}
          onPress={(e) => {
            e.stopPropagation?.();
            if (isCurrent) {
              togglePlay();
            } else {
              playTrack({
                artist: track.artistName,
                cover: track.coverArtUrl,
                id: track.id,
                src: audioSrc,
                title: track.title,
                trackHref: `/tracks/${track.id}`,
              });
            }
          }}
          style={({ pressed }) => [
            styles.playOverlayBtn,
            {
              backgroundColor: isPlayingThis
                ? theme.primary
                : "rgba(0, 0, 0, 0.65)",
              opacity: pressed ? 0.75 : 1,
              transform: [{ scale: pressed ? 0.92 : 1 }],
            },
          ]}
        >
          <Ionicons
            color={isPlayingThis ? "#ffffff" : "#f4f4f5"}
            name={isPlayingThis ? "pause" : "play"}
            size={14}
            style={isPlayingThis ? undefined : { marginLeft: 1.5 }}
          />
        </Pressable>
      </View>
      <CardMeta
        subtitle={track.artistName}
        subtitleColor={theme.mutedText}
        title={track.title}
        titleColor={theme.text}
      />
      <View style={styles.metaRow}>
        <Ionicons color={theme.mutedText} name="time-outline" size={12} />
        <Text
          numberOfLines={1}
          style={[styles.metaText, { color: theme.mutedText }]}
        >
          {formatDuration(track)} • {(track.plays ?? 0).toLocaleString()} plays
        </Text>
      </View>
    </NativeCardShell>
  );
}
