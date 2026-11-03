/* oxlint-disable one-var, sort-vars, node/no-mixed-requires, node/no-top-level-await -- Sequential administrative CLI with redacted output. */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { stagingTarget } from "../packages/infra/deployment-environment.mjs";

export function publicSchemaBaseline(input) {
  // Administrative input must be independently reviewed and fingerprinted. This
  // schema-only sanity check is not a sandbox or an untrusted SQL parser.
  // pg_dump metadata/settings do not belong in a transaction-pooled connection.
  const sql = input
    .replaceAll(/^\\(?:un)?restrict[^\n]*$/gmu, "")
    .replaceAll(/^SET [^\n]*;$/gmu, "")
    .replaceAll(
      /^SELECT pg_catalog\.set_config\('search_path', '', false\);$/gmu,
      ""
    )
    .replaceAll(/^CREATE TRIGGER soundkit_analytics_capture [^\n]*;$/gmu, "")
    .replaceAll(
      /^CREATE SCHEMA public;$/gmu,
      "CREATE SCHEMA IF NOT EXISTS public;"
    );
  if (
    /^\s*(?:INSERT|UPDATE|DELETE|COPY|DROP|TRUNCATE|ALTER SYSTEM|CREATE DATABASE)\b/imu.test(
      sql
    ) ||
    !sql.includes("CREATE TABLE public.")
  ) {
    throw new Error("Expected a schema-only public baseline");
  }
  return sql;
}
const hash = (value) => createHash("sha256").update(value).digest("hex");

async function loadAnalyticsMigration() {
  const analytics = await readFile(
    new URL("../packages/db/analytics/001_outbox.sql", import.meta.url),
    "utf-8"
  );
  const analyticsSha256 = hash(analytics),
    expectedTriggers = (
      analytics.match(/^CREATE TRIGGER soundkit_analytics_capture\b/gmu) ?? []
    ).length;
  // The approved migration contains PL/pgSQL BEGIN blocks too. Require exactly
  // its known outer transaction lines rather than counting every BEGIN token.
  if (
    (analytics.match(/^BEGIN;$/gmu) ?? []).length !== 1 ||
    (analytics.match(/^COMMIT;$/gmu) ?? []).length !== 1 ||
    !analytics.endsWith("COMMIT;\n")
  ) {
    throw new Error("Reviewed analytics transaction structure changed");
  }
  return { analytics, analyticsSha256, expectedTriggers };
}

export async function bootstrapStaging({
  client,
  target,
  schemaSql,
  schemaSha256,
  sourceCommit,
  appRole,
}) {
  if (
    target !== stagingTarget ||
    !/^[a-f0-9]{40}$/u.test(sourceCommit ?? "") ||
    !/^[a-zA-Z0-9_]{1,63}$/u.test(appRole ?? "")
  ) {
    throw new Error(
      "Explicit staging target, source commit and runtime role required"
    );
  }
  const baseline = publicSchemaBaseline(schemaSql);
  if (hash(baseline) !== schemaSha256) {
    throw new Error("Staging schema fingerprint mismatch");
  }
  const { analytics, analyticsSha256, expectedTriggers } =
    await loadAnalyticsMigration();
  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query("SET LOCAL lock_timeout = '3s'");
    const lock = await client.query(
      "SELECT pg_try_advisory_xact_lock(hashtextextended('soundkit-staging-bootstrap-v1',0)) AS locked"
    );
    if (!lock.rows[0].locked) {
      throw new Error("Another staging bootstrap is active");
    }
    const marker = await client.query(
      "SELECT to_regclass('soundkit_environment.identity') AS identity"
    );
    if (marker.rows[0].identity) {
      const result = await client.query(
        "SELECT target,public_schema_sha256 FROM soundkit_environment.identity WHERE singleton=true"
      );
      if (
        result.rows.length !== 1 ||
        result.rows[0].target !== target ||
        result.rows[0].public_schema_sha256 !== schemaSha256
      ) {
        throw new Error(
          "Existing staging identity differs; explicit migration required"
        );
      }
      const capture = await client.query(
        "SELECT fingerprint,(SELECT count(*)::int FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE t.tgname='soundkit_analytics_capture' AND t.tgenabled='O' AND n.nspname='public') AS enabled FROM soundkit_analytics.version WHERE version=1"
      );
      if (
        capture.rows[0]?.fingerprint !== analyticsSha256 ||
        capture.rows[0]?.enabled !== expectedTriggers
      ) {
        throw new Error(
          "Existing staging analytics differs; explicit repair required"
        );
      }
      await client.query("COMMIT");
      return { alreadyInitialized: true, schemaSha256, target };
    }
    const existing = await client.query(
      "SELECT count(*)::int AS tables FROM information_schema.tables WHERE table_schema IN ('public','soundkit_analytics','soundkit_environment')"
    );
    if (existing.rows[0].tables !== 0) {
      throw new Error(
        "Staging bootstrap requires an empty database; refusing existing application state"
      );
    }
    await client.query("CREATE EXTENSION IF NOT EXISTS vector");
    await client.query(baseline);
    await client.query(
      analytics
        .replace("\nBEGIN;\n", "\n")
        .replace(/\nCOMMIT;\s*$/u, "\n")
        .replaceAll("__MIGRATION_SHA256__", analyticsSha256)
    );
    await client.query(
      "CREATE SCHEMA soundkit_environment; REVOKE ALL ON SCHEMA soundkit_environment FROM PUBLIC; CREATE TABLE soundkit_environment.identity(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),target text NOT NULL,public_schema_sha256 text NOT NULL,source_commit text NOT NULL)"
    );
    await client.query(
      "INSERT INTO soundkit_environment.identity(target,public_schema_sha256,source_commit) VALUES($1,$2,$3)",
      [target, schemaSha256, sourceCommit]
    );
    // Identifier is validated above; never emit role names or connection details.
    await client.query(
      `GRANT USAGE ON SCHEMA public,soundkit_analytics,soundkit_environment TO "${appRole}"; GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA soundkit_analytics TO "${appRole}"; GRANT SELECT ON soundkit_environment.identity TO "${appRole}"; REVOKE CREATE ON SCHEMA public FROM PUBLIC`
    );
    await client.query("COMMIT");
    return { alreadyInitialized: false, analyticsSha256, schemaSha256, target };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* Closing the connection aborts its transaction. */
    }
    throw error;
  }
}

async function runtimeDatabaseRole(connectionString) {
  if (!connectionString) {
    throw new Error("Explicit staging runtime connection required");
  }
  const requireDb = createRequire(
    new URL("../packages/db/package.json", import.meta.url)
  );
  const { Client } = requireDb("pg");
  const runtime = new Client({
    connectionString,
    connectionTimeoutMillis: 5000,
    query_timeout: 5000,
  });
  let failed = false;
  runtime.on("error", () => {
    failed = true;
  });
  try {
    await runtime.connect();
    const result = await runtime.query("SELECT current_user AS role");
    if (failed) {
      throw new Error("Runtime identity connection failed");
    }
    return result.rows[0]?.role;
  } finally {
    await runtime.end();
  }
}

function handleConnectionError() {
  // Driver messages may contain connection details; fail without emitting them.
  process.exitCode = 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  let client;
  try {
    const { values } = parseArgs({
      options: {
        "app-role": { type: "string" },
        fingerprint: { default: false, type: "boolean" },
        "schema-file": { type: "string" },
        "schema-sha256": { type: "string" },
        "source-commit": { type: "string" },
        target: { type: "string" },
      },
      strict: true,
    });
    const schemaSql = await readFile(values["schema-file"], "utf-8");
    if (values.fingerprint) {
      console.info(hash(publicSchemaBaseline(schemaSql)));
    } else {
      if (values.target !== stagingTarget) {
        throw new Error("Staging target required");
      }
      const require = createRequire(
        new URL("../packages/db/package.json", import.meta.url)
      );
      const { Client } = require("pg");
      if (!process.env.MIGRATION_DATABASE_URL) {
        throw new Error("Explicit staging migration connection required");
      }
      client = new Client({
        connectionString: process.env.MIGRATION_DATABASE_URL,
        connectionTimeoutMillis: 5000,
        query_timeout: 60_000,
      });
      client.on("error", handleConnectionError);
      await client.connect();
      const report = await bootstrapStaging({
        appRole:
          values["app-role"] ??
          (await runtimeDatabaseRole(process.env.DATABASE_URL)),
        client,
        schemaSha256: values["schema-sha256"],
        schemaSql,
        sourceCommit: values["source-commit"],
        target: values.target,
      });
      console.info(JSON.stringify(report));
    }
  } catch (error) {
    const code =
      typeof error?.code === "string" && /^[0-9A-Z]{5}$/u.test(error.code)
        ? error.code
        : "validation";
    console.error(
      `Staging bootstrap failed (${code}); no production repair or automatic retry performed.`
    );
    process.exitCode = 1;
  } finally {
    try {
      await client?.end();
    } catch {
      console.error("Staging database cleanup failed; details are redacted.");
      process.exitCode = 1;
    }
  }
}
