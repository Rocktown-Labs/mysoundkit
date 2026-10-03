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
const { Scope } = await import("alchemy");

const readStates = async (forceUpdate) => {
  await alchemy("soundkit", {
    stage: "prod",
    stateStore: (scope) => new CloudflareStateStore(scope, { forceUpdate }),
    noTrack: true,
  });
  // alchemy() returns the ROOT scope, but enters the stage scope
  // ("soundkit" -> "prod") into AsyncLocalStorage — read state through
  // Scope.current so the request targets the chain ["soundkit", "prod"],
  // exactly like a real `alchemy deploy --stage prod`.
  return Scope.current.state.all();
};

// Read-only pass over the v1 prod state. The worker is only (re-)published
// when it is missing or its bundle tag is outdated; reading existing state
// makes no changes. If the worker's bearer token has drifted from
// ALCHEMY_STATE_TOKEN (the repo secret was last rotated without a deploy
// re-syncing it — the same situation master's v1 deploys handle with
// ALCHEMY_STATE_FORCE_UPDATE=true on their first attempt), retry once with
// forceUpdate to re-bind the current secret, exactly like those deploys do.
let states;
try {
  states = await readStates(false);
} catch (error) {
  if (!String(error?.message ?? "").includes("token is invalid")) {
    throw error;
  }
  console.log(
    "::notice title=seed-r2-secrets::v1 state store token stale — re-syncing STATE_TOKEN binding from ALCHEMY_STATE_TOKEN (same routine as v1 CI deploys)"
  );
  try {
    states = await readStates(true);
  } catch (forceError) {
    if (!String(forceError?.message ?? "").includes("token is invalid")) {
      throw forceError;
    }
    // The re-published worker is still propagating (the old version keeps
    // answering 401 for a few seconds) — the same race master's deploy
    // workflow absorbs by sleeping 30s between attempts.
    console.log(
      "::notice title=seed-r2-secrets::state worker update is propagating — waiting 30s before retrying"
    );
    await new Promise((resolve) => setTimeout(resolve, 30_000));
    states = await readStates(false);
  }
}
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

// Optional publish mode (maintenance workflow): set the values as GitHub
// repository secrets so the per-deploy bootstrap can retire. The workflow
// token cannot write repo secrets — this needs a PAT with Secrets:write
// provided as SECRETS_WRITER_TOKEN. Values are piped via stdin, never logged.
if (process.env.PUBLISH_GH_SECRETS === "true") {
  if (!process.env.GH_SECRETS_WRITER_TOKEN) {
    console.error(
      "::error title=seed-r2-secrets::PUBLISH_GH_SECRETS=true but SECRETS_WRITER_TOKEN is not set. Create a fine-grained PAT with Repository permissions -> Secrets: Read and writing (scoped to this repo), add it as a repository secret named SECRETS_WRITER_TOKEN, and re-run this task."
    );
    process.exit(1);
  }
  const { execFileSync } = await import("node:child_process");
  const repo = process.env.GITHUB_REPOSITORY;
  for (const [name, value] of Object.entries(secrets)) {
    execFileSync("gh", ["secret", "set", name, "--repo", repo], {
      input: value,
      stdio: ["pipe", "ignore", "inherit"],
      env: { ...process.env, GH_TOKEN: process.env.GH_SECRETS_WRITER_TOKEN },
    });
  }
  console.log(
    "::notice title=seed-r2-secrets::published CLOUDFLARE_ACCESS_KEY_ID, CLOUDFLARE_SECRET_ACCESS_KEY, RECORDINGS_ACCESS_KEY_ID, RECORDINGS_SECRET_ACCESS_KEY as repository secrets — the deploy bootstrap will skip itself from the next run"
  );
} else {
  console.log(
    "::notice title=seed-r2-secrets::exported CLOUDFLARE_ACCESS_KEY_ID, CLOUDFLARE_SECRET_ACCESS_KEY, RECORDINGS_ACCESS_KEY_ID, RECORDINGS_SECRET_ACCESS_KEY from the v1 Alchemy state store for this run (set them as repository secrets to stop reading v1 state)"
  );
}
