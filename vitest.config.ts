import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("apps/server/src", import.meta.url)),
      "cloudflare:workers": fileURLToPath(
        new URL(
          "apps/server/src/test-support/cloudflare-workers-node.ts",
          import.meta.url
        )
      ),
    },
  },
  test: {
    environment: "node",
    exclude: ["apps/server/src/**/*.worker.test.ts"],
    include: [
      "apps/server/src/**/*.test.ts",
      "apps/website/src/**/*.test.ts",
      "packages/db/src/**/*.test.ts",
    ],
  },
});
