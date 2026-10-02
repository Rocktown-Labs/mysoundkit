/**
 * One-time bootstrap for the Alchemy v1 → v2 migration (#261/#262).
 *
 * The v1 stack managed the media + recordings R2 S3 keypairs as
 * `AccountApiToken` resources inside the v1 Cloudflare state store
 * (`alchemy-state-service`, stage `prod`). v2 account tokens do not expose
 * S3 keypairs, so the v2 stack expects the existing pairs as deploy-time
 * secrets: CLOUDFLARE_ACCESS_KEY_ID / CLOUDFLARE_SECRET_ACCESS_KEY and
 * RECORDINGS_ACCESS_KEY_ID / RECORDINGS_SECRET_ACCESS_KEY.
 *
 * GitHub's workflow token cannot write repository secrets, so this bootstrap
 * instead reads the live tokens from the v1 prod state store and appends
 * `export NAME=value` lines to the env file passed as argv, which the deploy
 * job sources before running `alchemy deploy`. Values never touch stdout.
 *
 * Run from a temp directory that has alchemy@0.90.1 installed (this script
 * resolves `alchemy` from its own directory, so it must be copied next to the
 * v1 install, NOT run from the repo checkout whose node_modules has v2).
 *
 * Required environment:
 *   ALCHEMY_STATE_TOKEN, ALCHEMY_PASSWORD, CLOUDFLARE_API_TOKEN,
 *   CLOUDFLARE_ACCOUNT_ID
 *
 * Usage: node seed-v2-r2-secrets.mjs <out-env-file>
 * Skip guard: SEED_R2_SECRETS=false exits immediately (idempotence).
 */
import { appendFileSync } from "node:fs";

const outEnvFile = process.argv[2];
if (!outEnvFile) {
  console.error("usage: seed-v2-r2-secrets.mjs <out-env-file>");
  process.exit(1);
}

if (process.env.SEED_R2_SECRETS === "false") {
  console.log("::notice title=seed-r2-secrets::R2 deploy secrets already present — skipping bootstrap");
  process.exit(0);
}

for (const name of [
  "ALCHEMY_STATE_TOKEN",
  "ALCHEMY_PASSWORD",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
]) {
  if (!process.env[name]) {
    console.error(`::error title=seed-r2-secrets::missing required environment variable ${name}`);
    process.exit(1);
  }
}

const { default: alchemy } = await import("alchemy");
const { CloudflareStateStore } = await import("alchemy/state");

// Read-only pass over the v1 prod state. CloudflareStateStore.provision()
// only creates/updates the state worker when it is missing or outdated;
// reading existing state makes no changes.
const app = await alchemy("soundkit", {
  stage: "prod",
  stateStore: (scope) => new CloudflareStateStore(scope),
  noTrack: true,
});

const states = await app.state.all();
const findState = (needle) =>
  Object.entries(states).find(([key]) => key.includes(needle));
const media = findState("media-upload-token");
const recordings = findState("recordings-upload-token");
if (!media || !recordings) {
  console.error(
    "::error title=seed-r2-secrets::media-upload-token / recordings-upload-token not found in the v1 prod state store. Found keys: " +
      (Object.keys(states).join(", ") || "(none)")
  );
  process.exit(1);
}

const keyOf = (state, field) => state.output?.[field]?.unencrypted;
const secrets = {
  CLOUDFLARE_ACCESS_KEY_ID: keyOf(media[1], "accessKeyId"),
  CLOUDFLARE_SECRET_ACCESS_KEY: keyOf(media[1], "secretAccessKey"),
  RECORDINGS_ACCESS_KEY_ID: keyOf(recordings[1], "accessKeyId"),
  RECORDINGS_SECRET_ACCESS_KEY: keyOf(recordings[1], "secretAccessKey"),
};
for (const [name, value] of Object.entries(secrets)) {
  if (!value) {
    console.error(`::error title=seed-r2-secrets::${name} resolved empty from v1 state`);
    process.exit(1);
  }
}

const shellQuote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
let envFile = "";
for (const [name, value] of Object.entries(secrets)) {
  envFile += `export ${name}=${shellQuote(value)}\n`;
}
appendFileSync(outEnvFile, envFile, { flag: "a" });
console.log(
  "::notice title=seed-r2-secrets::exported CLOUDFLARE_ACCESS_KEY_ID, CLOUDFLARE_SECRET_ACCESS_KEY, RECORDINGS_ACCESS_KEY_ID, RECORDINGS_SECRET_ACCESS_KEY from the v1 Alchemy state store for this run (set them as repository secrets to stop reading v1 state)"
);
