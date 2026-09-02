import { fileURLToPath } from "node:url";

import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      main: "apps/server/src/index.ts",
      wrangler: { configPath: "./apps/server/wrangler.test.jsonc" },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("apps/server/src", import.meta.url)),
    },
  },
  test: {
    include: ["apps/server/src/durable-objects/live-review.integration.ts"],
  },
});
