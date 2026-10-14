#!/usr/bin/env node
/**
 * Ensures the Electron dev binary is present after `pnpm install`.
 *
 * Electron 44 ships without a postinstall script (an npm supply-chain
 * hardening change), so `node_modules/electron/dist` must be fetched
 * explicitly by running `electron/install.js`. Without it, `pnpm run
 * dev:desktop` (electron-forge start) fails with a confusing
 * "Electron failed to install correctly" error.
 *
 * Skipped in CI unless SOUNDKIT_ELECTRON_BINARY=1: CI never runs
 * `electron-forge start` — packaging fetches its own zips through
 * electron/get — so the verify pipeline shouldn't pay for this download.
 */
/* oxlint-disable eslint/one-var, eslint/sort-vars -- declarator order follows data dependencies. */
/* oxlint-disable node/no-sync -- a pre-install existence check is intentionally synchronous. */
/* oxlint-disable node/no-top-level-await -- install scripts run under Node, not require(esm). */

import { existsSync } from "node:fs";
import process from "node:process";

const electronInstallUrl = new URL(
    "../node_modules/electron/install.js",
    import.meta.url
  ),
  skipInCi =
    process.env.CI === "true" && process.env.SOUNDKIT_ELECTRON_BINARY !== "1",
  skippedByEnv = process.env.SOUNDKIT_SKIP_ELECTRON_BINARY === "1";

await (async () => {
  if (skipInCi || skippedByEnv || !existsSync(electronInstallUrl)) {
    return;
  }

  try {
    await import(electronInstallUrl);
  } catch (error) {
    console.error(
      "Failed to download the Electron dev binary (needed for `pnpm run dev:desktop`).",
      "Re-run with `node scripts/ensure-desktop-electron.mjs`, or skip with SOUNDKIT_SKIP_ELECTRON_BINARY=1.",
      error
    );
    process.exit(1);
  }
})();
