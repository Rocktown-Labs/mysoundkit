import * as Sentry from "@sentry/tanstackstart-react";
import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

const sentryDsn = process.env.SENTRY_DSN ?? process.env.VITE_SENTRY_DSN;
let isSentryInitialized = false;

function initSentry() {
  if (!(sentryDsn && !isSentryInitialized)) {
    return;
  }

  Sentry.init({
    dsn: sentryDsn,
    enableLogs: true,
    sendDefaultPii: true,
    tracesSampleRate: 1,
  });

  isSentryInitialized = true;
}

export default createServerEntry(
  Sentry.wrapFetchWithSentry({
    fetch(request: Request) {
      initSentry();
      return handler.fetch(request);
    },
  })
);
