/* oxlint-disable node/no-sync -- CLI guard tests intentionally wait for each isolated child process. */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import test from "node:test";

const script = new URL("analytics-migration.mjs", import.meta.url);
test("analytics migration fingerprint is stable without database credentials", () => {
  const env = {
      ...process.env,
      DATABASE_URL: "",
      SOUNDKIT_TEST_DATABASE_URL: "",
    },
    first = execFileSync(process.execPath, [script.pathname, "--fingerprint"], {
      encoding: "utf-8",
      env,
    }).trim(),
    second = execFileSync(
      process.execPath,
      [script.pathname, "--fingerprint"],
      { encoding: "utf-8", env }
    ).trim();
  assert.match(first, /^[a-f0-9]{64}$/u);
  assert.equal(first, second);
});
test("test migration mode cannot target a remote production host", () => {
  const result = spawnSync(
    process.execPath,
    [script.pathname, "--test-apply"],
    {
      encoding: "utf-8",
      env: {
        ...process.env,
        SOUNDKIT_TEST_DATABASE_URL: "postgres://fixture@production.invalid/db",
      },
    }
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /local isolated fixture database/u);
});
test("production apply refuses an unapproved hash before opening a database connection", () => {
  const result = spawnSync(
    process.execPath,
    [script.pathname, "--apply", "--sha256", "not-approved"],
    {
      encoding: "utf-8",
      env: {
        ...process.env,
        DATABASE_URL: "postgres://fixture@production.invalid/db",
        SOUNDKIT_ANALYTICS_TARGET: "rocktownlabs/soundkit/main",
      },
    }
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /exact approved migration fingerprint/u);
});
