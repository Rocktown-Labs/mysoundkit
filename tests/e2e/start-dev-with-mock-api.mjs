import { spawn } from "node:child_process";

import { createMockApiServer } from "./mock-api.mjs";

const webBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4311",
  apiBaseUrl = process.env.PLAYWRIGHT_API_URL ?? "http://127.0.0.1:3000",
  webUrl = new URL(webBaseUrl),
  apiUrl = new URL(apiBaseUrl),
  mockApi = await createMockApiServer({
    host: apiUrl.hostname,
    port: Number(apiUrl.port || "80"),
    webOrigin: webUrl.origin,
  }),
  vite = spawn(
    "pnpm",
    [
      "--dir",
      "apps/website",
      "run",
      "dev",
      "--host",
      webUrl.hostname,
      "--port",
      webUrl.port || "4311",
    ],
    {
      env: {
        ...process.env,
        SOUNDKIT_CI_STATIC_CONFIG:
          process.env.SOUNDKIT_CI_STATIC_CONFIG ?? "true",
        VITE_MEDIA_URL: apiUrl.origin,
        VITE_SERVER_URL: apiUrl.origin,
      },
      stdio: "inherit",
    }
  ),
  shutdown = () => {
    vite.kill("SIGTERM");
    mockApi.close(() => process.exit(0));
  };

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

vite.on("exit", (code) => {
  mockApi.close(() => process.exit(code ?? 0));
});
