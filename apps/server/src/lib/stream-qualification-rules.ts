export const shouldExcludeArtistSeatStream = ({
  artistPlanMemberUserIds,
  listenerUserId,
}: {
  artistPlanMemberUserIds: readonly string[];
  listenerUserId: string | null | undefined;
}) =>
  Boolean(listenerUserId && artistPlanMemberUserIds.includes(listenerUserId));

export const streamQualificationRuleVersion = 1;

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
