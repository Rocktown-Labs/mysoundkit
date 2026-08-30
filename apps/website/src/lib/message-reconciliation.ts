export interface OptimisticMessageCollection {
  delete: (key: string) => {
    isPersisted: { promise: Promise<unknown> };
  };
  has: (key: string) => boolean;
}

export const removeOptimisticMessage = async (
  collection: OptimisticMessageCollection,
  messageId: string
) => {
  if (!collection.has(messageId)) {
    return;
  }

  await collection.delete(messageId).isPersisted.promise;
};
