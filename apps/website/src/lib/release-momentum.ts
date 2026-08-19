import type { TrackSummary } from "./soundkit-api-hooks";

export const isReleasedTrack = (
  track: Pick<TrackSummary, "isPublic" | "releaseAt" | "releaseStrategy">,
  now = Date.now()
) => {
  const releaseAt = track.releaseAt
    ? new Date(track.releaseAt).getTime()
    : null;

  return Boolean(
    track.isPublic &&
    track.releaseStrategy !== "private" &&
    (releaseAt === null || releaseAt <= now)
  );
};
