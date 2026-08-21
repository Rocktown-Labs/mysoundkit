import { describe, expect, it } from "vitest";

import {
  filterSearchCandidates,
  normalizeParticipantIds,
  resolveConversationTitle,
  resolveConversationUnreadCount,
} from "./messages-domain";

describe("Messages Domain & User Search", () => {
  const sampleUsers = [
    {
      displayName: "Luna Eclipse",
      email: "luna@soundkit.test",
      stageName: "Luna Eclipse",
      userId: "user_luna",
      username: "luna",
    },
    {
      displayName: "Marcus Producer",
      email: "marcus@beats.test",
      stageName: null,
      userId: "user_marcus",
      username: "marcusbeats",
    },
    {
      displayName: "Current User",
      email: "me@soundkit.test",
      stageName: "Me",
      userId: "user_current",
      username: "currentuser",
    },
  ];

  describe("filterSearchCandidates", () => {
    it("excludes the current user from search results", () => {
      const results = filterSearchCandidates({
        candidates: sampleUsers,
        currentUserId: "user_current",
        query: "",
      });

      expect(results).toHaveLength(2);
      expect(results.some((u) => u.userId === "user_current")).toBe(false);
    });

    it("filters by username with @ prefix", () => {
      const results = filterSearchCandidates({
        candidates: sampleUsers,
        currentUserId: "user_current",
        query: "@luna",
      });

      expect(results).toHaveLength(1);
      expect(results[0]?.username).toBe("luna");
    });

    it("filters by display name case-insensitively", () => {
      const results = filterSearchCandidates({
        candidates: sampleUsers,
        currentUserId: "user_current",
        query: "marcus",
      });

      expect(results).toHaveLength(1);
      expect(results[0]?.displayName).toBe("Marcus Producer");
    });
  });

  describe("normalizeParticipantIds", () => {
    it("deduplicates IDs and removes current user", () => {
      const ids = normalizeParticipantIds({
        currentUserId: "user_current",
        participantUserIds: [
          "user_luna",
          "user_luna",
          "user_current",
          "user_marcus",
        ],
      });

      expect(ids).toEqual(["user_luna", "user_marcus"]);
    });
  });

  describe("resolveConversationUnreadCount", () => {
    const entries = [
      {
        conversationId: "direct_new",
        conversationType: "direct" as const,
        participantUserId: "user_luna",
        unreadCount: 2,
      },
      {
        conversationId: "direct_legacy",
        conversationType: "direct" as const,
        participantUserId: "user_luna",
        unreadCount: 3,
      },
      {
        conversationId: "group_1",
        conversationType: "group" as const,
        participantUserId: "user_luna",
        unreadCount: 4,
      },
    ];

    it("combines unread messages from deduplicated direct threads", () => {
      expect(
        resolveConversationUnreadCount({
          conversationId: "direct_new",
          conversationType: "direct",
          entries,
          participantUserId: "user_luna",
        })
      ).toBe(5);
    });

    it("keeps group unread counts scoped to their conversation", () => {
      expect(
        resolveConversationUnreadCount({
          conversationId: "group_1",
          conversationType: "group",
          entries,
          participantUserId: "user_luna",
        })
      ).toBe(4);
    });
  });

  describe("resolveConversationTitle", () => {
    it("preserves custom group titles", () => {
      expect(
        resolveConversationTitle({
          customTitle: "Album Collaboration Studio",
          participantNames: ["Luna", "Marcus"],
        })
      ).toBe("Album Collaboration Studio");
    });

    it("combines participant names for unnamed group chats", () => {
      expect(
        resolveConversationTitle({
          customTitle: null,
          participantNames: ["Luna Eclipse", "Marcus Producer"],
        })
      ).toBe("Luna Eclipse, Marcus Producer");
    });

    it("uses single name for direct messages", () => {
      expect(
        resolveConversationTitle({
          customTitle: null,
          participantNames: ["Luna Eclipse"],
        })
      ).toBe("Luna Eclipse");
    });
  });
});
