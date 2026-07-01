import { defineConfig, devices } from "@playwright/test";

const webBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4311";
const serverBaseUrl = process.env.PLAYWRIGHT_API_URL ?? "http://127.0.0.1:3000";
const useExternalWeb = Boolean(process.env.PLAYWRIGHT_BASE_URL);

export default defineConfig({
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
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
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
        url: webBaseUrl,
      },
});
