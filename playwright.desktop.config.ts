import { defineConfig } from "@playwright/test";

// The desktop shell suite launches the packaged Electron app
// (`pnpm --filter desktop run package`) against a local fixture server, so it
// never touches the network and runs one instance at a time — the app holds a
// single-instance lock.
export default defineConfig({
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  reporter: [["list"]],
  testDir: "tests/desktop",
  timeout: 60_000,
  use: {
    trace: "retain-on-failure",
  },
  workers: 1,
});
