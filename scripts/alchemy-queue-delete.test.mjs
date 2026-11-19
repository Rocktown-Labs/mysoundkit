/* eslint-disable one-var, sort-vars, node/no-top-level-await -- This ESM-only test loads the installed ESM provider before exercising it. */
import assert from "node:assert/strict";
import { readFile, realpath } from "node:fs/promises";
import { createRequire, stripTypeScriptTypes } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { runInNewContext } from "node:vm";

const infraRequire = createRequire(
    new URL("../packages/infra/package.json", import.meta.url)
  ),
  alchemyRoot = await realpath(
    new URL("../node_modules/alchemy", import.meta.url)
  ),
  Effect = await import(
    pathToFileURL(infraRequire.resolve("effect/Effect")).href
  ),
  Schedule = await import(
    pathToFileURL(infraRequire.resolve("effect/Schedule")).href
  );

// Exercise the installed provider's real live-delete handler with queue API
// doubles. The pinned dependency has no public standalone deletion export.
async function deleteHandler(directory, failure) {
  const extension = directory === "src" ? "ts" : "js",
    source = await readFile(
      path.resolve(
        alchemyRoot,
        directory,
        `Cloudflare/Queues/Consumer.${extension}`
      ),
      "utf-8"
    ),
    providerStart = source.indexOf("export const ConsumerProviderLive"),
    start = source.indexOf("delete: Effect.fn", providerStart),
    end = source.indexOf("read: Effect.fn", start);
  assert.ok(
    providerStart !== -1 && start > providerStart && end > start,
    "pinned provider seam exists"
  );
  const expression = source
    .slice(start + "delete: ".length, end)
    .trim()
    .replace(/,$/u, "");
  let code = `const handler = ${expression};\nhandler;`;
  if (directory === "src") {
    code = stripTypeScriptTypes(code, { mode: "strip" });
  }
  return runInNewContext(code, {
    Effect,
    Schedule,
    isLiveId: () => true,
    queues: {
      deleteConsumer: () =>
        failure ? Effect.fail({ _tag: failure }) : Effect.void,
      getConsumer: () => Effect.fail({ _tag: "ConsumerNotFound" }),
    },
  });
}

for (const directory of ["src", "lib"]) {
  for (const failure of ["QueueNotFound", "ConsumerNotFound", undefined]) {
    test(`${directory} live consumer deletion tolerates ${failure ?? "an already detached consumer"}`, async () => {
      const handler = await deleteHandler(directory, failure);
      await Effect.runPromise(
        handler({
          output: {
            accountId: "test-account",
            consumerId: "live-consumer",
            queueId: "gone-queue",
          },
        })
      );
    });
  }
  test(`${directory} live consumer deletion preserves authentication errors`, async () => {
    const handler = await deleteHandler(directory, "AuthenticationError");
    await assert.rejects(
      Effect.runPromise(
        handler({
          output: {
            accountId: "test-account",
            consumerId: "live-consumer",
            queueId: "queue",
          },
        })
      )
    );
  });
}
