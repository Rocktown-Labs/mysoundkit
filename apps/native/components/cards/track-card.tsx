import { StyleSheet, Text, View } from "react-native";

import { CardMeta, NativeCardShell } from "@/components/cards/card-shell";
import { NativeImage } from "@/components/native-image";
import { NAV_THEME } from "@/lib/constants";
import type { TrackSummary } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

export const TRACK_CARD_WIDTH = 150;

const styles = StyleSheet.create({
    metaRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 4,
    },
    metaText: { fontSize: 11 },
    thumb: { height: "100%", width: "100%" },
    thumbRatio: { aspectRatio: 1 },
  }),
  formatDuration = (track: TrackSummary) => {
    if (track.duration != null && track.duration.length > 0) {
      return track.duration;
    }
    return "0:00";
  };

export function TrackCard({ track }: { track: TrackSummary }) {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;

  return (
    <NativeCardShell href={`/tracks/${track.id}`} width={TRACK_CARD_WIDTH}>
      <View style={styles.thumbRatio}>
        <NativeImage
          source={track.coverArtUrl ?? undefined}
          style={styles.thumb}
        />
      </View>
      <CardMeta
        subtitle={track.artistName}
        subtitleColor={theme.mutedText}
        title={track.title}
        titleColor={theme.text}
      />
      <View
        style={[styles.metaRow, { paddingHorizontal: 10, paddingBottom: 10 }]}
      >
        <Text style={[styles.metaText, { color: theme.mutedText }]}>
          {formatDuration(track)} • {track.plays.toLocaleString()} plays
        </Text>
      </View>
    </NativeCardShell>
  );
}
