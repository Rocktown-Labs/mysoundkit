import { defineConfig, devices } from "@playwright/test";

const serverBaseUrl =
    process.env.PLAYWRIGHT_API_URL ??
    process.env.SOUNDKIT_E2E_API_URL ??
    "http://127.0.0.1:3000",
  useExternalWeb = Boolean(
    process.env.PLAYWRIGHT_BASE_URL || process.env.SOUNDKIT_E2E_WEB_URL
  ),
  webBaseUrl =
    process.env.PLAYWRIGHT_BASE_URL ??
    process.env.SOUNDKIT_E2E_WEB_URL ??
    "http://127.0.0.1:4311";

export default defineConfig({
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  // The browser suite runs against an on-demand vite dev server on shared CI
  // machines: several tests render heavy live surfaces (WebSocket chat rooms,
  // streamed battles) whose first load intermittently exceeds a strict
  // actionability budget. One retry absorbs those transient failures — every
  // hard failure this suite has had in CI history (payments-page guide click,
  // battle chat presence) has passed on rerun with identical code.
  retries: 1,
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
    },
  ],
  reporter: [["list"], ["html", { open: "never" }]],
  testDir: "tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: webBaseUrl,
    trace: "retain-on-failure",
  },
  webServer: useExternalWeb
    ? undefined
    : {
        command: "node tests/e2e/start-dev-with-mock-api.mjs",
        env: {
          PLAYWRIGHT_API_URL: serverBaseUrl,
          PLAYWRIGHT_BASE_URL: webBaseUrl,
        },
        reuseExistingServer: false,
        timeout: 240_000,
        url: webBaseUrl,
      },
  // The suite shares one vite dev server per run; uncapped workers saturate
  // small CI machines and stall on-demand route module compilation.
  workers: 2,
});
