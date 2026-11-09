import assert from "node:assert/strict";
import test from "node:test";

import { previewHostPr } from "./preview-hosts.mjs";

test("cleanup recognizes only the exact legacy and isolated preview hosts", () => {
  for (const host of [
    "soundkit-web-pr-535.mysoundkit.com",
    "api-pr-535.mysoundkit.com",
    "bio-pr-535.mysoundkit.com",
    "pr-535.preview.soundkit.bio",
    "api.pr-535.preview.soundkit.bio",
    "bio.pr-535.preview.soundkit.bio",
  ]) {
    assert.equal(previewHostPr(host), 535);
  }
});

test("cleanup excludes production, persistent staging and lookalike names", () => {
  for (const host of [
    "mysoundkit.com",
    "api.mysoundkit.com",
    "soundkit.bio",
    "staging.soundkit.bio",
    "api.staging.soundkit.bio",
    "bio.staging.soundkit.bio",
    "api.pr-535.preview.soundkit.bio.evil.test",
    "unrelated-pr-535.mysoundkit.com",
    "evil.api-pr-535.mysoundkit.com",
    "pr-0.preview.soundkit.bio",
    "pr-01.preview.soundkit.bio",
    "pr-535.staging.soundkit.bio",
    undefined,
  ]) {
    assert.equal(previewHostPr(host), null);
  }
});
