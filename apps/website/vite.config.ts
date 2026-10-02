import { fileURLToPath } from "node:url";

import { sentryTanstackStart } from "@sentry/tanstackstart-react/vite";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const hasSentryAuthToken = Boolean(process.env.SENTRY_AUTH_TOKEN);

export default defineConfig(({ mode }) => {
  const isDev = mode === "development";

  return {
    optimizeDeps: {
      include: [
        "@stripe/connect-js/pure",
        "@tanstack/react-devtools",
        "@tanstack/react-query-devtools",
        "@tanstack/react-router-devtools",
        "better-auth/client/plugins",
        "better-auth/react",
      ],
    },
    plugins: [
      ...(isDev
        ? [
            devtools({
              removeDevtoolsOnBuild: true,
            }),
          ]
        : []),
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
    ],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("src", import.meta.url)),
      },
      dedupe: ["react", "react-dom"],
    },
    server: {
      port: 3001,
      proxy: {
        "/ingest": {
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/ingest/u, ""),
          secure: false,
          target: "https://us.i.posthog.com",
        },
        "/ingest/array": {
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/ingest/u, ""),
          secure: false,
          target: "https://us-assets.i.posthog.com",
        },
        "/ingest/static": {
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/ingest/u, ""),
          secure: false,
          target: "https://us-assets.i.posthog.com",
        },
      },
    },
  };
});
