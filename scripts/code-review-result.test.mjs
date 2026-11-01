import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertCompleteReview,
  assertReviewPublication,
} from "./code-review-result.mjs";

const complete = () => ({
    manifest: {
      coverage: {
        completed: [{ item_id: "a" }],
        selected: [{ item_id: "a" }],
      },
      terminal_state: "complete",
    },
    status: "complete",
  }),
  publication = (result = complete()) => ({
    commentsFailed: "0",
    rangeReason: "ok",
    result,
    reviewedHead: "head",
    targetHead: "head",
  }),
  skipped = () => ({
    manifest: {
      coverage: { completed: [], failed: [], reused: [], selected: [] },
      terminal_state: "skipped",
    },
    status: "skipped",
  });

test("accepts completed coverage, including a budget reached after the final file", () => {
  assert.doesNotThrow(() =>
    assertCompleteReview({ ...complete(), summary: { budget_exceeded: true } })
  );
});
test("rejects partial output even when OCR exits successfully", () => {
  assert.throws(() =>
    assertCompleteReview({ ...complete(), status: "partial" })
  );
});
test("rejects missing coverage and a falsely complete report", () => {
  assert.throws(() => assertCompleteReview({ status: "complete" }));
  const result = complete();
  result.manifest.coverage.completed = [];
  assert.throws(() => assertCompleteReview(result));
});

test("accepts files reused from a completed session", () => {
  const result = complete();
  result.manifest.coverage.reused = result.manifest.coverage.completed;
  result.manifest.coverage.completed = [];
  assert.doesNotThrow(() => assertCompleteReview(result));
});

test("accepts zero-eligible-file reviews but refuses skipped selected files", () => {
  assert.doesNotThrow(() => assertCompleteReview(skipped()));
  assert.throws(() =>
    assertCompleteReview({ ...complete(), status: "skipped" })
  );
});
test("publication requires the target checkpoint for a completed range", () => {
  assert.doesNotThrow(() => assertReviewPublication(publication()));
  assert.throws(() =>
    assertReviewPublication({ ...publication(), reviewedHead: "old" })
  );
});
test("same-head reruns and docs-only runs do not need a new checkpoint", () => {
  assert.doesNotThrow(() =>
    assertReviewPublication({
      ...publication(),
      rangeReason: "same_head_noop",
      reviewedHead: "",
    })
  );
  assert.doesNotThrow(() =>
    assertReviewPublication({ ...publication(skipped()), reviewedHead: "" })
  );
});
test("no-work exceptions cannot hide partial results or failed publication", () => {
  assert.throws(() =>
    assertReviewPublication({
      ...publication({ ...complete(), status: "partial" }),
      rangeReason: "same_head_noop",
    })
  );
  assert.throws(() =>
    assertReviewPublication({ ...publication(skipped()), commentsFailed: "1" })
  );
  assert.throws(() =>
    assertReviewPublication({ ...publication(), commentsFailed: undefined })
  );
});
test("rejects a report from a different head, even on reruns", () => {
  const result = complete();
  result.manifest.input = { resolved_head: "old" };
  assert.throws(() =>
    assertReviewPublication({
      ...publication(result),
      rangeReason: "same_head_noop",
    })
  );
});
