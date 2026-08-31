import type { MessageSummary } from "./soundkit-api-hooks";

export interface OptimisticMessageCollection {
  delete: (key: string) => {
    isPersisted: { promise: Promise<unknown> };
  };
  has: (key: string) => boolean;
}

const isCollaborationAttachment = (
  attachment: MessageSummary["attachments"][number]
) =>
  attachment.mimeType === "soundkit/collaboration-proposal" ||
  attachment.mimeType === "soundkit/collaboration-accepted" ||
  Boolean(attachment.collaboration);

export const reconcileCollaborationMessages = (messages: MessageSummary[]) => {
  const authoritativeTitles = new Set(
    messages
      .filter((message) => !message.id.startsWith("local-collaboration-"))
      .flatMap((message) =>
        message.attachments
          .filter(isCollaborationAttachment)
          .map((attachment) => attachment.displayName)
      )
  );

  return messages.filter((message) => {
    if (!message.id.startsWith("local-collaboration-")) {
      return true;
    }

    return !message.attachments.some((attachment) =>
      authoritativeTitles.has(attachment.displayName)
    );
  });
};

export const removeOptimisticMessage = async (
  collection: OptimisticMessageCollection,
  messageId: string
) => {
  if (!collection.has(messageId)) {
    return;
  }

  await collection.delete(messageId).isPersisted.promise;
};
