/* eslint-disable sort-vars, node/no-mixed-requires, one-var, node/no-top-level-await */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const root = new URL("../", import.meta.url),
  require = createRequire(new URL("packages/db/package.json", root));
const { Client } = require("pg"),
  migration = await readFile(
    new URL("packages/db/analytics/001_outbox.sql", root),
    "utf-8"
  ),
  fingerprint = createHash("sha256").update(migration).digest("hex"),
  mode = process.argv[2] ?? "--check";
if (mode === "--fingerprint") {
  console.info(fingerprint);
  process.exit(0);
}
if (!["--check", "--test-apply", "--apply"].includes(mode)) {
  throw new Error("Unknown analytics migration mode");
}
const url =
  process.env[
    mode === "--test-apply" ? "SOUNDKIT_TEST_DATABASE_URL" : "DATABASE_URL"
  ];
if (!url) {
  throw new Error("An explicit database URL is required");
}
let target;
try {
  target = new URL(url);
} catch {
  throw new Error(`Invalid database URL for analytics migration mode ${mode}`);
}
if (!["postgres:", "postgresql:"].includes(target.protocol)) {
  throw new Error("Analytics migrations require PostgreSQL");
}
if (
  mode === "--test-apply" &&
  !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname)
) {
  throw new Error("Test migrations require a local isolated fixture database");
}
if (
  mode === "--apply" &&
  (process.env.SOUNDKIT_ANALYTICS_TARGET !== "rocktownlabs/soundkit/main" ||
    process.argv[3] !== "--sha256" ||
    process.argv[4] !== fingerprint)
) {
  throw new Error(
    "Production apply requires the named target and exact approved migration fingerprint"
  );
}
const client = new Client({
  connectionString: url,
  connectionTimeoutMillis: 5000,
  // Client deadline avoids unsupported PgBouncer startup parameters.
  // The migration separately enforces SET LOCAL statement_timeout/lock_timeout.
  query_timeout: 35_000,
});
await client.connect();
try {
  // Pin one backend through checks and apply; session locks leak through poolers.
  await client.query("BEGIN");
  await client.query("SET LOCAL statement_timeout = '30s'");
  await client.query("SET LOCAL lock_timeout = '3s'");
  if (mode !== "--check") {
    const lock = await client.query(
      "SELECT pg_try_advisory_xact_lock(hashtextextended('soundkit-analytics-migration-v1',0)) AS locked"
    );
    if (!lock.rows[0].locked) {
      throw new Error("Another analytics migration is running");
    }
  }
  const exists = await client.query(
    "SELECT to_regclass('soundkit_analytics.version') AS relation"
  );
  if (exists.rows[0].relation) {
    const result = await client.query(
      "SELECT fingerprint FROM soundkit_analytics.version WHERE version=1"
    );
    if (result.rows[0]?.fingerprint !== fingerprint) {
      throw new Error(
        "Analytics migration fingerprint mismatch; do not auto-apply drift"
      );
    }
    const triggers = await client.query(
      `SELECT count(*)::int AS n FROM pg_trigger t
      JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE t.tgname='soundkit_analytics_capture' AND t.tgenabled='O' AND n.nspname='public'
        AND c.relname=ANY($1::text[])`,
      [
        [
          "user",
          "subscription",
          "transactions",
          "payment_refunds",
          "orders",
          "purchases",
          "track_assets",
          "tracks",
          "videos",
          "projects",
        ],
      ]
    );
    if (triggers.rows[0].n !== 10) {
      throw new Error(
        "Analytics capture triggers missing or disabled. Use a new reviewed migration; see docs/analytics/outbox.md."
      );
    }
    console.info(
      "Analytics migration v1 fingerprint and capture triggers verified."
    );
  } else {
    if (mode === "--check") {
      throw new Error(
        "Analytics migration v1 must be explicitly approved and installed before production deployment"
      );
    }
    await client.query(
      // The runner owns the transaction so the advisory lock and DDL share it.
      migration
        .replace("\nBEGIN;\n", "\n")
        .replace(/\nCOMMIT;\s*$/u, "\n")
        .replaceAll("__MIGRATION_SHA256__", fingerprint)
    );
    console.info(`Analytics migration v1 installed (${fingerprint}).`);
  }
  await client.query("COMMIT");
} catch (error) {
  try {
    await client.query("ROLLBACK");
  } catch {
    // Ending the connection also aborts an open transaction.
  }
  throw error;
} finally {
  await client.end();
}
