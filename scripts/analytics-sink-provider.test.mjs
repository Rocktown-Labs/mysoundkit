import assert from "node:assert/strict";
import { test } from "node:test";

import { CloudflareEnvironment } from "alchemy/Cloudflare";
import { Sink, SinkProvider } from "alchemy/Cloudflare/Pipelines";
import { Provider } from "alchemy/Provider";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";

const props = (secret = "fixture-secret") => ({
  config: {
    bucket: "fixture-bucket",
    credentials: {
      accessKeyId: Redacted.make("fixture-access"),
      secretAccessKey: Redacted.make(secret),
    },
  },
  format: { type: "json" },
  name: "analytics_archive",
  type: "r2",
});

async function diff(olds, news = props()) {
  const check = Effect.gen(function* compareSink() {
      const provider = yield* Provider(Sink.Type);
      return yield* provider.diff({
        fqn: "soundkit/pr-507/analytics-archive-v1",
        id: "analytics-archive-v1",
        instanceId: "fixture-instance",
        newBindings: [],
        news,
        oldBindings: [],
        olds,
        output: { accountId: "fixture-account", name: "analytics_archive" },
      });
    }),
    credentials = Effect.succeed({
      accountId: "fixture-account",
      apiToken: Redacted.make("fixture-token"),
      source: { type: "env" },
      type: "apiToken",
    }),
    ready = check.pipe(
      Effect.provide(SinkProvider()),
      Effect.provideService(CloudflareEnvironment, credentials)
    );
  return await Effect.runPromise(ready);
}

for (const [label, credentials] of [
  ["absent", undefined],
  ["empty", {}],
  ["missing secret", { accessKeyId: Redacted.make("fixture-access") }],
]) {
  test(`incomplete saved sink credentials trigger replacement: ${label}`, async () => {
    const olds = props();
    olds.config.credentials = credentials;
    assert.deepEqual(await diff(olds), { action: "replace" });
  });
}

test("equal redacted sink credentials do not replace the sink", async () => {
  assert.equal(await diff(props()), undefined);
});

test("rotated sink credentials still replace the sink", async () => {
  assert.deepEqual(await diff(props("previous-secret")), { action: "replace" });
});
