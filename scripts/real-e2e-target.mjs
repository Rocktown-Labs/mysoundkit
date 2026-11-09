const expected = {
  PLAYWRIGHT_API_URL: "https://api.staging.soundkit.bio",
  PLAYWRIGHT_BASE_URL: "https://staging.soundkit.bio",
  SOUNDKIT_DATABASE_TARGET: "rocktownlabs/soundkit/staging",
  SOUNDKIT_E2E_ARTIST_EMAIL: "soundkit-fixture-artist@example.test",
  SOUNDKIT_E2E_FAN_EMAIL: "soundkit-fixture-fan@example.test",
  SOUNDKIT_EXTERNAL_EFFECTS_MODE: "disabled",
  SOUNDKIT_ISOLATION_MODE: "enforce",
  SOUNDKIT_MEDIA_BUCKET_NAME: "soundkit-media-staging",
};

/** Fail before browser requests; never include credential values in errors. */
export function assertRealE2eTarget(env) {
  for (const [key, value] of Object.entries(expected)) {
    if (env[key] !== value) {
      throw new Error(`Synthetic E2E configuration refused (${key})`);
    }
  }
  for (const key of [
    "SOUNDKIT_E2E_ARTIST_PASSWORD",
    "SOUNDKIT_E2E_FAN_PASSWORD",
  ]) {
    if (typeof env[key] !== "string" || !env[key].trim()) {
      throw new Error(`Synthetic E2E configuration refused (${key})`);
    }
  }
  const key = env.STRIPE_SECRET_KEY;
  if (key && !/^(?:sk|rk)_test_/u.test(key)) {
    throw new Error("Synthetic E2E refuses non-test Stripe credentials");
  }
  if (
    (env.SOUNDKIT_E2E_EXPECT_CHECKOUT === "true" ||
      env.SOUNDKIT_E2E_EXPECT_PREMIUM_CHECKOUT === "true") &&
    (!key || env.SOUNDKIT_STRIPE_MODE !== "test")
  ) {
    throw new Error(
      "Commerce E2E requires explicit Stripe test credentials/mode"
    );
  }
}
