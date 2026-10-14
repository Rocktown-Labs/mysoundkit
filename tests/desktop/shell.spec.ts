/* oxlint-disable eslint/sort-vars, eslint/one-var -- declarator order follows data dependencies (the fixture starts before the app that loads it). */
/* oxlint-disable node/no-sync -- module-load existence checks decide whether the suite runs at all. */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { _electron as electron, expect, test } from "@playwright/test";
import electronBinaryPath from "electron";

import { startFixtureServer } from "./fixture-server.mjs";

/**
 * The suite runs the real main process (the same src/main.ts Forge bundles)
 * through the unfused dev Electron binary: the packaged app ships with the
 * `EnableNodeCliInspectArguments` fuse disabled, which is deliberate
 * hardening but strips the `--inspect` flag Playwright needs to attach. All
 * shell behavior under test lives in the main process, so coverage is
 * identical either way.
 */
const repoRoot = path.join(import.meta.dirname, "..", ".."),
  mainBundlePath = path.join(
    repoRoot,
    "apps",
    "desktop",
    ".vite",
    "build",
    "main.js"
  ),
  isBuilt = fs.existsSync(mainBundlePath),
  // Nothing listens on port 1, so "external" navigation targets fail
  // locally and instantly — nothing ever leaves the machine.
  unreachableUrl = "http://127.0.0.1:1/",
  launchShell = async (appUrl: string) => {
    const userDataDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), "soundkit-desktop-e2e-")
    );

    return electron.launch({
      args: [mainBundlePath],
      env: {
        ...process.env,
        SOUNDKIT_APP_URL: appUrl,
        SOUNDKIT_DISABLE_EXTERNAL_OPEN: "1",
        // Keep the suite invisible: no windows, no Dock icon, no
        // system-browser popups on the developer's desktop.
        SOUNDKIT_START_HIDDEN: "1",
        SOUNDKIT_USER_DATA_DIR: userDataDir,
      },
      executablePath: electronBinaryPath,
    });
  },
  closeShell = async (electronApp: Awaited<ReturnType<typeof launchShell>>) => {
    const childProcess = electronApp.process();

    await electronApp.close().catch(() => {});
    // macOS apps stay alive after their windows close; guarantee teardown.
    childProcess?.kill("SIGKILL");
  };

test.skip(
  !isBuilt,
  "build the desktop app first: pnpm --filter desktop run package"
);

test("loads the configured app URL in the shell window", async () => {
  const fixture = await startFixtureServer(),
    electronApp = await launchShell(fixture.url);

  try {
    const window = await electronApp.firstWindow();

    await expect(window.locator("#fixture-marker")).toHaveText(
      "SoundKit fixture"
    );
  } finally {
    await closeShell(electronApp);
    await fixture.close();
  }
});

test("blocks same-window navigation to hosts outside the allowlist", async () => {
  const fixture = await startFixtureServer(),
    electronApp = await launchShell(fixture.url);

  try {
    const window = await electronApp.firstWindow();

    await window.locator("#navigate-external").click({ noWaitAfter: true });

    // Canceled navigations leave Playwright's auto-waiting assertions stuck
    // on "waiting for navigation to finish" forever, so sample the live DOM
    // directly instead: the guard must have kept the page exactly where it
    // was.
    await window.waitForTimeout(1500);
    expect(
      new URL(await window.evaluate(() => window.location.href)).origin
    ).toBe(new URL(fixture.url).origin);
    expect(
      await window.evaluate(
        () => document.querySelector("#fixture-marker")?.textContent
      )
    ).toBe("SoundKit fixture");
  } finally {
    await closeShell(electronApp);
    await fixture.close();
  }
});

test("denies popups instead of opening extra windows", async () => {
  const fixture = await startFixtureServer(),
    electronApp = await launchShell(fixture.url);

  try {
    const window = await electronApp.firstWindow();

    await window.locator("#external-popup").click({ noWaitAfter: true });

    // The popup was denied rather than rendered in a second window.
    expect(electronApp.windows().length).toBe(1);
  } finally {
    await closeShell(electronApp);
    await fixture.close();
  }
});

test("shows the offline error page when the app URL cannot load", async () => {
  const electronApp = await launchShell(unreachableUrl);

  try {
    const window = await electronApp.firstWindow(),
      retryLink = window.locator("#retry");

    await expect(retryLink).toBeVisible();
    await expect(retryLink).toHaveAttribute("href", unreachableUrl);
  } finally {
    await closeShell(electronApp);
  }
});
