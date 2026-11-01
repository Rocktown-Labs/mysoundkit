#!/usr/bin/env node
// One-time + repeatable maintenance for https://github.com/Rocktown-Labs/mysoundkit/issues/360
//
// Preview deploys (stage pr-<number>) leak their cloud resources when the
// deploy or its PR-close destroy fails partway: Alchemy only deletes what its
// stage state knows about, so anything created-but-not-committed (or never
// reached by an aborted destroy) stays in the account forever. The account had
// accumulated 33 leaked soundkit preview workers, 94 leaked queues, 40+
// leaked custom domains, and several D1/R2 instances from long-closed PRs —
// the leaked queues are what intermittently break queue adoption for new
// preview deploys ("already exists but could not be found") and the shared
// media-bucket destroy failure is fixed separately by retaining the bucket.
//
// This script finds every cloud resource whose name matches a `pr-<number>`
// preview pattern AND whose PR is closed in this repository, and deletes them
// in dependency order (domains -> workers -> Hyperdrives -> queues -> databases -> buckets).
// The alchemy-state-service-pr-<n> workers are intentionally left alone: their
// names are shared across every Alchemy project on the account, so deleting
// one for a closed soundkit PR could destroy another project's state.
//
// Usage:
//   node scripts/cleanup-leaked-previews.mjs             # diagnose only (no changes)
//   node scripts/cleanup-leaked-previews.mjs --apply    # delete the leaked resources
//
// Requires:
//   - CLOUDFLARE_API_TOKEN (account-scoped: Workers Scripts Edit + delete,
//     Queues Edit, D1 Edit, R2 Edit, Workers Domains Edit, Hyperdrive Read/Edit)
//   - `gh` authenticated against the repository (PR open/closed verification)

import { execFileSync } from "node:child_process";

import { collectClosedPreviewHyperdrives } from "./preview-hyperdrives.mjs";

const API = "https://api.cloudflare.com/client/v4",
  CLOUDFLARE_ACCOUNT_ID =
    process.env.CLOUDFLARE_ACCOUNT_ID ?? "5af47adc047fa74dcfa59048858b486c",
  GITHUB_REPO = process.env.GITHUB_REPO ?? "Rocktown-Labs/mysoundkit",
  TOKEN = process.env.CLOUDFLARE_API_TOKEN,
  apply = process.argv.includes("--apply"),
  // Everything this script may touch must be a soundkit preview resource:
  // a soundkit-prefixed name ending in the preview stage suffix.
  PREVIEW_NAME_PATTERN = /^soundkit-.*-pr-(\d+)$/,
  PREVIEW_HOST_PATTERN = /-pr-(\d+)\.(mysoundkit\.com|soundkit\.bio)$/,
  // R2/D1 instances with objects can only be deleted after a bounded purge
  // (the REST API deletes one object per call); refuse to touch anything
  // with more stored objects than this.
  MAX_OBJECT_PURGE = 1_000;

if (!TOKEN) {
  console.error("CLOUDFLARE_API_TOKEN is required.");
  process.exit(1);
}

// `path` is account-relative (e.g. `/workers/domains`). The account id is
// added only to the request URL, never to the error message: the id is read
// from the environment, and logging it trips CodeQL's clear-text-logging rule.
const cf = async (path, init) => {
  const url = `${API}/accounts/${CLOUDFLARE_ACCOUNT_ID}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = (await response.json().catch(() => null)) ?? {};
  if (!response.ok || data.success === false) {
    const errors = (data.errors ?? [{ message: response.statusText }])
      .map((e) => e.message)
      .join("; ");
    throw new Error(`${init?.method ?? "GET"} ${path} -> ${response.status}: ${errors}`);
  }
  return data.result;
};

const prState = (number) => {
  try {
    const out = execFileSync(
      "gh",
      ["pr", "view", String(number), "--json", "state", "-R", GITHUB_REPO],
      { encoding: "utf8" }
    );
    return JSON.parse(out).state;
  } catch {
    // PRs cannot be deleted from GitHub, so a soundkit pr-<n> resource
    // always maps to a real PR. A gh failure here is auth, rate limiting,
    // or network — never a missing PR — and must fail CLOSED: treating it
    // as deletable would let a transient CI error delete an open PR's
    // preview resources.
    return "UNKNOWN";
  }
};

const deletablePrNumbers = new Map();
const isClosedPreviewPr = (number) => {
  if (!deletablePrNumbers.has(number)) {
    const state = prState(number);
    deletablePrNumbers.set(number, state === "MERGED" || state === "CLOSED");
    if (state !== "MERGED" && state !== "CLOSED") {
      console.warn(
        `  ! pr-${number}: PR state is ${state} — skipping (verify gh auth/network)`
      );
    }
  }
  return deletablePrNumbers.get(number);
};

const collect = async (label, list, nameOf, prNumberOf) => {
  const matching = [];
  for (const item of list) {
    const prNumber = prNumberOf(item);
    if (prNumber === null) {
      continue;
    }
    if (!isClosedPreviewPr(prNumber)) {
      console.log(`  - skip ${nameOf(item)} (PR #${prNumber} is still open)`);
      continue;
    }
    matching.push(item);
  }
  console.log(`${label}: ${matching.length} leaked from closed PRs`);
  return matching;
};

const purgeR2Objects = async (bucketName) => {
  let purged = 0;
  for (;;) {
    const objects = await cf(
      `/r2/buckets/${encodeURIComponent(bucketName)}/objects?per_page=1000`
    );
    if (!Array.isArray(objects) || objects.length === 0) {
      return purged;
    }
    if (purged + objects.length > MAX_OBJECT_PURGE) {
      throw new Error(
        `bucket has more than ${MAX_OBJECT_PURGE} objects — purge manually`
      );
    }
    // The R2 REST API deletes one object per call; a leaked preview bucket
    // holds a handful of test uploads, so a small concurrency is plenty.
    const keys = objects.map((o) => o.key);
    for (let i = 0; i < keys.length; i += 20) {
      await Promise.all(
        keys.slice(i, i + 20).map((key) =>
          cf(
            `/r2/buckets/${encodeURIComponent(bucketName)}/objects/${encodeURIComponent(key)}`,
            { method: "DELETE" }
          )
        )
      );
    }
    purged += keys.length;
    if (keys.length < 1000) {
      return purged;
    }
  }
};

const main = async () => {
  console.log(
    `Leaked soundkit preview cleanup (${apply ? "APPLY" : "dry run"}), repo ${GITHUB_REPO}`
  );

  // ---- 1. Custom domains (must go before their workers) ------------------
  const domains = await collect(
    "custom domains",
    await cf(`/workers/domains`),
    (d) => d.hostname,
    (d) => {
      const m = PREVIEW_HOST_PATTERN.exec(d.hostname);
      return m ? Number(m[1]) : null;
    }
  );

  // ---- 2. Worker scripts --------------------------------------------------
  const workers = await collect(
    "worker scripts",
    await cf(`/workers/scripts`),
    (s) => s.id,
    (s) => {
      const m = PREVIEW_NAME_PATTERN.exec(s.id);
      return m ? Number(m[1]) : null;
    }
  );

  // ---- 3. Queues (bound to the workers above) -----------------------------
  const allQueues = [];
  for (let page = 1; ; page += 1) {
    const result = await cf(
      `/workers/queues?per_page=100&page=${page}`
    );
    allQueues.push(...result);
    if (page >= (result.length ?? 0) || result.length < 100) {
      break;
    }
  }
  const queues = await collect(
    "queues",
    allQueues,
    (q) => q.queue_name,
    (q) => {
      const m = PREVIEW_NAME_PATTERN.exec(q.queue_name);
      return m ? Number(m[1]) : null;
    }
  );

  // ---- 4. D1 databases ----------------------------------------------------
  const databases = await collect(
    "d1 databases",
    await cf(`/d1/database`),
    (d) => d.name,
    (d) => {
      const m = PREVIEW_NAME_PATTERN.exec(d.name);
      return m ? Number(m[1]) : null;
    }
  );

  // ---- 5. R2 buckets (recordings etc.) ------------------------------------
  const r2 = await cf(`/r2/buckets?per_page=100`);
  const buckets = await collect(
    "r2 buckets",
    r2.buckets ?? [],
    (b) => b.name,
    (b) => {
      const m = PREVIEW_NAME_PATTERN.exec(b.name);
      return m ? Number(m[1]) : null;
    }
  );

  // Hyperdrives have a small account quota. A leak here prevents the real
  // server upload, leaving its placeholder without a queue handler (#492).
  const hyperdrives = await collectClosedPreviewHyperdrives(
    (page) => cf(`/hyperdrive/configs?per_page=100&page=${page}`),
    prState
  );
  console.log(`hyperdrives: ${hyperdrives.length} leaked from closed PRs`);

  if (!apply) {
    console.log("\nDry run — nothing deleted. Re-run with --apply to delete.");
    return;
  }

  const results = [];
  for (const d of domains) {
    try {
      await cf(`/workers/domains/${d.id}`, {
        method: "DELETE",
      });
      results.push(`domain ${d.hostname}: deleted`);
    } catch (e) {
      results.push(`domain ${d.hostname}: FAILED ${e.message}`);
    }
  }
  // Consumers must be unwired before either side can be deleted: a worker
  // that consumes a queue cannot be deleted, and a queue bound to a worker
  // cannot be deleted either. Removing the consumer edges breaks the cycle.
  for (const q of queues) {
    try {
      const consumers = await cf(
        `/workers/queues/${encodeURIComponent(q.queue_name)}/consumers`
      );
      for (const consumer of consumers) {
        await cf(
          `/workers/queues/${encodeURIComponent(q.queue_name)}/consumers/${encodeURIComponent(consumer.script)}`,
          { method: "DELETE" }
        );
        results.push(`consumer ${q.queue_name} -> ${consumer.script}: unbound`);
      }
    } catch (e) {
      results.push(`consumer ${q.queue_name}: FAILED ${e.message}`);
    }
  }
  for (const s of workers) {
    try {
      await cf(
        `/workers/scripts/${s.id}?force=true`,
        { method: "DELETE" }
      );
      results.push(`worker ${s.id}: deleted`);
    } catch (e) {
      results.push(`worker ${s.id}: FAILED ${e.message}`);
    }
  }
  for (const config of hyperdrives) {
    try {
      await cf(`/hyperdrive/configs/${encodeURIComponent(config.id)}`, {
        method: "DELETE",
      });
      results.push(`hyperdrive ${config.name}: deleted`);
    } catch (e) {
      results.push(`hyperdrive ${config.name}: FAILED ${e.message}`);
    }
  }
  for (const q of queues) {
    try {
      await cf(
        `/workers/queues/${encodeURIComponent(q.queue_name)}`,
        { method: "DELETE" }
      );
      results.push(`queue ${q.queue_name}: deleted`);
    } catch (e) {
      results.push(`queue ${q.queue_name}: FAILED ${e.message}`);
    }
  }
  for (const d of databases) {
    try {
      await cf(
        `/d1/database/${d.uuid}`,
        { method: "DELETE" }
      );
      results.push(`d1 ${d.name}: deleted`);
    } catch (e) {
      results.push(`d1 ${d.name}: FAILED ${e.message}`);
    }
  }
  for (const b of buckets) {
    try {
      const purged = await purgeR2Objects(b.name);
      if (purged > 0) {
        results.push(`r2 ${b.name}: purged ${purged} objects`);
      }
      await cf(
        `/r2/buckets/${encodeURIComponent(b.name)}`,
        { method: "DELETE" }
      );
      results.push(`r2 ${b.name}: deleted`);
    } catch (e) {
      results.push(`r2 ${b.name}: FAILED ${e.message}`);
    }
  }

  console.log("\nResults:");
  for (const line of results) {
    console.log(`  ${line}`);
  }
  const failed = results.filter((r) => r.includes("FAILED")).length;
  if (failed > 0) {
    console.error(`\n${failed} deletion(s) failed — re-run to retry or handle manually.`);
    process.exit(1);
  }
  console.log("\nAll leaked preview resources deleted.");
};

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
