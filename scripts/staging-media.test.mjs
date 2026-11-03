/* oxlint-disable one-var, sort-vars -- Ordered fixture assertions. */
import assert from "node:assert/strict";
import test from "node:test";

import { fixtureTone, uploadFixtureMedia } from "./staging-media.mjs";

const env = {
  CLOUDFLARE_ACCOUNT_ID: "a".repeat(32),
  CLOUDFLARE_API_TOKEN: "private-deploy-token",
  SOUNDKIT_DATABASE_TARGET: "rocktownlabs/soundkit/staging",
  SOUNDKIT_MEDIA_BUCKET_NAME: "soundkit-media-staging",
};

test("fixture WAV headers distinguish preview from complete media", () => {
  const full = fixtureTone(3000),
    preview = fixtureTone(1000);
  assert.equal(full.toString("ascii", 0, 4), "RIFF");
  assert.equal(full.toString("ascii", 8, 12), "WAVE");
  assert.equal(full.readUInt32LE(40), 48_000);
  assert.equal(preview.readUInt32LE(40), 16_000);
  assert.throws(() => fixtureTone(0));
});

test("media writes require both actual staging identity and exact bucket", async () => {
  let requests = 0;
  const request = () => {
    requests += 1;
    throw new Error("Unexpected write");
  };
  for (const changes of [
    { SOUNDKIT_DATABASE_TARGET: "rocktownlabs/soundkit/main" },
    { SOUNDKIT_MEDIA_BUCKET_NAME: "soundkit-media" },
  ]) {
    await assert.rejects(
      uploadFixtureMedia({ env: { ...env, ...changes }, request })
    );
  }
  await assert.rejects(
    uploadFixtureMedia({
      env,
      preflight: () => Promise.resolve({ passed: false }),
      request,
    })
  );
  assert.equal(requests, 0);
});

test("uploads only the four fixed synthetic keys after enforced preflight", async () => {
  const written = [];
  const result = await uploadFixtureMedia({
    env,
    preflight: (options) => {
      assert.equal(options.checkDatabase, true);
      assert.equal(options.mode, "enforce");
      return Promise.resolve({ passed: true });
    },
    request: (url, options) => {
      assert.equal(options.method, "PUT");
      assert.ok(
        url.includes(
          "/buckets/soundkit-media-staging/objects/staging-fixtures/v1/"
        )
      );
      assert.equal(options.body.toString("ascii", 0, 4), "RIFF");
      written.push(url);
      return Promise.resolve(Response.json({ success: true }));
    },
  });
  assert.equal(new Set(written).size, 4);
  assert.equal(result.objects, 4);
});
