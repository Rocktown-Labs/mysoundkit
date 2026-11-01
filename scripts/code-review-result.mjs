export function assertCompleteReview(result) {
  const manifest = result?.manifest,
    reviewedItems = new Set(
      [
        ...(manifest?.coverage?.completed ?? []),
        ...(manifest?.coverage?.reused ?? []),
      ].map((item) => item.item_id)
    );
  if (
    !Array.isArray(manifest?.coverage?.selected) ||
    !Array.isArray(manifest.coverage.completed) ||
    (manifest.coverage.failed?.length ?? 0) > 0
  ) {
    throw new Error(
      "Open Code Review lacks successful coverage; inspect the saved report."
    );
  }
  if (isSkippedReview(result)) {
    return;
  }
  if (result.status !== "complete" || manifest.terminal_state !== "complete") {
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

export function assertReviewPublication({
  result,
  rangeReason,
  reviewedHead,
  targetHead,
  commentsFailed,
}) {
  assertCompleteReview(result);
  if (!targetHead || (commentsFailed !== "0" && commentsFailed !== 0)) {
    throw new Error(
      "Review target is missing or findings could not be published."
    );
  }
  if (
    result.manifest.input?.resolved_head &&
    result.manifest.input.resolved_head !== targetHead
  ) {
    throw new Error("Review report does not match the target commit.");
  }
  if (
    result.status !== "skipped" &&
    rangeReason !== "same_head_noop" &&
    reviewedHead !== targetHead
  ) {
    throw new Error("Review checkpoint did not advance to the target commit.");
  }
}

function isSkippedReview(result) {
  return (
    result.status === "skipped" &&
    result.manifest.terminal_state === "skipped" &&
    result.manifest.coverage.selected.length === 0
  );
}
