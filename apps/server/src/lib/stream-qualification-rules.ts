export const shouldExcludeArtistSeatStream = ({
  artistPlanMemberUserIds,
  listenerUserId,
}: {
  artistPlanMemberUserIds: readonly string[];
  listenerUserId: string | null | undefined;
}) =>
  Boolean(listenerUserId && artistPlanMemberUserIds.includes(listenerUserId));
