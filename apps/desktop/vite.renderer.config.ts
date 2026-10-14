import { defineConfig } from "vite";

import { DEFAULT_APP_URL, resolveAppUrl } from "./src/lib/app-config";

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        error: "error.html",
        index: "index.html",
      },
    },
  },
  define: {
    __SOUNDKIT_APP_URL__: JSON.stringify(
      resolveAppUrl(process.env.SOUNDKIT_APP_URL ?? DEFAULT_APP_URL)
    ),
  },
});
