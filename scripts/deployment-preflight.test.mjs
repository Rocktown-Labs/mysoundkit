/* oxlint-disable one-var, sort-vars -- Sequential fixtures and assertions. */
import assert from "node:assert/strict";
import test from "node:test";

import {
  deploymentAuthPolicy,
  deploymentEnvironment,
  deploymentRouting,
} from "../packages/infra/deployment-environment.mjs";
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

test("metadata-only readiness checks do not require raw credentials", async () => {
  const report = await deploymentPreflight({
    env: {
      SOUNDKIT_HAS_EMAIL_CREDENTIALS: "true",
      SOUNDKIT_HAS_FULFILLMENT_CREDENTIALS: "true",
      SOUNDKIT_STRIPE_MODE: "live",
    },
    stage: "pr-515",
  });
  assert.deepEqual(report.findings, [
    "database_target_unapproved",
    "nonproduction_media_identity_invalid",
    "nonproduction_stripe_mode_invalid",
    "nonproduction_external_effects_not_disabled",
    "nonproduction_fulfillment_credentials",
    "nonproduction_email_credentials",
    "database_identity_not_checked",
  ]);
  assert.deepEqual(Object.keys(report).toSorted(), [
    "enforced",
    "findings",
    "kind",
    "passed",
    "stage",
  ]);
});
test("raw live credentials cannot hide behind declared test metadata", async () => {
  const report = await deploymentPreflight({
    checkDatabase: true,
    env: {
      ...safe,
      SOUNDKIT_STRIPE_MODE: "test",
      STRIPE_SECRET_KEY: "sk_live_sensitive",
    },
    readIdentity,
    stage: "staging",
  });
  assert.deepEqual(report.findings, ["nonproduction_stripe_mode_invalid"]);
});

test("isolated routing preserves production and separates staging cookie parents", () => {
  assert.deepEqual(
    deploymentRouting("prod", false, true),
    deploymentRouting("prod")
  );
  const staging = deploymentRouting("staging", false, true),
    preview = deploymentRouting("pr-520", false, true);
  assert.equal(staging.siteHost, "staging.soundkit.bio");
  assert.equal(preview.siteHost, "pr-520.preview.soundkit.bio");
  assert.equal(preview.mediaBucket, staging.mediaBucket);
  assert.equal(preview.apiHost.endsWith(`.${staging.siteHost}`), false);
  assert.equal(deploymentRouting("pr-520").mediaBucket, "soundkit-media");
  assert.equal(deploymentRouting("prod", true, true).isolated, false);
});

test("CAPTCHA bypass is available only to opt-in isolated nonproduction", () => {
  const staging = deploymentEnvironment("staging");
  assert.equal(
    deploymentAuthPolicy({ ...staging, isLocalDev: true }, true)
      .TURNSTILE_DISABLED,
    "false"
  );
  assert.equal(
    deploymentAuthPolicy({ ...staging, isProduction: true }, true)
      .TURNSTILE_DISABLED,
    "false"
  );
  for (const stage of ["prod", "staging", "pr-529"]) {
    assert.equal(
      deploymentAuthPolicy(deploymentEnvironment(stage), false)
        .TURNSTILE_DISABLED,
      "false"
    );
  }
  assert.equal(
    deploymentAuthPolicy(deploymentEnvironment("prod"), true)
      .TURNSTILE_DISABLED,
    "false"
  );
  assert.equal(
    deploymentAuthPolicy(deploymentEnvironment("prod", true), true)
      .TURNSTILE_DISABLED,
    "false"
  );
  assert.equal(
    deploymentAuthPolicy(deploymentEnvironment("staging"), true)
      .TURNSTILE_DISABLED,
    "true"
  );
  assert.equal(
    deploymentAuthPolicy(deploymentEnvironment("pr-529"), true)
      .TURNSTILE_DISABLED,
    "true"
  );
});
