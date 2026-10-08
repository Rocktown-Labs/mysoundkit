"use client";
import type posthogJs from "posthog-js";

/**
 * Lazy PostHog client. posthog-js is ~210KB raw and the app only uses
 * `capture`, `captureException`, and `identify` — none of which belong on the
 * critical path — so the SDK loads on idle after first paint instead of being
 * statically imported into the entry chunk. Events fired before it finishes
 * loading are queued (bounded) and replayed in order.
 */

type PostHogClient = typeof posthogJs;

const MAX_QUEUED_OPERATIONS = 100,
  token = import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN;

type QueuedOperation =
  | { kind: "capture"; event: string; properties?: Record<string, unknown> }
  | { kind: "captureException"; error: Error }
  | {
      kind: "identify";
      distinctId: string;
      properties?: Record<string, unknown>;
    };

let client: PostHogClient | null = null,
  loadScheduled = false;
const queue: QueuedOperation[] = [],
  replayQueue = (loadedClient: PostHogClient) => {
    for (const operation of queue.splice(0)) {
      applyOperation(loadedClient, operation);
    }
  },
  applyOperation = (
    loadedClient: PostHogClient,
    operation: QueuedOperation
  ) => {
    switch (operation.kind) {
      case "capture": {
        loadedClient.capture(operation.event, operation.properties);
        return;
      }
      case "captureException": {
        loadedClient.captureException(operation.error);
        return;
      }
      case "identify": {
        loadedClient.identify(operation.distinctId, operation.properties);
        return;
      }
    }
  },
  enqueueOperation = (operation: QueuedOperation) => {
    queue.push(operation);
    if (queue.length > MAX_QUEUED_OPERATIONS) {
      queue.shift();
    }
  };

/**
 * Schedules the SDK import on idle. Safe to call from every boot path —
 * only the first call schedules a load, and pages without a configured
 * project token never load anything.
 */
export const loadAnalytics = () => {
  if (loadScheduled || !token || typeof window === "undefined") {
    return;
  }
  loadScheduled = true;

  const idle =
    window.requestIdleCallback ??
    ((callback: () => void) => window.setTimeout(callback, 1500));
  idle(() => {
    void import("posthog-js").then(({ default: posthog }) => {
      posthog.init(token, {
        api_host: "/ingest",
        capture_exceptions: true,
        defaults: "2025-05-24",
        ui_host:
          import.meta.env.VITE_PUBLIC_POSTHOG_HOST || "https://us.posthog.com",
      });
      client = posthog;
      replayQueue(posthog);
    });
  });
};

export const capture = (
  event: string,
  properties?: Record<string, unknown>
) => {
  if (client) {
    client.capture(event, properties);
    return;
  }
  enqueueOperation({ event, kind: "capture", properties });
};

export const captureAnalyticsException = (error: unknown) => {
  const normalized = error instanceof Error ? error : new Error(String(error));
  if (client) {
    client.captureException(normalized);
    return;
  }
  enqueueOperation({ error: normalized, kind: "captureException" });
};

export const identify = (
  distinctId: string,
  properties?: Record<string, unknown>
) => {
  if (client) {
    client.identify(distinctId, properties);
    return;
  }
  enqueueOperation({ distinctId, kind: "identify", properties });
};
