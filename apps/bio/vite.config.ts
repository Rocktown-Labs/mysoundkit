import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import alchemy from "alchemy/cloudflare/tanstack-start";
import { defineConfig } from "vite";

const ciConfigPath =
  process.env.SOUNDKIT_CI_STATIC_CONFIG === "true"
    ? "./wrangler.ci.jsonc"
    : undefined;

export default defineConfig({
  plugins: [
    tailwindcss(),
    tanstackStart({
      router: {
        routesDirectory: "app",
      },
      srcDirectory: "src",
    }),
    viteReact(),
    alchemy({ configPath: ciConfigPath }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("src", import.meta.url)),
    },
    dedupe: ["react", "react-dom"],
  },
  server: {
    port: 3002,
  },
});
