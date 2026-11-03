/* oxlint-disable one-var, sort-vars -- Sequential fixtures and assertions. */
import assert from "node:assert/strict";
import test from "node:test";

import { deploymentEnvironment } from "../packages/infra/deployment-environment.mjs";
import { deploymentPreflight } from "./deployment-preflight.mjs";

const safe = {
    SOUNDKIT_DATABASE_TARGET: "rocktownlabs/soundkit/staging",
    SOUNDKIT_EXTERNAL_EFFECTS_MODE: "disabled",
    SOUNDKIT_MEDIA_BUCKET_NAME: "soundkit-media-staging",
    STRIPE_SECRET_KEY: "sk_test_fixture",
  },
  readIdentity = () => Promise.resolve(safe.SOUNDKIT_DATABASE_TARGET);

test("preserves production identity, preview labels and local precedence", () => {
  assert.equal(deploymentEnvironment("prod").kind, "production");
  assert.equal(deploymentEnvironment("prod").scheduledJobsEnabled, true);
  assert.equal(
    deploymentEnvironment("prod", true).analyticsEnvironment,
    "test"
  );
  assert.equal(deploymentEnvironment("prod", true).scheduledJobsEnabled, false);
  assert.equal(deploymentEnvironment("pr-515").analyticsEnvironment, "pr-515");
  assert.equal(deploymentEnvironment("staging").kind, "staging");
  for (const invalid of [
    "pr-",
    "pr-main",
    "pr-0",
    "pr-1/../prod",
    "",
    "unknown",
  ]) {
    assert.throws(() => deploymentEnvironment(invalid));
  }
});

test("isolated staging passes enforcement only after actual database verification", async () => {
  const result = await deploymentPreflight({
    checkDatabase: true,
    env: safe,
    mode: "enforce",
    readIdentity,
    stage: "staging",
  });
  assert.equal(result.passed, true);
  assert.equal(result.enforced, true);
  assert.deepEqual(result.findings, []);
  const unchecked = await deploymentPreflight({
    env: safe,
    mode: "enforce",
    stage: "pr-515",
  });
  assert.ok(unchecked.findings.includes("database_identity_not_checked"));
});

test("report mode truthfully exposes current shared preview resources", async () => {
  const result = await deploymentPreflight({
    env: {
      KUNAKI_PASSWORD: "private-fulfillment",
      RESEND_API_KEY: "private-email",
      STRIPE_SECRET_KEY: "sk_live_private",
    },
    stage: "pr-515",
  });
  assert.equal(result.enforced, false);
  assert.equal(result.passed, false);
  assert.ok(result.findings.includes("nonproduction_media_identity_invalid"));
  assert.ok(result.findings.includes("nonproduction_stripe_mode_invalid"));
  assert.ok(!JSON.stringify(result).includes("private"));
});

test("a claimed staging label cannot disguise the actual production database", async () => {
  const result = await deploymentPreflight({
    checkDatabase: true,
    env: safe,
    mode: "enforce",
    readIdentity: () => Promise.resolve("rocktownlabs/soundkit/main"),
    stage: "staging",
  });
  assert.deepEqual(result.findings, ["database_identity_mismatch"]);
});

test("database connection failures remain redacted and fail enforcement", async () => {
  const result = await deploymentPreflight({
    checkDatabase: true,
    env: { ...safe, DATABASE_URL: "postgres://private-secret" },
    mode: "enforce",
    readIdentity: () => Promise.reject(new Error("postgres://private-secret")),
    stage: "staging",
  });
  assert.deepEqual(result.findings, ["database_identity_unavailable"]);
  assert.ok(!JSON.stringify(result).includes("private-secret"));
});

test("production validation requires the established media and payment identities", async () => {
  const result = await deploymentPreflight({
    env: { STRIPE_SECRET_KEY: "sk_live_fixture" },
    mode: "enforce",
    stage: "prod",
  });
  assert.equal(result.passed, true);
  const invalid = await deploymentPreflight({
    env: safe,
    mode: "enforce",
    stage: "prod",
  });
  assert.equal(invalid.passed, false);
});

test("an invalid mode is never silently downgraded to report", async () => {
  await assert.rejects(
    deploymentPreflight({ env: safe, mode: "enfroce", stage: "staging" })
  );
});
