import type { BattleKitTrackInput } from "./battle-kits";
import {
  evaluateBattleKitReadiness,
  requiredMainTracksForFormat,
} from "./battle-kits";

export type BattleRoundFormat = "best_of_3" | "best_of_5" | "best_of_7";
export type BattleRoundStatus = "active" | "upcoming";

export interface BattleLineupSnapshotInput {
  artistUserId: string;
  tracks: unknown;
}

export interface BattleRoundSeed {
  battleId: string;
  id: string;
  isTiebreaker: boolean;
  roundNumber: number;
  status: BattleRoundStatus;
  trackOneId: string;
  trackTwoId: string;
}

const isBattleKitTrack = (value: unknown): value is BattleKitTrackInput =>
  typeof value === "object" &&
  value !== null &&
  "trackId" in value &&
  typeof value.trackId === "string" &&
  value.trackId.trim().length > 0 &&
  "role" in value &&
  (value.role === "main" || value.role === "tiebreaker") &&
  "mainSlot" in value &&
  (typeof value.mainSlot === "number" || value.mainSlot === null);

export const parseBattleLineupTracks = (
  value: unknown
): BattleKitTrackInput[] =>
  Array.isArray(value) ? value.filter(isBattleKitTrack) : [];

export const buildBattleRoundSeeds = ({
  artistA,
  artistB,
  battleId,
  format,
  status,
}: {
  artistA?: BattleLineupSnapshotInput;
  artistB?: BattleLineupSnapshotInput;
  battleId: string;
  format: BattleRoundFormat;
  status: "live" | "scheduled";
}): BattleRoundSeed[] | null => {
  if (!(artistA && artistB)) {
    return null;
  }

  const artistATracks = parseBattleLineupTracks(artistA.tracks),
    artistBTracks = parseBattleLineupTracks(artistB.tracks),
    artistAReadiness = evaluateBattleKitReadiness({
      format,
      tracks: artistATracks,
    }),
    artistBReadiness = evaluateBattleKitReadiness({
      format,
      tracks: artistBTracks,
    });

  if (!(artistAReadiness.isBattleReady && artistBReadiness.isBattleReady)) {
    return null;
  }

  const mainTrackCount = requiredMainTracksForFormat(format),
    artistAMainTracks = new Map(
      artistATracks
        .filter((track) => track.role === "main")
        .map((track) => [track.mainSlot, track.trackId])
    ),
    artistBMainTracks = new Map(
      artistBTracks
        .filter((track) => track.role === "main")
        .map((track) => [track.mainSlot, track.trackId])
    ),
    artistATiebreaker = artistATracks.find(
      (track) => track.role === "tiebreaker"
    ),
    artistBTiebreaker = artistBTracks.find(
      (track) => track.role === "tiebreaker"
    );

  if (!(artistATiebreaker && artistBTiebreaker)) {
    return null;
  }

  const rounds: BattleRoundSeed[] = [];
  for (let roundNumber = 1; roundNumber <= mainTrackCount; roundNumber += 1) {
    const trackOneId = artistAMainTracks.get(roundNumber),
      trackTwoId = artistBMainTracks.get(roundNumber);
    if (!(trackOneId && trackTwoId)) {
      return null;
    }

    rounds.push({
      battleId,
      id: crypto.randomUUID(),
      isTiebreaker: false,
      roundNumber,
      status: status === "live" && roundNumber === 1 ? "active" : "upcoming",
      trackOneId,
      trackTwoId,
    });
  }

  rounds.push({
    battleId,
    id: crypto.randomUUID(),
    isTiebreaker: true,
    roundNumber: mainTrackCount + 1,
    status: "upcoming",
    trackOneId: artistATiebreaker.trackId,
    trackTwoId: artistBTiebreaker.trackId,
  });

  return rounds;
};
