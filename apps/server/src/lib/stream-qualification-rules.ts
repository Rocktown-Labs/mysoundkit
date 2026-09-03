export const shouldExcludeArtistSeatStream = ({
  artistPlanMemberUserIds,
  listenerUserId,
}: {
  artistPlanMemberUserIds: readonly string[];
  listenerUserId: string | null | undefined;
}) =>
  Boolean(listenerUserId && artistPlanMemberUserIds.includes(listenerUserId));

export const streamQualificationRuleVersion = 1;
export const MAX_PLAYBACK_PROGRESS_GRACE_SECONDS = 5;

export const minimumPlayedSecondsForQualification = ({
  durationSeconds,
  thresholdPercent,
  thresholdSeconds,
}: {
  durationSeconds: number;
  thresholdPercent: number;
  thresholdSeconds: number;
}) => {
  if (!(Number.isFinite(durationSeconds) && durationSeconds > 0)) {
    return Number.POSITIVE_INFINITY;
  }

  const percentThreshold = Math.ceil(
    durationSeconds * (Math.max(0, thresholdPercent) / 100)
  );

  if (thresholdSeconds <= 0) {
    return percentThreshold;
  }

  return Math.min(percentThreshold, thresholdSeconds);
};

export const hasReachedQualifiedPlayback = ({
  durationSeconds,
  playedSeconds,
  thresholdPercent,
  thresholdSeconds,
}: {
  durationSeconds: number;
  playedSeconds: number;
  thresholdPercent: number;
  thresholdSeconds: number;
}) =>
  playedSeconds >=
  minimumPlayedSecondsForQualification({
    durationSeconds,
    thresholdPercent,
    thresholdSeconds,
  });

/**
 * Prevent a client from jumping the server-side progress clock to the end of a
 * track. The small grace window covers network delay and timer jitter; live
 * server-recorded sessions bypass this helper.
 */
export const acceptedPlaybackSeconds = ({
  durationSeconds,
  elapsedSeconds,
  previousPlayedSeconds,
  reportedPlayedSeconds,
}: {
  durationSeconds: number;
  elapsedSeconds: number;
  previousPlayedSeconds: number;
  reportedPlayedSeconds: number;
}) => {
  const safePreviousSeconds = Math.max(0, previousPlayedSeconds),
    safeReportedSeconds = Number.isFinite(reportedPlayedSeconds)
      ? Math.max(safePreviousSeconds, reportedPlayedSeconds)
      : safePreviousSeconds,
    safeElapsedSeconds = Number.isFinite(elapsedSeconds)
      ? Math.max(0, elapsedSeconds)
      : 0,
    maxAcceptedSeconds =
      safePreviousSeconds +
      safeElapsedSeconds +
      MAX_PLAYBACK_PROGRESS_GRACE_SECONDS,
    cappedSeconds = Math.min(safeReportedSeconds, maxAcceptedSeconds);

  return Math.floor(
    Number.isFinite(durationSeconds) && durationSeconds > 0
      ? Math.min(cappedSeconds, durationSeconds)
      : cappedSeconds
  );
};

export const qualificationWindowKey = ({
  deduplicationWindowHours,
  occurredAt,
}: {
  deduplicationWindowHours: number;
  occurredAt: Date;
}) => {
  const windowMs = Math.max(1, deduplicationWindowHours) * 60 * 60 * 1000;

  return String(Math.floor(occurredAt.getTime() / windowMs));
};
