/* oxlint-disable one-var, sort-vars, no-await-in-loop, node/no-mixed-requires, node/no-top-level-await -- Sequential read-only release contract. */
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const root = new URL("../", import.meta.url);
export const columnInventorySql =
  "SELECT c.relname AS table,a.attname AS column,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull AS required FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid WHERE n.nspname='public' AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped";
export function columnsFingerprint(rows) {
  const columns = rows
    .map((row) => [
      row.table,
      row.column,
      row.type.replaceAll("public.", "").replaceAll('"', ""),
      row.required,
    ])
    .toSorted((left, right) => {
      const a = `${left[0]}.${left[1]}`,
        b = `${right[0]}.${right[1]}`;
      return a < b ? -1 : Number(a > b);
    });
  return createHash("sha256").update(JSON.stringify(columns)).digest("hex");
}

export async function sourceFiles() {
  const entries = await readdir(new URL("packages/db/src/schema/", root)),
    paths = [
      "packages/db/drizzle.config.ts",
      ...entries
        .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
        .map((name) => `packages/db/src/schema/${name}`),
    ].toSorted(),
    files = [];
  for (const path of paths) {
    const content = await readFile(new URL(path, root));
    files.push({
      path,
      sha256: createHash("sha256").update(content).digest("hex"),
    });
  }
  return files;
}

export function contractFindings({ baseline, files, columns, vector }) {
  const findings = [];
  if (
    baseline.version !== 1 ||
    baseline.target !== "rocktownlabs/soundkit/main" ||
    !/^[a-f0-9]{64}$/u.test(baseline.columnsSha256 ?? "")
  ) {
    findings.push("baseline_invalid");
  }
  if (JSON.stringify(baseline.files) !== JSON.stringify(files)) {
    findings.push("source_schema_unreviewed");
  }
  if (
    baseline.columnsSha256 !== columnsFingerprint(columns) ||
    baseline.columnCount !== columns.length ||
    baseline.tableCount !== new Set(columns.map((column) => column.table)).size
  ) {
    findings.push("database_column_contract_mismatch");
  }
  if (!vector) {
    findings.push("vector_extension_missing");
  }
  return findings;
}

export async function checkPublicSchema({ client, baseline, files }) {
  await client.query("BEGIN READ ONLY");
  try {
    await client.query("SET LOCAL statement_timeout='10s'");
    await client.query("SET LOCAL lock_timeout='3s'");
    const columns = await client.query(columnInventorySql),
      extension = await client.query(
        "SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname='vector') AS installed"
      );
    return contractFindings({
      baseline,
      columns: columns.rows,
      files,
      vector: extension.rows[0]?.installed === true,
    });
  } finally {
    await client.query("ROLLBACK");
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  let client,
    connectionFailed = false;
  try {
    if (!process.env.DATABASE_URL || process.argv.length > 2) {
      throw new Error("Explicit connection and check-only invocation required");
    }
    const baseline = JSON.parse(
        await readFile(
          new URL("packages/db/releases/public-schema-baseline.json", root),
          "utf-8"
        )
      ),
      files = await sourceFiles(),
      require = createRequire(new URL("packages/db/package.json", root)),
      { Client } = require("pg");
    client = new Client({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 5000,
      query_timeout: 15_000,
    });
    client.on("error", () => {
      connectionFailed = true;
    });
    await client.connect();
    const findings = await checkPublicSchema({ baseline, client, files });
    if (connectionFailed) {
      findings.push("database_connection_failed");
    }
    console.info(
      JSON.stringify({
        findings,
        passed: findings.length === 0,
        target: "rocktownlabs/soundkit/main",
      })
    );
    if (findings.length) {
      process.exitCode = 1;
    }
  } catch {
    console.error(
      "Public schema check failed; connection/provider details redacted. No schema was applied."
    );
    process.exitCode = 1;
  } finally {
    try {
      await client?.end();
    } catch {
      process.exitCode = 1;
    }
  }
}
