export interface ReconcileCollection {
  utils: { refetch: () => Promise<unknown> };
}

export const reconcileCollections = async (
  ...collections: ReconcileCollection[]
) => {
  await Promise.all(
    collections.map((collection) => collection.utils.refetch())
  );
};
