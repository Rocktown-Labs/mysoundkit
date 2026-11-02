import assert from "node:assert/strict";
import test from "node:test";

import {
  refundEvents,
  syncRefundSubscriptions,
} from "./ci/stripe-refund-events.mjs";

const endpoint = {
  enabled_events: ["checkout.session.completed", "charge.refunded"],
  id: "we_fixture",
  livemode: true,
  status: "enabled",
  url: "https://api.mysoundkit.com/v1/webhooks/stripe-commerce",
};

function provider(endpoints, captures = []) {
  return (url, init) => {
    assert.equal(init.redirect, "error");
    assert.equal(init.headers.Authorization, "Bearer fixture-key");
    if (init.method === "GET") {
      return Promise.resolve({
        json: () => Promise.resolve({ data: endpoints, has_more: false }),
        ok: true,
      });
    }
    assert.equal(url, "https://api.stripe.com/v1/webhook_endpoints/we_fixture");
    const params = new URLSearchParams(init.body);
    assert.deepEqual(
      [...params.keys()].filter((key) => key !== "enabled_events[]"),
      []
    );
    captures.push(params);
    return Promise.resolve({
      json: () =>
        Promise.resolve({
          ...endpoint,
          enabled_events: params.getAll("enabled_events[]"),
        }),
      ok: true,
    });
  };
}

test("dry run reports missing lifecycle events without writing", async () => {
  const captures = [],
    result = await syncRefundSubscriptions({
      fetchImpl: provider([endpoint], captures),
      secret: "fixture-key",
    });
  assert.equal(captures.length, 0);
  assert.equal(result[0].updated, false);
  assert.ok(result[0].missing.includes("refund.updated"));
});

test("adds only missing events and retains prior subscriptions", async () => {
  const captures = [];
  await syncRefundSubscriptions({
    apply: true,
    fetchImpl: provider([endpoint], captures),
    secret: "fixture-key",
  });
  assert.equal(captures.length, 1);
  assert.ok(
    captures[0]
      .getAll("enabled_events[]")
      .includes("checkout.session.completed")
  );
  assert.ok(
    refundEvents.every((event) =>
      captures[0].getAll("enabled_events[]").includes(event)
    )
  );
});

test("wildcard subscriptions are an idempotent no-op", async () => {
  const captures = [];
  await syncRefundSubscriptions({
    apply: true,
    fetchImpl: provider([{ ...endpoint, enabled_events: ["*"] }], captures),
    secret: "fixture-key",
  });
  assert.equal(captures.length, 0);
});

test("never creates or changes unrelated or disabled endpoints", async () => {
  const captures = [];
  await assert.rejects(
    syncRefundSubscriptions({
      apply: true,
      fetchImpl: provider(
        [
          { ...endpoint, url: "https://other.test" },
          { ...endpoint, status: "disabled" },
        ],
        captures
      ),
      secret: "fixture-key",
    }),
    /none created/u
  );
  assert.equal(captures.length, 0);
});
