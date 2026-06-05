import { fileURLToPath } from "node:url";

import { sentryTanstackStart } from "@sentry/tanstackstart-react/vite";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import alchemy from "alchemy/cloudflare/tanstack-start";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const ciConfigPath =
  process.env.SOUNDKIT_CI_STATIC_CONFIG === "true"
    ? "./wrangler.ci.jsonc"
    : undefined;
const hasSentryAuthToken = Boolean(process.env.SENTRY_AUTH_TOKEN);

export default defineConfig({
  plugins: [
    devtools(),
    tsconfigPaths(),
    tailwindcss(),
    tanstackStart({
      router: {
        routesDirectory: "app",
      },
      srcDirectory: "src",
    }),
    sentryTanstackStart({
      authToken: process.env.SENTRY_AUTH_TOKEN,
      org: "rocktown-labs-tq",
      project: "soundkit-web",
      sourcemaps: {
        disable: hasSentryAuthToken ? false : "disable-upload",
      },
      telemetry: false,
    }),
    viteReact(),
    alchemy({ configPath: ciConfigPath }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("src", import.meta.url)),
    },
  },
  server: {
    port: 3001,
    proxy: {
      "/ingest": {
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ingest/, ""),
        secure: false,
        target: "https://us.i.posthog.com",
      },
      "/ingest/array": {
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ingest/, ""),
        secure: false,
        target: "https://us-assets.i.posthog.com",
      },
      "/ingest/static": {
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ingest/, ""),
        secure: false,
        target: "https://us-assets.i.posthog.com",
      },
    },
  },
});
