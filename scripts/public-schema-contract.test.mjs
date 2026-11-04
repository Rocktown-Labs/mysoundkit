/* oxlint-disable one-var, sort-vars -- Ordered release-policy assertions. */
import assert from "node:assert/strict";
import test from "node:test";

import {
  checkPublicSchema,
  columnsFingerprint,
  contractFindings,
} from "./public-schema-contract.mjs";

const columns = [
    { column: "id", required: true, table: "tracks", type: "text" },
    {
      column: "published_at",
      required: false,
      table: "tracks",
      type: "timestamp with time zone",
    },
  ],
  files = [{ path: "packages/db/src/schema/app.ts", sha256: "a".repeat(64) }],
  baseline = {
    columnCount: 2,
    columnsSha256: columnsFingerprint(columns),
    files,
    tableCount: 1,
    target: "rocktownlabs/soundkit/main",
    version: 1,
  },
  valid = { baseline, columns, files, vector: true };

test("source changes cannot silently become a production schema push", () => {
  assert.equal(
    columnsFingerprint(columns),
    "1b54a4f42b75ca49720a8c1210846f7b694733fde0fe50334fb3442b140bfd72"
  );
  assert.deepEqual(contractFindings(valid), []);
  assert.deepEqual(
    contractFindings({
      ...valid,
      files: [
        ...files,
        { path: "packages/db/src/schema/new.ts", sha256: "b".repeat(64) },
      ],
    }),
    ["source_schema_unreviewed"]
  );
});
test("missing columns, changed types and changed nullability refuse deployment", () => {
  for (const changed of [
    columns.slice(1),
    [{ ...columns[0], type: "integer" }, columns[1]],
    [{ ...columns[0], required: false }, columns[1]],
  ]) {
    assert.ok(
      contractFindings({ ...valid, columns: changed }).includes(
        "database_column_contract_mismatch"
      )
    );
  }
  assert.deepEqual(
    contractFindings({ ...valid, columns: columns.toReversed() }),
    []
  );
  assert.deepEqual(contractFindings({ ...valid, vector: false }), [
    "vector_extension_missing",
  ]);
});
test("type modifiers are significant to the release contract", () => {
  assert.notEqual(
    columnsFingerprint([{ ...columns[0], type: "numeric(10,2)" }]),
    columnsFingerprint([{ ...columns[0], type: "numeric" }])
  );
});
test("database check uses a read-only transaction and rolls back even on failure", async () => {
  const statements = [],
    client = {
      query(sql) {
        statements.push(sql);
        if (sql.startsWith("SELECT c.relname")) {
          return Promise.resolve({ rows: columns });
        }
        return Promise.resolve({ rows: [{ installed: true }] });
      },
    };
  assert.deepEqual(await checkPublicSchema({ baseline, client, files }), []);
  assert.equal(statements[0], "BEGIN READ ONLY");
  assert.equal(statements.at(-1), "ROLLBACK");
  assert.ok(
    !statements.some((sql) =>
      /\b(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|TRUNCATE)\b/u.test(sql)
    )
  );
  const failed = [];
  await assert.rejects(
    checkPublicSchema({
      baseline,
      client: {
        query(sql) {
          failed.push(sql);
          if (sql.startsWith("SELECT c.relname")) {
            throw new Error("Unavailable");
          }
          return Promise.resolve({ rows: [] });
        },
      },
      files,
    })
  );
  assert.equal(failed.at(-1), "ROLLBACK");
});
