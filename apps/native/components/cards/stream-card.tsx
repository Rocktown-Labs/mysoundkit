import { StyleSheet, Text, View } from "react-native";

import {
  CardBadge,
  CardMeta,
  NativeCardShell,
} from "@/components/cards/card-shell";
import { NativeImage } from "@/components/native-image";
import { NAV_THEME } from "@/lib/constants";
import type { LiveExperienceSummary } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

export const STREAM_CARD_WIDTH = 290;

const styles = StyleSheet.create({
  fallback: {
    alignItems: "center",
    aspectRatio: 16 / 9,
    justifyContent: "center",
    width: "100%",
  },
  fallbackText: { fontSize: 30, fontWeight: "800", opacity: 0.4 },
  liveDot: {
    backgroundColor: "#E5484D",
    borderRadius: 4,
    height: 8,
    marginRight: 4,
    width: 8,
  },
  liveRow: { alignItems: "center", flexDirection: "row" },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  metaText: { fontSize: 11 },
  thumb: { height: "100%", width: "100%" },
});

export function StreamCard({ stream }: { stream: LiveExperienceSummary }) {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    isLive = stream.status === "live",
    viewers = (stream.viewerCount ?? 0).toLocaleString();

  return (
    <NativeCardShell
      href={`/live/streams/${stream.id}`}
      width={STREAM_CARD_WIDTH}
    >
      <View style={{ aspectRatio: 16 / 9 }}>
        {stream.creatorAvatar != null ? (
          <NativeImage source={stream.creatorAvatar} style={styles.thumb} />
        ) : (
          <View style={[styles.fallback, { backgroundColor: theme.muted }]}>
            <Text style={[styles.fallbackText, { color: theme.mutedText }]}>
              {(stream.creatorName ?? "SK").slice(0, 2).toUpperCase()}
            </Text>
          </View>
        )}
        <View
          style={{
            flexDirection: "row",
            gap: 6,
            left: 8,
            position: "absolute",
            top: 8,
          }}
        >
          <CardBadge tone={isLive ? "destructive" : "secondary"}>
            {isLive ? "Live" : (stream.status ?? "Offline")}
          </CardBadge>
          {stream.genre != null && stream.genre.length > 0 ? (
            <CardBadge>{stream.genre}</CardBadge>
          ) : null}
        </View>
      </View>
      <CardMeta
        subtitle={stream.creatorName ?? "SoundKit creator"}
        subtitleColor={theme.mutedText}
        title={stream.title}
        titleColor={theme.text}
      />
      <View style={styles.metaRow}>
        <View style={styles.liveRow}>
          {isLive ? <View style={styles.liveDot} /> : null}
          <Text
            style={[
              styles.metaText,
              { color: isLive ? theme.destructive : theme.mutedText },
            ]}
          >
            {viewers} watching
          </Text>
        </View>
      </View>
    </NativeCardShell>
  );
}
