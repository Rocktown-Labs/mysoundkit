/* oxlint-disable one-var, sort-vars */
import { StyleSheet, Text, View } from "react-native";

import { CardBadge, NativeCardShell } from "@/components/cards/card-shell";
import { NativeImage } from "@/components/native-image";
import { NAV_THEME } from "@/lib/constants";
import type { BattleSummary } from "@/lib/soundkit-api";
import { useColorScheme } from "@/lib/use-color-scheme";

export const BATTLE_CARD_WIDTH = 260;

function formatDuration(seconds?: number | null) {
  const total = Math.max(0, Math.floor(seconds ?? 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function formatScheduledTime(startsAt?: string | null): string {
  if (!startsAt) {
    return "Upcoming";
  }
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) {
    return "Upcoming";
  }
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  });
}

function getParticipantName(
  participant?: { name: string; username: string | null } | null,
  trackArtist?: string,
  fallback = "Artist"
): string {
  if (participant?.name && participant.name.length > 0) {
    return participant.name;
  }
  if (participant?.username && participant.username.length > 0) {
    return participant.username;
  }
  if (trackArtist && trackArtist.length > 0) {
    return trackArtist;
  }
  return fallback;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/u);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function BattleDuelStage({
  p1AvatarUrl,
  p1Name,
  p2AvatarUrl,
  p2Name,
}: {
  p1AvatarUrl?: string | null;
  p1Name: string;
  p2AvatarUrl?: string | null;
  p2Name: string;
}) {
  return (
    <View style={styles.duelStage}>
      <View style={styles.duelGlow} />
      <View style={styles.participantCol}>
        {p1AvatarUrl ? (
          <NativeImage source={p1AvatarUrl} style={styles.avatarImg} />
        ) : (
          <View style={[styles.avatarFallback, { backgroundColor: "#312252" }]}>
            <Text style={styles.avatarFallbackText}>{getInitials(p1Name)}</Text>
          </View>
        )}
        <View style={styles.namePill}>
          <Text numberOfLines={1} style={styles.namePillText}>
            {p1Name}
          </Text>
        </View>
      </View>

      <View style={styles.vsBadge}>
        <Text style={styles.vsText}>VS</Text>
      </View>

      <View style={styles.participantCol}>
        {p2AvatarUrl ? (
          <NativeImage source={p2AvatarUrl} style={styles.avatarImg} />
        ) : (
          <View style={[styles.avatarFallback, { backgroundColor: "#222B52" }]}>
            <Text style={styles.avatarFallbackText}>{getInitials(p2Name)}</Text>
          </View>
        )}
        <View style={styles.namePill}>
          <Text numberOfLines={1} style={styles.namePillText}>
            {p2Name}
          </Text>
        </View>
      </View>
    </View>
  );
}

function resolveRoundInfo(battle: BattleSummary, isLive: boolean): string {
  if (isLive) {
    const roundTotal = battle.round?.total ?? 3;
    const roundCurrent = battle.round?.current ?? 1;
    const votingLabel = battle.round?.isVoting ? " • Voting open" : "";
    return `Round ${roundCurrent}/${roundTotal}${votingLabel}`;
  }
  if (battle.status === "completed" || battle.status === "archived") {
    return "Completed";
  }
  if (battle.startsAt) {
    return formatScheduledTime(battle.startsAt);
  }
  return "Upcoming";
}

function resolveMatchupSummary(
  p1Name: string,
  p2Name: string,
  tracks?: BattleSummary["tracks"]
): string {
  const t0 = tracks?.[0];
  const t1 = tracks?.[1];
  if (t0?.title && t1?.title) {
    return `${t0.title} (${t0.votes}) vs ${t1.title} (${t1.votes})`;
  }
  return `${p1Name} vs ${p2Name}`;
}

function BattleCardDetails({
  isLive,
  matchupSummary,
  roundInfo,
  title,
  viewerCount,
}: {
  isLive: boolean;
  matchupSummary: string;
  roundInfo: string;
  title: string;
  viewerCount: number;
}) {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;

  return (
    <View style={styles.details}>
      <Text numberOfLines={1} style={[styles.title, { color: theme.text }]}>
        {title}
      </Text>
      <View style={styles.subRow}>
        <Text
          numberOfLines={1}
          style={[styles.subtitle, { color: theme.mutedText }]}
        >
          {roundInfo}
        </Text>
        {isLive ? null : (
          <Text style={[styles.viewerCount, { color: theme.mutedText }]}>
            {viewerCount.toLocaleString()} watching
          </Text>
        )}
      </View>
      <View style={styles.matchupRow}>
        <Text
          numberOfLines={1}
          style={[styles.matchupText, { color: theme.mutedText }]}
        >
          {matchupSummary}
        </Text>
      </View>
    </View>
  );
}

function BattleCardThumbnail({
  battle,
  formatLabel,
  isLive,
  p1AvatarUrl,
  p1Name,
  p2AvatarUrl,
  p2Name,
  trackCoverUrl,
}: {
  battle: BattleSummary;
  formatLabel?: string | null;
  isLive: boolean;
  p1AvatarUrl?: string | null;
  p1Name: string;
  p2AvatarUrl?: string | null;
  p2Name: string;
  trackCoverUrl?: string;
}) {
  return (
    <View style={styles.thumbRatio}>
      {trackCoverUrl ? (
        <NativeImage source={trackCoverUrl} style={styles.thumb} />
      ) : (
        <BattleDuelStage
          p1AvatarUrl={p1AvatarUrl}
          p1Name={p1Name}
          p2AvatarUrl={p2AvatarUrl}
          p2Name={p2Name}
        />
      )}

      <View style={styles.badgeRow}>
        <CardBadge tone={isLive ? "destructive" : "secondary"}>
          {isLive ? "Live" : (battle.status ?? "Upcoming")}
        </CardBadge>
        {battle.genre ? <CardBadge>{battle.genre}</CardBadge> : null}
        {formatLabel ? <CardBadge>{formatLabel}</CardBadge> : null}
      </View>

      {isLive ? (
        <View style={styles.viewerPill}>
          <View style={styles.liveDot} />
          <Text style={styles.viewerPillText}>
            {battle.viewerCount.toLocaleString()} watching
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export function BattleCard({
  battle,
  fluid = false,
}: {
  battle: BattleSummary;
  /** Fill the parent cell (view-all grids) instead of the fixed rail width. */
  fluid?: boolean;
}) {
  const tracks = battle.tracks ?? [];
  const isLive = battle.status === "live";
  const formatLabel = battle.format ? battle.format.replaceAll("_", " ") : null;
  const p1 = battle.participants?.[0];
  const p2 = battle.participants?.[1];
  const p1Name = getParticipantName(p1, tracks[0]?.artist, "Artist 1");
  const p2Name = getParticipantName(p2, tracks[1]?.artist, "Artist 2");
  const trackCoverUrl = tracks[0]?.cover ?? tracks[1]?.cover ?? undefined;
  const roundInfo = resolveRoundInfo(battle, isLive);
  const matchupSummary = resolveMatchupSummary(p1Name, p2Name, tracks);

  return (
    <NativeCardShell
      href={`/live/battles/${battle.id}`}
      width={fluid ? 0 : BATTLE_CARD_WIDTH}
    >
      <BattleCardThumbnail
        battle={battle}
        formatLabel={formatLabel}
        isLive={isLive}
        p1AvatarUrl={p1?.avatarUrl}
        p1Name={p1Name}
        p2AvatarUrl={p2?.avatarUrl}
        p2Name={p2Name}
        trackCoverUrl={trackCoverUrl}
      />
      <BattleCardDetails
        isLive={isLive}
        matchupSummary={matchupSummary}
        roundInfo={roundInfo}
        title={battle.title}
        viewerCount={battle.viewerCount}
      />
    </NativeCardShell>
  );
}

const styles = StyleSheet.create({
  avatarFallback: {
    alignItems: "center",
    borderColor: "rgba(255, 255, 255, 0.4)",
    borderRadius: 24,
    borderWidth: 1.5,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  avatarFallbackText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  avatarImg: {
    borderColor: "rgba(255, 255, 255, 0.4)",
    borderRadius: 24,
    borderWidth: 1.5,
    height: 48,
    width: 48,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    left: 8,
    position: "absolute",
    top: 8,
  },
  details: {
    gap: 3,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  duelGlow: {
    backgroundColor: "rgba(184, 163, 255, 0.12)",
    borderRadius: 999,
    height: 120,
    position: "absolute",
    width: 120,
  },
  duelStage: {
    alignItems: "center",
    backgroundColor: "#161320",
    flexDirection: "row",
    height: "100%",
    justifyContent: "space-around",
    overflow: "hidden",
    paddingHorizontal: 16,
    position: "relative",
    width: "100%",
  },
  liveDot: {
    backgroundColor: "#E5484D",
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  matchupRow: {
    marginTop: 2,
  },
  matchupText: {
    fontSize: 11,
    lineHeight: 14,
  },
  namePill: {
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    borderRadius: 6,
    maxWidth: 90,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  namePillText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
  },
  participantCol: {
    alignItems: "center",
    gap: 6,
    width: 90,
  },
  subRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  subtitle: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  thumb: {
    height: "100%",
    width: "100%",
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
  viewerCount: {
    fontSize: 11,
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
  vsBadge: {
    alignItems: "center",
    backgroundColor: "rgba(10, 10, 14, 0.88)",
    borderColor: "rgba(255, 255, 255, 0.25)",
    borderRadius: 16,
    borderWidth: 1,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  vsText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },
});

export { formatDuration as formatBattleDuration };
