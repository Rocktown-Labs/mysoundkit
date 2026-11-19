/* eslint-disable one-var, node/no-top-level-await -- This ESM-only test imports the installed patched provider. */
import assert from "node:assert/strict";
import { readFile, realpath } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const infraRequire = createRequire(
  new URL("../packages/infra/package.json", import.meta.url)
);
const root = await realpath(
  new URL("../node_modules/alchemy", import.meta.url)
);
const Effect = await import(
  pathToFileURL(infraRequire.resolve("effect/Effect")).href
);
const { tolerateMissingConsumer } = await import(
  pathToFileURL(path.join(root, "lib/Cloudflare/Queues/Consumer.js")).href
);

for (const tag of ["QueueNotFound", "ConsumerNotFound"]) {
  test(`consumer deletion tolerates ${tag}`, async () => {
    await Effect.runPromise(
      tolerateMissingConsumer(Effect.fail({ _tag: tag }))
    );
  });
}
for (const tag of [
  "AuthenticationError",
  "RateLimitError",
  "UnexpectedError",
]) {
  test(`consumer deletion preserves ${tag}`, async () => {
    const result = tolerateMissingConsumer(Effect.fail({ _tag: tag }));
    await assert.rejects(
      Effect.runPromise(result),
      (error) => error["_tag"] === tag
    );
  });
}
test("successful consumer deletion remains successful", async () => {
  await Effect.runPromise(tolerateMissingConsumer(Effect.void));
});
// The patch owns this explicit import seam in the pinned beta package. Verify
// both runtimes use it so a compiled/source mismatch cannot ship unnoticed.
for (const [directory, extension] of [
  ["src", "ts"],
  ["lib", "js"],
]) {
  test(`${directory} live deletion uses the tested missing-resource handler`, async () => {
    const source = await readFile(
      path.join(root, directory, `Cloudflare/Queues/Consumer.${extension}`),
      "utf-8"
    );
    assert.match(source, /export const tolerateMissingConsumer/u);
    const live = source.slice(
      source.indexOf("export const ConsumerProviderLive")
    );
    assert.match(
      live,
      /delete: Effect.fn[\s\S]*?\.pipe\(tolerateMissingConsumer\)/u
    );
  });
}
