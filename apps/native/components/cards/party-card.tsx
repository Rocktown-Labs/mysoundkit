import { StyleSheet, Text, View } from "react-native";

import {
  CardBadge,
  CardMeta,
  NativeCardShell,
} from "@/components/cards/card-shell";
import { NativeImage } from "@/components/native-image";
import { NAV_THEME } from "@/lib/constants";
import type { ListeningPartySummary } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

export const PARTY_CARD_WIDTH = 240;

const styles = StyleSheet.create({
  badgeRow: {
    flexDirection: "row",
    gap: 6,
    left: 8,
    position: "absolute",
    top: 8,
  },
  dateText: { fontSize: 11, fontWeight: "700" },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  metaText: { fontSize: 11 },
  thumb: { width: "100%" },
  thumbRatio: { aspectRatio: 16 / 9 },
});

const formatDate = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

export function PartyCard({ party }: { party: ListeningPartySummary }) {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    isLive = party.status === "live";

  return (
    <NativeCardShell
      href={`/live/parties/${party.id}`}
      width={PARTY_CARD_WIDTH}
    >
      <View style={styles.thumbRatio}>
        <NativeImage source={undefined} style={styles.thumb} />
        <View style={styles.badgeRow}>
          <CardBadge tone={isLive ? "destructive" : "secondary"}>
            {isLive ? "Live Party" : "Upcoming"}
          </CardBadge>
        </View>
      </View>
      <CardMeta
        subtitle={party.description ?? "Community Album Premiere"}
        subtitleColor={theme.mutedText}
        title={party.title}
        titleColor={theme.text}
      />
      <View style={styles.metaRow}>
        <Text
          style={[styles.metaText, { color: theme.mutedText, flex: 1 }]}
          numberOfLines={1}
        >
          {party.genre ?? "Album Premiere"}
        </Text>
        <Text style={[styles.dateText, { color: theme.primary }]}>
          {formatDate(party.scheduledStartAt)}
        </Text>
      </View>
    </NativeCardShell>
  );
}
