import assert from "node:assert/strict";
import { test } from "node:test";

import { fallbackReviewBodies } from "./code-review-result.mjs";

function report(content = "A finding outside the diff.") {
  return {
    comments: [{ content, path: "source.ts" }],
    manifest: {
      coverage: {
        completed: [{ item_id: "source" }],
        failed: [],
        selected: [{ item_id: "source" }],
      },
      input: { resolved_head: "target" },
      terminal_state: "complete",
    },
    status: "complete",
  };
}

test("fallback preserves findings and marks the exact reviewed commit", () => {
  const bodies = fallbackReviewBodies(report(), "target");
  assert.equal(bodies.length, 1);
  assert.match(bodies[0], /commit target/u);
  assert.match(bodies[0], /A finding outside the diff/u);
});

test("fallback never makes partial coverage or a stale head look published", () => {
  const partial = report();
  partial.status = "partial";
  assert.throws(() => fallbackReviewBodies(partial, "target"));
  assert.throws(() => fallbackReviewBodies(report(), "different"));
  assert.throws(() =>
    fallbackReviewBodies({ ...report(), comments: [] }, "target")
  );
});

test("long fallback reports preserve the complete text across bounded comments", () => {
  const bodies = fallbackReviewBodies(
      report("abcdefghij".repeat(20)),
      "target",
      70
    ),
    joined = bodies
      .map((body) => body.split("\n\n").slice(1).join("\n\n"))
      .join("");
  assert.deepEqual(JSON.parse(joined).content, "abcdefghij".repeat(20));
  assert.ok(bodies.every((body) => body.length < 400));
});

test("fallback boundaries retain Unicode and reject an invalid chunk size", () => {
  const bodies = fallbackReviewBodies(report("🎧".repeat(60)), "target", 71),
    joined = bodies
      .map((body) => body.split("\n\n").slice(1).join("\n\n"))
      .join("");
  assert.equal(JSON.parse(joined).content, "🎧".repeat(60));
  assert.throws(() => fallbackReviewBodies(report(), "target", 0));
});
