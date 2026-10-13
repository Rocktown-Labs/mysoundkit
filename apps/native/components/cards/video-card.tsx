import { StyleSheet, Text, View } from "react-native";

import {
  CardBadge,
  CardMeta,
  NativeCardShell,
} from "@/components/cards/card-shell";
import { NativeImage } from "@/components/native-image";
import { NAV_THEME } from "@/lib/constants";
import type { VideoSummary } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

export const VIDEO_CARD_WIDTH = 240;

const styles = StyleSheet.create({
    badgeRow: {
      flexDirection: "row",
      gap: 6,
      left: 8,
      position: "absolute",
      top: 8,
    },
    durationChip: {
      bottom: 8,
      borderRadius: 4,
      paddingHorizontal: 5,
      paddingVertical: 1,
      position: "absolute",
      right: 8,
    },
    durationText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },
    metaRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 4,
      paddingHorizontal: 10,
      paddingBottom: 10,
    },
    metaText: { fontSize: 11 },
    thumb: { height: "100%", width: "100%" },
    thumbRatio: { aspectRatio: 16 / 9 },
  }),
  KIND_LABELS: Record<VideoSummary["videoKind"], string> = {
    battle_clip: "Battle Clip",
    battle_replay: "Battle Replay",
    live_recording: "Live Recording",
    music_video: "Music Video",
    promo: "Promo",
    teaser: "Teaser",
  };

export function VideoCard({ video }: { video: VideoSummary }) {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    isLive = video.status === "live";

  return (
    <NativeCardShell href={`/videos/${video.id}`} width={VIDEO_CARD_WIDTH}>
      <View style={styles.thumbRatio}>
        <NativeImage
          source={video.thumbnailUrl ?? undefined}
          style={styles.thumb}
        />
        <View style={styles.badgeRow}>
          <CardBadge tone={isLive ? "destructive" : "secondary"}>
            {isLive ? "Live" : KIND_LABELS[video.videoKind]}
          </CardBadge>
          {video.playbackPolicy === "signed" ? (
            <CardBadge tone="primary">Premium</CardBadge>
          ) : null}
        </View>
        {video.duration != null && video.duration !== "0:00" ? (
          <View
            style={[
              styles.durationChip,
              { backgroundColor: "rgba(0,0,0,0.8)" },
            ]}
          >
            <Text style={styles.durationText}>{video.duration}</Text>
          </View>
        ) : null}
      </View>
      <CardMeta
        subtitle={video.creatorName ?? "SoundKit creator"}
        subtitleColor={theme.mutedText}
        title={video.title}
        titleColor={theme.text}
      />
      <View style={styles.metaRow}>
        <Text style={[styles.metaText, { color: theme.mutedText }]}>
          {video.viewCount ?? 0} views
        </Text>
      </View>
    </NativeCardShell>
  );
}
