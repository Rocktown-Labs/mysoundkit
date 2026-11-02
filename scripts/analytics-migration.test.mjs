/* oxlint-disable node/no-sync -- CLI guard tests intentionally wait for each isolated child process. */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const fixtureUrl = process.env.SOUNDKIT_TEST_DATABASE_URL,
  localFixture =
    fixtureUrl &&
    ["127.0.0.1", "localhost", "[::1]"].includes(new URL(fixtureUrl).hostname),
  script = fileURLToPath(new URL("analytics-migration.mjs", import.meta.url));
test("analytics migration fingerprint is stable without database credentials", () => {
  const env = {
      ...process.env,
      DATABASE_URL: "",
      SOUNDKIT_TEST_DATABASE_URL: "",
    },
    first = execFileSync(process.execPath, [script, "--fingerprint"], {
      encoding: "utf-8",
      env,
    }).trim(),
    second = execFileSync(process.execPath, [script, "--fingerprint"], {
      encoding: "utf-8",
      env,
    }).trim();
  assert.match(first, /^[a-f0-9]{64}$/u);
  assert.strictEqual(first, second);
});
test("test migration mode cannot target a remote production host", () => {
  const result = spawnSync(process.execPath, [script, "--test-apply"], {
    encoding: "utf-8",
    env: {
      ...process.env,
      SOUNDKIT_TEST_DATABASE_URL: "postgres://fixture@production.invalid/db",
    },
  });
  assert.notStrictEqual(result.status, 0);
  assert.match(result.stderr, /local isolated fixture database/u);
});
test("production apply refuses an unapproved hash before opening a database connection", () => {
  const result = spawnSync(
    process.execPath,
    [script, "--apply", "--sha256", "not-approved"],
    {
      encoding: "utf-8",
      env: {
        ...process.env,
        DATABASE_URL: "postgres://fixture@production.invalid/db",
        SOUNDKIT_ANALYTICS_TARGET: "rocktownlabs/soundkit/main",
      },
    }
  );
  assert.notStrictEqual(result.status, 0);
  assert.match(result.stderr, /exact approved migration fingerprint/u);
});

test(
  "installed fixture passes real CLI check and idempotent test apply",
  { skip: !localFixture },
  () => {
    for (const mode of ["--check", "--test-apply", "--check"]) {
      const result = spawnSync(process.execPath, [script, mode], {
        encoding: "utf-8",
        env: { ...process.env, DATABASE_URL: fixtureUrl },
      });
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /fingerprint and capture triggers verified/u);
    }
  }
);
