import * as Sentry from "@sentry/tanstackstart-react";
import { env } from "@soundkit/env/web";
import { createRouter } from "@tanstack/react-router";

import type { RouterAppContext } from "./app/__root";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const router = createRouter({
    context: {} as RouterAppContext,
    notFoundMode: "root",
    routeTree,
    scrollRestoration: true,
  });

  if (!(router as { isServer?: boolean }).isServer && env.VITE_SENTRY_DSN) {
    Sentry.init({
      dsn: env.VITE_SENTRY_DSN,
      enableLogs: true,
      integrations: [Sentry.tanstackRouterBrowserTracingIntegration(router)],
      sendDefaultPii: true,
      tracesSampleRate: 1,
    });
  }

  return router;
}
