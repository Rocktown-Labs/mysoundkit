/* oxlint-disable one-var, sort-vars -- Explicit sequential administrative fixtures. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  bootstrapStaging,
  publicSchemaBaseline,
} from "./staging-bootstrap.mjs";

const schema = "CREATE SCHEMA public;\nCREATE TABLE public.fixture(id text);",
  options = {
    appRole: "staging_fixture",
    schemaSha256: createHash("sha256")
      .update(publicSchemaBaseline(schema))
      .digest("hex"),
    schemaSql: schema,
    sourceCommit: "a".repeat(40),
    target: "rocktownlabs/soundkit/staging",
  };
test("baseline drops only dump metadata and analytics capture triggers", () => {
  const result = publicSchemaBaseline(
    `\\restrict fixture\nSET statement_timeout = 0;\nSELECT pg_catalog.set_config('search_path', '', false);\n${schema}\nCREATE TRIGGER soundkit_analytics_capture AFTER INSERT ON public.fixture EXECUTE FUNCTION soundkit_analytics.capture();\n\\unrestrict fixture`
  );
  assert.ok(result.includes("CREATE TABLE public.fixture"));
  assert.ok(result.includes("CREATE SCHEMA IF NOT EXISTS public"));
  assert.ok(!result.includes("SET statement_timeout"));
  assert.ok(!result.includes("CREATE TRIGGER"));
  assert.ok(!result.includes("\\restrict"));
});
test("bootstrap refuses a production target before any database query", async () => {
  let queried = false;
  await assert.rejects(
    bootstrapStaging({
      ...options,
      client: {
        query() {
          queried = true;
        },
      },
      target: "rocktownlabs/soundkit/main",
    })
  );
  assert.equal(queried, false);
});
test("source hash and role identifiers fail before database access", async () => {
  for (const override of [
    { schemaSha256: "invalid" },
    { appRole: 'role";injected' },
    { sourceCommit: "unknown" },
  ]) {
    await assert.rejects(
      bootstrapStaging({
        ...options,
        ...override,
        client: {
          query() {
            assert.fail("Unexpected database access");
          },
        },
      })
    );
  }
});
test("a non-empty database without the staging marker rolls back before DDL", async () => {
  const statements = [],
    client = {
      query(text) {
        statements.push(text);
        let rows = [];
        if (text.includes("AS locked")) {
          rows = [{ locked: true }];
        } else if (text.includes("to_regclass")) {
          rows = [{ identity: null }];
        } else if (text.includes("AS tables")) {
          rows = [{ tables: 1 }];
        }
        return Promise.resolve({ rows });
      },
    };
  await assert.rejects(
    bootstrapStaging({ ...options, client }),
    /empty database/u
  );
  assert.equal(statements.at(-1), "ROLLBACK");
  assert.ok(
    !statements.some((text) => /CREATE EXTENSION|CREATE TABLE/u.test(text))
  );
});
test("baseline sanity check rejects obvious data and destructive commands", () => {
  for (const statement of [
    "INSERT INTO public.fixture VALUES('x');",
    "DELETE FROM public.fixture;",
    "DROP TABLE public.fixture;",
    "COPY public.fixture FROM stdin;",
    "  dRoP TABLE public.fixture;",
  ]) {
    assert.throws(() => publicSchemaBaseline(`${schema}\n${statement}`));
  }
});
