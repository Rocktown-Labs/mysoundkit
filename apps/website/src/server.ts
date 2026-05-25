import * as Sentry from "@sentry/tanstackstart-react";
import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

const sentryDsn = process.env.SENTRY_DSN ?? process.env.VITE_SENTRY_DSN;

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    enableLogs: true,
    sendDefaultPii: true,
    tracesSampleRate: 1,
  });
}

export default createServerEntry(
  Sentry.wrapFetchWithSentry({
    fetch(request: Request) {
      return handler.fetch(request);
    },
  })
);
