import { createRouter } from "@tanstack/react-router";

import type { RouterAppContext } from "./app/__root";
import { loadSentry } from "./lib/sentry-client";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const router = createRouter({
    context: {} as RouterAppContext,
    notFoundMode: "root",
    routeTree,
    scrollRestoration: true,
  });

  if (!(router as { isServer?: boolean }).isServer) {
    // The Sentry SDK imports on idle (see lib/sentry-client) so its ~110KB
    // stays out of the entry chunk.
    loadSentry(router);
  }

  return router;
}
