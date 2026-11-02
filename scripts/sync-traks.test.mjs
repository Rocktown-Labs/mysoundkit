/* eslint-disable sort-vars */
import assert from "node:assert/strict";
import { test } from "node:test";

import { missingConfiguration } from "./sync-traks.mjs";

test("keeps historical goals and does not duplicate equivalent conversions", () => {
  const goal = { target: "onboarding_completed", type: "event" },
    filtered = { ...goal, propKey: "account_type", propValue: "artist" },
    site = {
      funnels: [{ name: "Artist activation", steps: [goal, filtered] }],
      goals: [goal, filtered],
    };
  assert.deepEqual(
    missingConfiguration(
      site,
      [{ ...goal, propKey: null, propValue: null }],
      []
    ),
    { funnels: site.funnels, goals: [filtered] }
  );
  assert.deepEqual(missingConfiguration(site, site.goals, site.funnels), {
    funnels: [],
    goals: [],
  });
});

test("reports changed funnel steps instead of silently changing historical funnels", () => {
  assert.throws(
    () =>
      missingConfiguration(
        {
          funnels: [
            { name: "Activation", steps: [{ target: "new", type: "event" }] },
          ],
          goals: [],
        },
        [],
        [{ name: "Activation", steps: [{ target: "old", type: "event" }] }]
      ),
    /configuration drift/u
  );
});
