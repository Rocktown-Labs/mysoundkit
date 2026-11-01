import assert from "node:assert/strict";
import { test } from "node:test";

import { collectClosedPreviewHyperdrives } from "./preview-hyperdrives.mjs";

test("only selects exact SoundKit preview names belonging to closed PRs", async () => {
  const names = [
      "soundkit-hyperdrive-prod",
      "soundkit-hyperdrive-newrgm",
      "other-hyperdrive-pr-6",
      "soundkit-hyperdrive-pr-6",
      "soundkit-hyperdrive-pr-7",
      "soundkit-hyperdrive-pr-8",
      "soundkit-hyperdrive-pr-9",
      "soundkit-hyperdrive-pr-10-extra",
    ],
    selected = await collectClosedPreviewHyperdrives(
      () => names.map((name) => ({ id: name, name })),
      (number) =>
        ({ 6: "MERGED", 7: "CLOSED", 8: "OPEN", 9: "UNKNOWN" })[number]
    );
  assert.deepEqual(
    selected.map((item) => item.name),
    ["soundkit-hyperdrive-pr-6", "soundkit-hyperdrive-pr-7"]
  );
});

test("continues beyond a full page and fails closed on API/GitHub errors", async () => {
  const pages = [],
    selected = await collectClosedPreviewHyperdrives(
      (page) => {
        pages.push(page);
        return page === 1
          ? Array.from({ length: 100 }, () => ({
              id: "prod",
              name: "soundkit-hyperdrive-prod",
            }))
          : [{ id: "closed", name: "soundkit-hyperdrive-pr-11" }];
      },
      () => "CLOSED"
    );
  assert.deepEqual(pages, [1, 2]);
  assert.equal(selected.length, 1);
  await assert.rejects(() =>
    collectClosedPreviewHyperdrives(
      () => null,
      () => "CLOSED"
    )
  );
  await assert.rejects(() =>
    collectClosedPreviewHyperdrives(
      () => [{ name: "soundkit-hyperdrive-pr-11" }],
      () => {
        throw new Error("GitHub unavailable");
      }
    )
  );
});
