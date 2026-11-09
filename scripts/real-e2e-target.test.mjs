import assert from "node:assert/strict";
import test from "node:test";

import { assertRealE2eTarget } from "./real-e2e-target.mjs";

const valid = {
  PLAYWRIGHT_API_URL: "https://api.staging.soundkit.bio",
  PLAYWRIGHT_BASE_URL: "https://staging.soundkit.bio",
  SOUNDKIT_DATABASE_TARGET: "rocktownlabs/soundkit/staging",
  SOUNDKIT_E2E_ARTIST_EMAIL: "soundkit-fixture-artist@example.test",
  SOUNDKIT_E2E_ARTIST_PASSWORD: "synthetic-test-password",
  SOUNDKIT_E2E_FAN_EMAIL: "soundkit-fixture-fan@example.test",
  SOUNDKIT_E2E_FAN_PASSWORD: "synthetic-test-password",
  SOUNDKIT_EXTERNAL_EFFECTS_MODE: "disabled",
  SOUNDKIT_ISOLATION_MODE: "enforce",
  SOUNDKIT_MEDIA_BUCKET_NAME: "soundkit-media-staging",
};

test("real journeys require exact isolated resources and synthetic credentials", () => {
  assert.doesNotThrow(() => assertRealE2eTarget(valid));
  for (const change of [
    { PLAYWRIGHT_API_URL: "https://api.mysoundkit.com" },
    { PLAYWRIGHT_BASE_URL: "https://mysoundkit.com" },
    { PLAYWRIGHT_API_URL: "https://api.staging.soundkit.bio.evil.test" },
    { PLAYWRIGHT_API_URL: "https://api.staging.soundkit.bio/path" },
    { SOUNDKIT_DATABASE_TARGET: "rocktownlabs/soundkit/main" },
    { SOUNDKIT_MEDIA_BUCKET_NAME: "soundkit-media" },
    { SOUNDKIT_EXTERNAL_EFFECTS_MODE: "enabled" },
    { SOUNDKIT_ISOLATION_MODE: "report" },
    { SOUNDKIT_E2E_ARTIST_EMAIL: "real@example.com" },
    { SOUNDKIT_E2E_FAN_EMAIL: "real@example.com" },
    { SOUNDKIT_E2E_FAN_PASSWORD: "" },
  ]) {
    assert.throws(() => assertRealE2eTarget({ ...valid, ...change }));
  }
});

test("provider journeys cannot quietly run with missing/live payment keys", () => {
  assert.throws(() =>
    assertRealE2eTarget({ ...valid, STRIPE_SECRET_KEY: "sk_live_placeholder" })
  );
  assert.throws(() =>
    assertRealE2eTarget({ ...valid, SOUNDKIT_E2E_EXPECT_CHECKOUT: "true" })
  );
  assert.doesNotThrow(() =>
    assertRealE2eTarget({
      ...valid,
      SOUNDKIT_E2E_EXPECT_CHECKOUT: "true",
      SOUNDKIT_STRIPE_MODE: "test",
      STRIPE_SECRET_KEY: "rk_test_placeholder",
    })
  );
});
