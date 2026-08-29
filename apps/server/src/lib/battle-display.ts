/* eslint-disable one-var */
import { canonicalGenreName } from "@/lib/genre-catalog";

export type BattleReplayStatus = "available" | "none" | "processing";

export interface BattleDemandRow {
  id: string;
  queueSize: number;
  status: "archived" | "completed" | "live" | "scheduled";
  viewerCount: number;
}

const replayRecordingStatuses = new Set([
  "INVOKED",
  "RECORDING",
  "UPLOADING",
  "UPLOADED",
]);

export const battleHasPlayedTurn = ({
  experienceStartedAt,
  outcome,
  roundStatuses,
}: {
  experienceStartedAt?: Date | null;
  outcome?: string | null;
  roundStatuses: readonly string[];
}) =>
  Boolean(experienceStartedAt) ||
  outcome === "forfeited" ||
  outcome === "quit" ||
  roundStatuses.includes("completed");

export const isDurableReplayPlaybackUrl = (url?: string | null) => {
  if (!url) {
    return false;
  }

  try {
    return new URL(url).pathname.includes("/media/live-recordings/");
  } catch {
    return url.startsWith("/media/live-recordings/");
  }
};

export const resolveBattleReplayStatus = ({
  recordingStatus,
  replayPublishedAt,
  replayVideoAvailable,
}: {
  recordingStatus?: string | null;
  replayPublishedAt?: Date | null;
  replayVideoAvailable: boolean;
}): BattleReplayStatus => {
  if (replayVideoAvailable) {
    return "available";
  }

  if (
    replayPublishedAt ||
    (recordingStatus && replayRecordingStatuses.has(recordingStatus))
  ) {
    return "processing";
  }

  return "none";
};

export const formatArtistBattleTitle = (genre: string) =>
  `Artist Battle - ${canonicalGenreName(genre)}`;

export const resolveArtistBattleTitle = (title: string, genre: string) =>
  title === "SoundKit Artist Battle" ? formatArtistBattleTitle(genre) : title;

export const battleDemandScore = ({
  queueSize,
  status,
  viewerCount,
}: Pick<BattleDemandRow, "queueSize" | "status" | "viewerCount">) =>
  status === "live" ? viewerCount : queueSize;

export const rankFeaturedBattleIds = (
  battleRows: BattleDemandRow[],
  limit: number
) =>
  new Map(
    battleRows
      .filter(
        (battle) =>
          (battle.status === "live" || battle.status === "scheduled") &&
          battleDemandScore(battle) > 0
      )
      .toSorted(
        (first, second) =>
          battleDemandScore(second) - battleDemandScore(first) ||
          first.id.localeCompare(second.id)
      )
      .slice(0, limit)
      .map((battle, index) => [battle.id, index + 1])
  );
