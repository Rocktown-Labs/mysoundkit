import { StyleSheet, Text, View } from "react-native";

import { CardBadge, NativeCardShell } from "@/components/cards/card-shell";
import { NativeImage } from "@/components/native-image";
import { NAV_THEME } from "@/lib/constants";
import type { BattleSummary } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

export const BATTLE_CARD_WIDTH = 290;

const styles = StyleSheet.create({
    badgeRow: {
      flexDirection: "row",
      gap: 6,
      left: 8,
      position: "absolute",
      top: 8,
    },
    infoBlock: { flex: 1 },
    metaRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 10,
      paddingBottom: 10,
    },
    metaText: { fontSize: 11 },
    thumb: { width: "100%" },
    thumbRatio: { aspectRatio: 16 / 9 },
    trackName: { fontSize: 12, fontWeight: "600", marginTop: 2 },
    versusRow: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-around",
      paddingHorizontal: 10,
      paddingTop: 8,
    },
    votes: { fontSize: 11, marginTop: 2 },
  }),
  formatDuration = (seconds?: number | null) => {
    const total = Math.max(0, Math.floor(seconds ?? 0));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  };

export function BattleCard({ battle }: { battle: BattleSummary }) {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    tracks = battle.tracks ?? [],
    isLive = battle.status === "live",
    formatLabel =
      battle.format != null && battle.format.length > 0
        ? battle.format.replace(/_/g, " ")
        : null;

  return (
    <NativeCardShell
      href={`/live/battles/${battle.id}`}
      width={BATTLE_CARD_WIDTH}
    >
      <View style={styles.thumbRatio}>
        <NativeImage
          source={tracks[0]?.cover ?? tracks[1]?.cover ?? undefined}
          style={styles.thumb}
        />
        <View style={styles.badgeRow}>
          <CardBadge tone={isLive ? "destructive" : "secondary"}>
            {isLive ? "Live" : (battle.status ?? "Upcoming")}
          </CardBadge>
          {formatLabel != null ? <CardBadge>{formatLabel}</CardBadge> : null}
        </View>
      </View>
      <View style={styles.versusRow}>
        <View style={styles.infoBlock}>
          <Text
            numberOfLines={1}
            style={[styles.trackName, { color: theme.text }]}
          >
            {tracks[0]?.title ?? "TBA"}
          </Text>
          <Text style={[styles.votes, { color: theme.mutedText }]}>
            {tracks[0]?.artist ?? "—"} • {tracks[0]?.votes ?? 0} votes
          </Text>
        </View>
        <Text
          style={[styles.metaText, { color: theme.primary, fontWeight: "800" }]}
        >
          VS
        </Text>
        <View style={styles.infoBlock}>
          <Text
            numberOfLines={1}
            style={[
              styles.trackName,
              { color: theme.text, textAlign: "right" },
            ]}
          >
            {tracks[1]?.title ?? "TBA"}
          </Text>
          <Text
            style={[
              styles.votes,
              { color: theme.mutedText, textAlign: "right" },
            ]}
          >
            {tracks[1]?.artist ?? "—"} • {tracks[1]?.votes ?? 0} votes
          </Text>
        </View>
      </View>
      <View style={styles.metaRow}>
        <Text
          numberOfLines={1}
          style={[styles.metaText, { color: theme.mutedText, flex: 1 }]}
        >
          {battle.title}
        </Text>
        <Text style={[styles.metaText, { color: theme.mutedText }]}>
          {battle.viewerCount.toLocaleString()} watching
          {battle.round?.total != null
            ? ` • Rd ${battle.round.current ?? 1}/${battle.round.total}`
            : ""}
        </Text>
      </View>
    </NativeCardShell>
  );
}

export { formatDuration as formatBattleDuration };
