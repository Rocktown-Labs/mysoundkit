/* eslint-disable one-var, sort-vars */
export const battleKitFormats = [
  "best_of_3",
  "best_of_5",
  "best_of_7",
] as const;

export type BattleKitFormat = (typeof battleKitFormats)[number];
export type BattleKitTrackRole = "main" | "tiebreaker";

export interface BattleKitTrackInput {
  mainSlot: number | null;
  role: BattleKitTrackRole;
  trackId: string;
}

export interface BattleKitReadiness {
  isBattleReady: boolean;
  mainTrackCount: number;
  requiredMainTracks: number;
  tiebreakerCount: number;
  totalUniqueTracks: number;
  totalRequiredTracks: number;
  reason: string | null;
}

export const requiredMainTracksForFormat = (format: BattleKitFormat) =>
  Number(format.slice(-1));

export const evaluateBattleKitReadiness = ({
  format,
  tracks,
}: {
  format: BattleKitFormat;
  tracks: readonly BattleKitTrackInput[];
}): BattleKitReadiness => {
  const requiredMainTracks = requiredMainTracksForFormat(format),
    mainTracks = tracks.filter((track) => track.role === "main"),
    tiebreakers = tracks.filter((track) => track.role === "tiebreaker"),
    uniqueTrackIds = new Set(tracks.map((track) => track.trackId)),
    hasDuplicateTracks = uniqueTrackIds.size !== tracks.length,
    hasInvalidMainSlots = mainTracks.some(
      (track, index) => track.mainSlot !== index + 1
    ),
    hasUnexpectedRoleCount =
      mainTracks.length > requiredMainTracks || tiebreakers.length > 1,
    isBattleReady =
      !hasDuplicateTracks &&
      !hasInvalidMainSlots &&
      !hasUnexpectedRoleCount &&
      mainTracks.length === requiredMainTracks &&
      tiebreakers.length === 1 &&
      tiebreakers[0]?.mainSlot === null;

  let reason: string | null = null;
  if (hasDuplicateTracks) {
    reason = "A track can only appear once in a Battle Kit.";
  } else if (hasInvalidMainSlots) {
    reason = "Main tracks must occupy consecutive slots.";
  } else if (hasUnexpectedRoleCount) {
    reason = `A ${format.replaceAll("_", " ")} kit supports ${requiredMainTracks} main tracks and one tiebreaker.`;
  } else if (mainTracks.length < requiredMainTracks) {
    reason = `Choose ${requiredMainTracks - mainTracks.length} more main track${requiredMainTracks - mainTracks.length === 1 ? "" : "s"}.`;
  } else if (tiebreakers.length === 0) {
    reason = "Choose one unique tiebreaker.";
  }

  return {
    isBattleReady,
    mainTrackCount: mainTracks.length,
    reason,
    requiredMainTracks,
    tiebreakerCount: tiebreakers.length,
    totalRequiredTracks: requiredMainTracks + 1,
    totalUniqueTracks: uniqueTrackIds.size,
  };
};

export const validateBattleKitTracks = ({
  format,
  tracks,
}: {
  format: BattleKitFormat;
  tracks: readonly BattleKitTrackInput[];
}) => {
  const requiredMainTracks = requiredMainTracksForFormat(format),
    mainTracks = tracks.filter((track) => track.role === "main"),
    tiebreakers = tracks.filter((track) => track.role === "tiebreaker"),
    readiness = evaluateBattleKitReadiness({ format, tracks });

  if (tracks.some((track) => !track.trackId.trim())) {
    return "Every Battle Kit slot must contain a track.";
  }

  if (new Set(tracks.map((track) => track.trackId)).size !== tracks.length) {
    return "A track can only appear once in a Battle Kit.";
  }

  if (mainTracks.length > requiredMainTracks) {
    return `A ${format.replaceAll("_", " ")} kit supports ${requiredMainTracks} main tracks.`;
  }

  if (tiebreakers.length > 1) {
    return "A Battle Kit can only have one tiebreaker.";
  }

  if (
    mainTracks.some(
      (track, index) => track.mainSlot !== index + 1 || track.mainSlot === null
    )
  ) {
    return "Main tracks must occupy consecutive slots starting at slot 1.";
  }

  if (tiebreakers.some((track) => track.mainSlot !== null)) {
    return "The tiebreaker must not occupy a main track slot.";
  }

  return readiness.reason && readiness.isBattleReady ? readiness.reason : null;
};
