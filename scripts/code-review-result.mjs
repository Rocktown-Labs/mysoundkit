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

// GitHub rejects inline comments outside diff hunks. Preserve every finding in
// ordinary PR comments rather than declaring those findings published or lost.
export function fallbackReviewBodies(result, targetHead, limit = 55_000) {
  assertCompleteReview(result);
  if (!Number.isInteger(limit) || limit < 2 || limit > 55_000) {
    throw new Error(
      "Fallback comment size must be between 2 and 55000 characters."
    );
  }
  if (
    !targetHead ||
    result.manifest.input?.resolved_head !== targetHead ||
    !Array.isArray(result.comments) ||
    result.comments.length === 0
  ) {
    throw new Error(
      "Fallback publication requires findings for the exact target."
    );
  }
  const bodies = [],
    report = result.comments
      .map((finding, index) => {
        if (typeof finding.content !== "string" || !finding.content.trim()) {
          throw new Error("Fallback finding has no content.");
        }
        return JSON.stringify(
          {
            category: finding.category,
            content: finding.content,
            end_line: finding.end_line,
            finding: index + 1,
            path: finding.path,
            severity: finding.severity,
            start_line: finding.start_line,
            suggestion: finding.suggestion_code,
          },
          null,
          2
        );
      })
      .join("\n\n");
  for (let offset = 0; offset < report.length;) {
    let end = Math.min(offset + limit, report.length);
    const last = report.codePointAt(end - 1) ?? 0;
    if (end < report.length && last > 65_535) {
      end -= 1;
    }
    bodies.push(
      `Kimi review fallback for commit ${targetHead}, part ${bodies.length + 1}. ` +
        `GitHub could not place every inline finding. This preserves all findings; some also appear inline.\n\n${report.slice(
          offset,
          end
        )}`
    );
    offset = end;
  }
  return bodies;
}

function isSkippedReview(result) {
  return (
    result.status === "skipped" &&
    result.manifest.terminal_state === "skipped" &&
    result.manifest.coverage.selected.length === 0
  );
}
