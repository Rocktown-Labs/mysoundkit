/* oxlint-disable one-var, sort-vars */
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { CardBadge, NativeCardShell } from "@/components/cards/card-shell";
import { NAV_THEME } from "@/lib/constants";
import type { ListeningPartySummary } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

export const PARTY_CARD_WIDTH = 240;

function formatDate(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "Upcoming"
    : date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      });
}

export function PartyCard({
  party,
  fluid = false,
}: {
  party: ListeningPartySummary;
  /** Fill the parent cell (view-all grids) instead of the fixed rail width. */
  fluid?: boolean;
}) {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;
  const isLive = party.status === "live";
  const formattedDate = formatDate(party.scheduledStartAt);

  return (
    <NativeCardShell
      href={`/live/parties/${party.id}`}
      width={fluid ? 0 : PARTY_CARD_WIDTH}
    >
      <View style={styles.thumbRatio}>
        <View style={styles.partyStage}>
          <View style={styles.stageGlow} />
          <View style={styles.discBadge}>
            <Ionicons color="#B8A3FF" name="disc" size={24} />
          </View>
        </View>

        <View style={styles.badgeRow}>
          <CardBadge tone={isLive ? "destructive" : "secondary"}>
            {isLive ? "Live Party" : "Upcoming"}
          </CardBadge>
          {party.genre ? <CardBadge>{party.genre}</CardBadge> : null}
        </View>

        <View style={styles.datePill}>
          <Ionicons color="#B8A3FF" name="calendar-outline" size={11} />
          <Text style={styles.datePillText}>{formattedDate}</Text>
        </View>
      </View>

      <View style={styles.details}>
        <Text numberOfLines={1} style={[styles.title, { color: theme.text }]}>
          {party.title}
        </Text>
        <Text
          numberOfLines={1}
          style={[styles.subtitle, { color: theme.mutedText }]}
        >
          {party.description ?? "Community Album Premiere"}
        </Text>
        <View style={styles.metaRow}>
          <Text
            numberOfLines={1}
            style={[styles.metaText, { color: theme.mutedText }]}
          >
            {party.genre ?? "Album Premiere"}
          </Text>
          <View style={styles.actionRow}>
            <Text style={[styles.actionText, { color: theme.primary }]}>
              {isLive ? "Join Party" : "RSVP"}
            </Text>
            <Ionicons color={theme.primary} name="chevron-forward" size={12} />
          </View>
        </View>
      </View>
    </NativeCardShell>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 2,
  },
  actionText: {
    fontSize: 11,
    fontWeight: "700",
  },
  badgeRow: {
    flexDirection: "row",
    gap: 6,
    left: 8,
    position: "absolute",
    top: 8,
  },
  datePill: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    borderRadius: 6,
    bottom: 8,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    position: "absolute",
    right: 8,
  },
  datePillText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  details: {
    gap: 2,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  discBadge: {
    alignItems: "center",
    backgroundColor: "#261D3D",
    borderColor: "rgba(184, 163, 255, 0.3)",
    borderRadius: 24,
    borderWidth: 1.5,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
  },
  metaText: {
    flex: 1,
    fontSize: 11,
  },
  partyStage: {
    alignItems: "center",
    backgroundColor: "#151124",
    height: "100%",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
    width: "100%",
  },
  stageGlow: {
    backgroundColor: "rgba(184, 163, 255, 0.12)",
    borderRadius: 999,
    height: 90,
    position: "absolute",
    width: 90,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  thumbRatio: {
    aspectRatio: 16 / 9,
    borderCurve: "continuous",
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
    width: "100%",
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
    lineHeight: 20,
  },
});
