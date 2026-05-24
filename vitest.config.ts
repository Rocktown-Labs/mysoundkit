import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("apps/server/src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    exclude: ["apps/server/src/**/*.worker.test.ts"],
    include: ["apps/server/src/**/*.test.ts", "apps/website/src/**/*.test.ts"],
  },
});
