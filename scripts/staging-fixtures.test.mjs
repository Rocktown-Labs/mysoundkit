/* oxlint-disable one-var, sort-vars -- Ordered fixture setup and assertions. */
import assert from "node:assert/strict";
import test from "node:test";

import {
  fixtureAccounts,
  fixtureTracks,
  seedStaging,
} from "./staging-fixtures.mjs";

const passwords = {
    artist: "a".repeat(40),
    collaborator: "c".repeat(40),
    fan: "b".repeat(40),
  },
  base = {
    mediaBucket: "soundkit-media-staging",
    passwords,
    target: "rocktownlabs/soundkit/staging",
  };
test("fixtures are synthetic, stable and contain no credential values", () => {
  assert.equal(fixtureAccounts.length, 3);
  assert.equal(fixtureTracks.length, 3);
  assert.ok(
    fixtureAccounts.every(
      (account) =>
        account.email.endsWith("@example.test") &&
        account.id.startsWith("staging-fixture-v1-")
    )
  );
  assert.ok(!JSON.stringify(fixtureAccounts).includes("password"));
});
test("production or shared media is rejected before any query", async () => {
  const client = {
    query() {
      assert.fail("Unexpected database access");
    },
  };
  await assert.rejects(
    seedStaging({ ...base, client, target: "rocktownlabs/soundkit/main" })
  );
  await assert.rejects(
    seedStaging({ ...base, client, mediaBucket: "soundkit-media" })
  );
  await assert.rejects(
    seedStaging({ ...base, client, passwords: { ...passwords, fan: "short" } })
  );
});
test("the actual database marker must match before account or password writes", async () => {
  const queries = [],
    client = {
      query(sql) {
        queries.push(sql);
        return Promise.resolve({
          rows: sql.includes("SELECT target")
            ? [{ target: "rocktownlabs/soundkit/main" }]
            : [],
        });
      },
    };
  await assert.rejects(seedStaging({ ...base, client }));
  assert.equal(queries.at(-1), "ROLLBACK");
  assert.ok(!queries.some((query) => query.startsWith("INSERT")));
});
