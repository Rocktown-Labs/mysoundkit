/* oxlint-disable one-var, sort-vars, no-await-in-loop, node/no-top-level-await -- Sequential bounded fixture operations. */
import { pathToFileURL } from "node:url";

import { deploymentPreflight } from "./deployment-preflight.mjs";

export function fixtureTone(durationMs) {
  if (![1000, 3000].includes(durationMs)) {
    throw new Error("Unsupported fixture duration");
  }
  const sampleRate = 8000,
    samples = (durationMs * sampleRate) / 1000,
    data = Buffer.alloc(44 + samples * 2);
  data.write("RIFF", 0);
  data.writeUInt32LE(data.length - 8, 4);
  data.write("WAVEfmt ", 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(sampleRate, 24);
  data.writeUInt32LE(sampleRate * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write("data", 36);
  data.writeUInt32LE(samples * 2, 40);
  for (let index = 0; index < samples; index += 1) {
    data.writeInt16LE(
      Math.round(1500 * Math.sin((2 * Math.PI * 440 * index) / sampleRate)),
      44 + index * 2
    );
  }
  return data;
}

export async function uploadFixtureMedia({
  env = process.env,
  request = fetch,
  preflight = deploymentPreflight,
} = {}) {
  if (
    env.SOUNDKIT_DATABASE_TARGET !== "rocktownlabs/soundkit/staging" ||
    env.SOUNDKIT_MEDIA_BUCKET_NAME !== "soundkit-media-staging"
  ) {
    throw new Error("Explicit isolated staging target required");
  }
  if (
    !/^[a-f0-9]{32}$/u.test(env.CLOUDFLARE_ACCOUNT_ID ?? "") ||
    !env.CLOUDFLARE_API_TOKEN
  ) {
    throw new Error("Staging deployment credentials required");
  }
  const report = await preflight({
    checkDatabase: true,
    env,
    mode: "enforce",
    stage: "staging",
  });
  if (!report.passed) {
    throw new Error("Staging preflight refused media upload");
  }
  for (const name of ["free", "paid", "private", "paid-preview"]) {
    const body = fixtureTone(name === "paid-preview" ? 1000 : 3000),
      key = `staging-fixtures/v1/${name}.wav`,
      response = await request(
        `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${env.SOUNDKIT_MEDIA_BUCKET_NAME}/objects/${key}`,
        {
          body,
          headers: {
            authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
            "content-type": "audio/wav",
          },
          method: "PUT",
          redirect: "error",
          signal: AbortSignal.timeout(15_000),
        }
      );
    const result = response.ok ? await response.json() : null;
    if (result?.success !== true) {
      throw new Error("Staging fixture upload failed");
    }
  }
  return { bucket: "soundkit-media-staging", objects: 4 };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    console.info(JSON.stringify(await uploadFixtureMedia()));
  } catch {
    console.error("Staging fixture media failed; provider details redacted.");
    process.exitCode = 1;
  }
}
