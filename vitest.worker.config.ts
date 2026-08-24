import { fileURLToPath } from "node:url";

import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      main: "apps/server/src/index.ts",
      miniflare: {
        bindings: {
          BETTER_AUTH_SECRET:
            "soundkit-test-secret-at-least-thirty-two-characters",
          BETTER_AUTH_URL: "http://127.0.0.1:3000",
          CORS_ORIGIN: "http://127.0.0.1:3001",
          GOOGLE_EMBEDDING_MODEL: "gemini-embedding-2",
          MEDIA_PUBLIC_URL: "http://127.0.0.1:3000",
          STRIPE_BETTER_AUTH_WEBHOOK_SECRET: "whsec_soundkit_better_auth_test",
          STRIPE_COMMERCE_WEBHOOK_SECRET: "whsec_soundkit_commerce_test",
          STRIPE_CONNECT_WEBHOOK_SECRET: "whsec_soundkit_connect_test",
          VITE_MEDIA_URL: "http://127.0.0.1:3000",
          VITE_SERVER_URL: "http://127.0.0.1:3000",
        },
        compatibilityDate: "2026-04-12",
        compatibilityFlags: ["nodejs_compat"],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("apps/server/src", import.meta.url)),
    },
  },
  test: {
    include: ["apps/server/src/**/*.worker.test.ts"],
  },
});
