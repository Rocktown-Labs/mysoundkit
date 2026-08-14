export interface CandidateUser {
  displayName: string;
  email?: string | null;
  stageName?: string | null;
  userId: string;
  username?: string | null;
}

export const filterSearchCandidates = ({
  candidates,
  currentUserId,
  query,
}: {
  candidates: CandidateUser[];
  currentUserId: string;
  query: string;
}): CandidateUser[] => {
  const normalized = query.trim().replace(/^@/, "").toLowerCase();

  return candidates
    .filter((user) => user.userId !== currentUserId)
    .filter((user) => {
      if (!normalized) return true;
      return [user.displayName, user.username, user.email, user.stageName]
        .filter(Boolean)
        .some((field) => field?.toLowerCase().includes(normalized));
    });
};

export const resolveConversationTitle = ({
  customTitle,
  participantNames,
}: {
  customTitle?: string | null;
  participantNames: string[];
}): string => {
  if (customTitle && customTitle.trim().length > 0) {
    return customTitle.trim();
  }
  if (participantNames.length === 0) {
    return "New Conversation";
  }
  if (participantNames.length === 1) {
    return participantNames[0]!;
  }
  return participantNames.join(", ");
};

export const normalizeParticipantIds = ({
  currentUserId,
  participantUserIds,
}: {
  currentUserId: string;
  participantUserIds: string[];
}): string[] => {
  const set = new Set(participantUserIds.filter((id) => id && id !== currentUserId));
  return Array.from(set);
};
