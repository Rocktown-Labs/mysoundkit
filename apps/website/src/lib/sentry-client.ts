"use client";
import type SentryModule from "@sentry/tanstackstart-react";

import type { getRouter } from "@/router";

/**
 * Lazy Sentry client. The browser SDK is ~110KB raw and is only needed for
 * error reporting + tracing, neither of which belongs on the critical path —
 * so instead of statically importing @sentry/tanstackstart-react into the
 * entry chunk, the SDK loads on idle after first paint. Errors reported
 * before it finishes loading are queued (bounded) and flushed once the SDK
 * initializes.
 */

type Sentry = typeof SentryModule;
type AppRouter = Awaited<ReturnType<typeof getRouter>>;

const MAX_QUEUED_ERRORS = 20;

let client: Sentry | null = null,
  loadScheduled = false;
const errorQueue: unknown[] = [],
  flushQueue = (sentry: Sentry) => {
    for (const error of errorQueue.splice(0)) {
      sentry.captureException(error);
    }
  };

/**
 * Schedules the SDK import on idle. Safe to call from every boot path —
 * only the first call schedules a load, and pages without a configured DSN
 * initialize nothing.
 */
export const loadSentry = (router: AppRouter) => {
  if (loadScheduled || typeof window === "undefined") {
    return;
  }
  loadScheduled = true;

  const idle =
      window.requestIdleCallback ??
      ((callback: () => void) => window.setTimeout(callback, 1500)),
    load = () => {
      void import("@sentry/tanstackstart-react").then((sentry) => {
        const dsn = import.meta.env.VITE_SENTRY_DSN;
        if (dsn) {
          sentry.init({
            dsn,
            enableLogs: true,
            environment: import.meta.env.VITE_SENTRY_ENVIRONMENT,
            integrations: [
              sentry.tanstackRouterBrowserTracingIntegration(router),
            ],
            sendDefaultPii: true,
            tracesSampleRate: 1,
          });
        }
        client = sentry;
        flushQueue(sentry);
      });
    };

  idle(load);
};

export const reportError = (error: unknown) => {
  if (typeof window === "undefined") {
    return;
  }
  if (client) {
    client.captureException(error);
    return;
  }
  errorQueue.push(error);
  if (errorQueue.length > MAX_QUEUED_ERRORS) {
    errorQueue.shift();
  }
};
