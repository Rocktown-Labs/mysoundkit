import assert from "node:assert/strict";
import test from "node:test";

import { diagnosePipelinesAuth } from "./ci/diagnose-pipelines-auth.mjs";

const account = "a".repeat(32),
  env = {
    CLOUDFLARE_ACCOUNT_ID: account,
    CLOUDFLARE_API_TOKEN: "fixture-secret",
  },
  tokenId = "b".repeat(32);

function mockApi(routes, calls = []) {
  return (url, init) => {
    calls.push({ init, url });
    assert.equal(init.method, "GET");
    assert.equal(init.redirect, "error");
    assert.equal(init.headers.Authorization, "Bearer fixture-secret");
    const path = new URL(url).pathname.replace("/client/v4/", ""),
      [status, body] = routes[path] ?? [
        403,
        {
          errors: [{ code: 10_000, message: "fixture-secret" }],
          success: false,
        },
      ];
    return Promise.resolve({ json: () => Promise.resolve(body), status });
  };
}

test("distinguishes working Workers from rejected Pipelines without exposing credentials", async () => {
  const reports = await diagnosePipelinesAuth(
    env,
    mockApi({
      [`accounts/${account}/workers/scripts`]: [
        200,
        { result: [{ id: "private-worker" }], success: true },
      ],
    })
  );
  assert.deepEqual(reports[0], {
    codes: [],
    probe: "workers_control",
    status: 200,
    success: true,
  });
  assert.deepEqual(reports[1], {
    codes: [10_000],
    probe: "pipeline_streams",
    status: 403,
    success: false,
  });
  assert.doesNotMatch(
    JSON.stringify(reports),
    /fixture-secret|private-worker|aaaa/u
  );
});

test("reports only Pipeline policy names and whether the target account is included", async () => {
  const reports = await diagnosePipelinesAuth(
    env,
    mockApi({
      "user/tokens/verify": [200, { result: { id: tokenId }, success: true }],
      [`user/tokens/${tokenId}`]: [
        200,
        {
          result: {
            name: "private-token-name",
            policies: [
              {
                effect: "allow",
                permission_groups: [
                  { name: "Workers Pipelines Edit" },
                  { name: "private-other-permission" },
                ],
                resources: { [`com.cloudflare.api.account.${account}`]: "*" },
              },
            ],
          },
          success: true,
        },
      ],
    })
  );
  assert.deepEqual(reports.at(-1), {
    policies: [
      {
        effect: "allow",
        permissions: ["Workers Pipelines Edit"],
        targetAccountIncluded: true,
      },
    ],
    probe: "pipeline_policy_metadata",
  });
  assert.doesNotMatch(
    JSON.stringify(reports),
    /private-|fixture-secret|aaaa|bbbb/u
  );
});

test("supports account-owned tokens and identifies a different account scope", async () => {
  const reports = await diagnosePipelinesAuth(
    env,
    mockApi({
      [`accounts/${account}/tokens/verify`]: [
        200,
        { result: { id: tokenId }, success: true },
      ],
      [`accounts/${account}/tokens/${tokenId}`]: [
        200,
        {
          result: {
            policies: [
              {
                effect: "allow",
                permission_groups: [{ name: "Pipelines Write" }],
                resources: { "com.cloudflare.api.account.other": "*" },
              },
            ],
          },
          success: true,
        },
      ],
    })
  );
  assert.equal(reports.at(-1).policies[0].targetAccountIncluded, false);
});

test("network failures never expose arbitrary exception text", async () => {
  const reports = await diagnosePipelinesAuth(env, () =>
    Promise.reject(new Error("fixture-secret"))
  );
  assert.equal(reports.length, 5);
  assert.ok(reports.every((report) => report.transportFailed));
  assert.doesNotMatch(JSON.stringify(reports), /fixture-secret/u);
});

test("missing credentials fail before making any request", async () => {
  let calls = 0;
  await assert.rejects(
    diagnosePipelinesAuth({}, () => {
      calls += 1;
      return Promise.resolve();
    }),
    /not configured/u
  );
  assert.equal(calls, 0);
});
