export function assertCompleteReview(result) {
  const manifest = result?.manifest,
    reviewedItems = new Set(
      [
        ...(manifest?.coverage?.completed ?? []),
        ...(manifest?.coverage?.reused ?? []),
      ].map((item) => item.item_id)
    );
  if (
    result?.status !== "complete" ||
    manifest?.terminal_state !== "complete" ||
    !Array.isArray(manifest.coverage?.selected) ||
    !Array.isArray(manifest.coverage?.completed) ||
    (manifest.coverage.failed?.length ?? 0) > 0
  ) {
    throw new Error(
      "Open Code Review did not complete; inspect the saved report."
    );
  }
  if (
    manifest.coverage.selected.some((item) => !reviewedItems.has(item.item_id))
  ) {
    throw new Error("Open Code Review left selected files unreviewed.");
  }
}
