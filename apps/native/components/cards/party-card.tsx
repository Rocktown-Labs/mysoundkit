/* oxlint-disable one-var, sort-vars */
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import {
  CardBadge,
  CardMeta,
  NativeCardShell,
} from "@/components/cards/card-shell";
import { NAV_THEME } from "@/lib/constants";
import type { ListeningPartySummary } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

export const PARTY_CARD_WIDTH = 220;

const styles = StyleSheet.create({
    badgeRow: {
      flexDirection: "row",
      gap: 6,
      left: 8,
      position: "absolute",
      top: 8,
    },
    dateText: { fontSize: 11, fontWeight: "700" },
    fallback: {
      alignItems: "center",
      gap: 8,
      justifyContent: "center",
      width: "100%",
    },
    fallbackIcon: { opacity: 0.5 },
    fallbackText: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },
    metaRow: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      paddingBottom: 10,
      paddingHorizontal: 10,
    },
    metaText: { fontSize: 11 },
    thumb: { width: "100%" },
    thumbRatio: { aspectRatio: 16 / 9 },
  }),
  formatDate = (iso: string) => {
    const date = new Date(iso);
    return Number.isNaN(date.getTime())
      ? ""
      : date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  };

export function PartyCard({
  party,
  fluid = false,
}: {
  party: ListeningPartySummary;
  /** Fill the parent cell (view-all grids) instead of the fixed rail width. */
  fluid?: boolean;
}) {
  const { colorScheme } = useColorScheme(),
    theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light,
    isLive = party.status === "live";

  return (
    <NativeCardShell
      href={`/live/parties/${party.id}`}
      width={fluid ? 0 : PARTY_CARD_WIDTH}
    >
      <View style={styles.thumbRatio}>
        <View
          style={[
            styles.fallback,
            { backgroundColor: theme.muted, height: "100%" },
          ]}
        >
          <Ionicons
            color={theme.primary}
            name="headset"
            size={28}
            style={styles.fallbackIcon}
          />
          <Text style={[styles.fallbackText, { color: theme.mutedText }]}>
            Listening Party
          </Text>
        </View>
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
