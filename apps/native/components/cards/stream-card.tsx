/* oxlint-disable one-var, sort-vars */
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { CardBadge, NativeCardShell } from "@/components/cards/card-shell";
import { NativeImage } from "@/components/native-image";
import { NAV_THEME } from "@/lib/constants";
import type { LiveExperienceSummary } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

export const STREAM_CARD_WIDTH = 240;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/u);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function StreamCard({
  stream,
  fluid = false,
}: {
  stream: LiveExperienceSummary;
  /** Fill the parent cell (view-all grids) instead of the fixed rail width. */
  fluid?: boolean;
}) {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;
  const isLive = stream.status === "live";
  const viewers = (stream.viewerCount ?? 0).toLocaleString();
  const creatorName = stream.creatorName ?? "SoundKit Creator";
  const initials = getInitials(creatorName);

  return (
    <NativeCardShell
      href={`/live/streams/${stream.id}`}
      width={fluid ? 0 : STREAM_CARD_WIDTH}
    >
      <View style={styles.thumbRatio}>
        <View style={styles.broadcastStage}>
          <View style={styles.stageGlow} />
          {stream.creatorAvatar ? (
            <NativeImage
              source={stream.creatorAvatar}
              style={styles.stageAvatar}
            />
          ) : (
            <View
              style={[
                styles.stageAvatarFallback,
                { backgroundColor: theme.primary },
              ]}
            >
              <Text style={styles.stageAvatarText}>{initials}</Text>
            </View>
          )}
        </View>

        <View style={styles.badgeRow}>
          <CardBadge tone={isLive ? "destructive" : "secondary"}>
            {isLive ? "Live" : (stream.status ?? "Offline")}
          </CardBadge>
          {stream.genre ? <CardBadge>{stream.genre}</CardBadge> : null}
        </View>

        <View style={styles.viewerPill}>
          {isLive ? <View style={styles.liveDot} /> : null}
          <Text style={styles.viewerPillText}>
            {isLive ? `${viewers} viewers` : (stream.status ?? "Offline")}
          </Text>
        </View>
      </View>

      <View style={styles.metaContainer}>
        {stream.creatorAvatar ? (
          <NativeImage
            source={stream.creatorAvatar}
            style={styles.authorAvatar}
          />
        ) : (
          <View
            style={[
              styles.authorAvatarFallback,
              { backgroundColor: theme.muted },
            ]}
          >
            <Text
              style={[styles.authorAvatarFallbackText, { color: theme.text }]}
            >
              {initials}
            </Text>
          </View>
        )}

        <View style={styles.infoCol}>
          <Text numberOfLines={1} style={[styles.title, { color: theme.text }]}>
            {stream.title}
          </Text>
          <View style={styles.creatorRow}>
            <Text
              numberOfLines={1}
              style={[styles.creatorName, { color: theme.mutedText }]}
            >
              {creatorName}
            </Text>
            <Ionicons color={theme.primary} name="checkmark-circle" size={12} />
          </View>
          <Text
            numberOfLines={1}
            style={[styles.categoryText, { color: theme.mutedText }]}
          >
            {stream.genre ?? "Music Broadcast"}
          </Text>
        </View>
      </View>
    </NativeCardShell>
  );
}

const styles = StyleSheet.create({
  authorAvatar: {
    borderRadius: 8,
    height: 36,
    width: 36,
  },
  authorAvatarFallback: {
    alignItems: "center",
    borderRadius: 8,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  authorAvatarFallbackText: {
    fontSize: 12,
    fontWeight: "700",
  },
  badgeRow: {
    flexDirection: "row",
    gap: 6,
    left: 8,
    position: "absolute",
    top: 8,
  },
  broadcastStage: {
    alignItems: "center",
    backgroundColor: "#13121C",
    height: "100%",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
    width: "100%",
  },
  categoryText: {
    fontSize: 11,
    lineHeight: 14,
  },
  creatorName: {
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 16,
  },
  creatorRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  infoCol: {
    flex: 1,
    gap: 2,
  },
  liveDot: {
    backgroundColor: "#E5484D",
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  metaContainer: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 2,
    paddingTop: 4,
  },
  stageAvatar: {
    borderColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 26,
    borderWidth: 2,
    height: 52,
    width: 52,
  },
  stageAvatarFallback: {
    alignItems: "center",
    borderColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 26,
    borderWidth: 2,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  stageAvatarText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  stageGlow: {
    backgroundColor: "rgba(184, 163, 255, 0.14)",
    borderRadius: 999,
    height: 100,
    position: "absolute",
    width: 100,
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
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: -0.2,
    lineHeight: 18,
  },
  viewerPill: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    borderRadius: 6,
    bottom: 8,
    flexDirection: "row",
    gap: 5,
    left: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    position: "absolute",
  },
  viewerPillText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
});
