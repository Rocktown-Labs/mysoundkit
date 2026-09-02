import { describe, expect, it, vi } from "vitest";

import {
  reconcileCollaborationMessages,
  removeOptimisticMessage,
} from "./message-reconciliation";
import type { MessageSummary } from "./soundkit-api-hooks";

const makeMessage = (
  overrides: Partial<MessageSummary> = {}
): MessageSummary => ({
  attachments: [],
  body: "",
  createdAt: "2026-08-31T12:00:00.000Z",
  id: "message",
  senderId: "artist",
  status: "sent",
  ...overrides,
});

describe("reconcileCollaborationMessages", () => {
  it("removes a stale local proposal after its server message arrives", () => {
    const messages = [
      makeMessage({
        attachments: [
          {
            collaboration: null,
            displayName: "Shared EP",
            id: "local-attachment-local-collaboration-1",
            mimeType: "soundkit/collaboration-proposal",
            objectKey: null,
            sizeBytes: null,
            sourceProjectId: null,
            sourceTrackId: null,
            url: "/dashboard/messages",
          },
        ],
        id: "local-collaboration-1",
      }),
      makeMessage({
        attachments: [
          {
            collaboration: {
              expiresAt: "2026-09-01T12:00:00.000Z",
              href: "/dashboard/projects/project-1",
              id: "proposal-1",
              kind: "project",
              status: "accepted",
              targetId: "project-1",
            },
            displayName: "Shared EP",
            id: "server-attachment-1",
            mimeType: "soundkit/collaboration-proposal",
            objectKey: null,
            sizeBytes: null,
            sourceProjectId: "project-1",
            sourceTrackId: null,
            url: "/dashboard/projects/project-1",
          },
        ],
        id: "server-message-1",
      }),
    ];

    expect(
      reconcileCollaborationMessages(messages).map((message) => message.id)
    ).toEqual(["server-message-1"]);
  });

  it("keeps local proposals while the server has not acknowledged them", () => {
    const message = makeMessage({
      attachments: [
        {
          collaboration: null,
          displayName: "New EP",
          id: "local-attachment-local-collaboration-2",
          mimeType: "soundkit/collaboration-proposal",
          objectKey: null,
          sizeBytes: null,
          sourceProjectId: null,
          sourceTrackId: null,
          url: "/dashboard/messages",
        },
      ],
      id: "local-collaboration-2",
    });

    expect(reconcileCollaborationMessages([message])).toEqual([message]);
  });
});

describe("removeOptimisticMessage", () => {
  it("removes an optimistic message and waits for its transaction", async () => {
    const collection = {
      delete: vi.fn(() => ({
        isPersisted: { promise: Promise.resolve() },
      })),
      has: vi.fn(() => true),
    };

    await removeOptimisticMessage(collection, "local-message");

    expect(collection.has).toHaveBeenCalledWith("local-message");
    expect(collection.delete).toHaveBeenCalledWith("local-message");
  });

  it("does nothing when the optimistic message is already gone", async () => {
    const collection = {
      delete: vi.fn(),
      has: vi.fn(() => false),
    };

    await removeOptimisticMessage(collection, "local-message");

    expect(collection.delete).not.toHaveBeenCalled();
  });
});
