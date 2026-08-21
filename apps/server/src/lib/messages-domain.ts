/* eslint-disable one-var, require-unicode-regexp, typescript/no-non-null-assertion */
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
      if (!normalized) {
        return true;
      }
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

export interface ConversationUnreadEntry {
  conversationId: string;
  conversationType: "battle_live" | "direct" | "group";
  participantUserId: string | null;
  unreadCount: number;
}

export const resolveConversationUnreadCount = ({
  conversationId,
  conversationType,
  entries,
  participantUserId,
}: {
  conversationId: string;
  conversationType: ConversationUnreadEntry["conversationType"];
  entries: ConversationUnreadEntry[];
  participantUserId: string | null;
}): number => {
  if (conversationType !== "direct" || !participantUserId) {
    return (
      entries.find((entry) => entry.conversationId === conversationId)
        ?.unreadCount ?? 0
    );
  }

  let unreadCount = 0;
  for (const entry of entries) {
    if (
      entry.conversationType === "direct" &&
      entry.participantUserId === participantUserId
    ) {
      unreadCount += entry.unreadCount;
    }
  }
  return unreadCount;
};

export const normalizeParticipantIds = ({
  currentUserId,
  participantUserIds,
}: {
  currentUserId: string;
  participantUserIds: string[];
}): string[] => {
  const set = new Set(
    participantUserIds.filter((id) => id && id !== currentUserId)
  );
  return [...set];
};
