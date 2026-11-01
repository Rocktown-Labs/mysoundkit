import assert from "node:assert/strict";
import { test } from "node:test";

import { assertCompleteReview } from "./code-review-result.mjs";

const complete = () => ({
  manifest: {
    coverage: {
      completed: [{ item_id: "a" }],
      selected: [{ item_id: "a" }],
    },
    terminal_state: "complete",
  },
  status: "complete",
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
