"use client";
import { captureAnalytics } from "@soundkit/analytics/browser";
import type posthogJs from "posthog-js";

type PostHogClient = typeof posthogJs;
type QueuedOperation =
  | { kind: "capture"; event: string; properties?: Record<string, unknown> }
  | { kind: "captureException"; error: Error }
  | {
      kind: "identify";
      distinctId: string;
      properties?: Record<string, unknown>;
    };

const MAX_QUEUED_OPERATIONS = 100,
  queue: QueuedOperation[] = [],
  token = import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN;
let client: PostHogClient | null = null,
  loadScheduled = false;

function applyOperation(
  loaded: PostHogClient,
  operation: QueuedOperation
): void {
  if (operation.kind === "capture") {
    loaded.capture(operation.event, operation.properties);
  } else if (operation.kind === "captureException") {
    loaded.captureException(operation.error);
  } else {
    loaded.identify(operation.distinctId, operation.properties);
  }
}

function enqueue(operation: QueuedOperation): void {
  if (!token) {
    return;
  }
  queue.push(operation);
  if (queue.length > MAX_QUEUED_OPERATIONS) {
    queue.shift();
  }
}

async function loadClient(): Promise<void> {
  try {
    const { default: posthog } = await import("posthog-js");
    posthog.init(token, {
      api_host: "/ingest",
      autocapture: false,
      capture_exceptions: true,
      capture_pageview: false,
      defaults: "2025-05-24",
      disable_persistence: true,
      disable_session_recording: true,
      persistence: "memory",
      ui_host:
        import.meta.env.VITE_PUBLIC_POSTHOG_HOST || "https://us.posthog.com",
    });
    client = posthog;
    for (const operation of queue.splice(0)) {
      applyOperation(posthog, operation);
    }
  } catch {
    // A blocked optional SDK must not create an unhandled network rejection.
    loadScheduled = false;
  }
}

function scheduleClientLoad(): void {
  void loadClient();
}

/** The optional diagnostic SDK loads after paint and uses memory persistence. */
export function loadAnalytics(): void {
  if (loadScheduled || !token || typeof window === "undefined") {
    return;
  }
  loadScheduled = true;
  if (window.requestIdleCallback) {
    window.requestIdleCallback(scheduleClientLoad);
  } else {
    window.setTimeout(scheduleClientLoad, 1500);
  }
}

export function capture(
  event: string,
  properties?: Record<string, unknown>,
  value?: number
): void {
  if (client) {
    try {
      client.capture(event, properties);
    } catch {
      /* Diagnostics are optional. */
    }
  } else {
    enqueue({ event, kind: "capture", properties });
  }
  captureAnalytics(
    event,
    properties,
    value ??
      (typeof properties?.value === "number" ? properties.value : undefined)
  );
}

export function captureAnalyticsException(error: unknown): void {
  const normalized = error instanceof Error ? error : new Error(String(error));
  if (client) {
    try {
      client.captureException(normalized);
    } catch {
      /* Diagnostics are optional. */
    }
  } else {
    enqueue({ error: normalized, kind: "captureException" });
  }
}

export function identify(
  distinctId: string,
  properties?: Record<string, unknown>
): void {
  if (client) {
    try {
      client.identify(distinctId, properties);
    } catch {
      /* Diagnostics are optional. */
    }
  } else {
    enqueue({ distinctId, kind: "identify", properties });
  }
}
