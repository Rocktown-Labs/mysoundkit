/* oxlint-disable one-var, sort-vars -- Sequential request assertions. */
import assert from "node:assert/strict";
import test from "node:test";

import { logoutStaging, smokeTarget } from "./staging-smoke.mjs";

test("synthetic probes cannot target production, local or arbitrary hosts", () => {
  for (const stage of [
    "prod",
    "local",
    "pr-0",
    "pr-01",
    "pr-1/path",
    "https://mysoundkit.com",
  ]) {
    assert.throws(() => smokeTarget(stage));
  }
  assert.equal(smokeTarget().api, "https://api.staging.soundkit.bio");
  assert.deepEqual(smokeTarget("pr-534"), {
    api: "https://api.pr-534.preview.soundkit.bio",
    bio: "https://bio.pr-534.preview.soundkit.bio",
    cookieDomain: "pr-534.preview.soundkit.bio",
    cookieName: "__Secure-soundkit-pr-534.session_token",
    origin: "https://pr-534.preview.soundkit.bio",
    stage: "pr-534",
  });
});

test("preview logout uses the selected preview origin", async () => {
  const origin = "https://pr-534.preview.soundkit.bio";
  await logoutStaging(
    "synthetic-cookie",
    (path, options) => {
      if (path === "/auth/sign-out") {
        assert.equal(options.headers.origin, origin);
        return Response.json({ success: true });
      }
      return Response.json(null);
    },
    origin
  );
});

test("staging cleanup sends accepted JSON and checks the old session is revoked", async () => {
  const paths = [];
  await logoutStaging("synthetic-cookie", (path, options) => {
    paths.push(path);
    assert.equal(options.headers.cookie, "synthetic-cookie");
    if (path === "/auth/sign-out") {
      assert.equal(options.method, "POST");
      assert.equal(options.headers.origin, "https://staging.soundkit.bio");
      // Better Auth rejects this request with 415 without the JSON header.
      if (options.headers["content-type"] !== "application/json") {
        return Response.json({}, { status: 415 });
      }
      assert.deepEqual(JSON.parse(options.body), {});
      return Response.json({ success: true });
    }
    return Response.json(null);
  });
  assert.deepEqual(paths, ["/auth/sign-out", "/auth/get-session"]);
});

test("staging cleanup rejects failed logout and a session that stays valid", async () => {
  await assert.rejects(
    logoutStaging("synthetic-cookie", () => Response.json({}, { status: 415 })),
    /logout failed/u
  );
  await assert.rejects(
    logoutStaging("synthetic-cookie", (path) =>
      Response.json(path === "/auth/get-session" ? { user: {} } : {})
    ),
    /remained valid/u
  );
  await assert.rejects(
    logoutStaging("synthetic-cookie", (path) =>
      Response.json({}, { status: path === "/auth/get-session" ? 503 : 200 })
    ),
    /remained valid/u
  );
});
