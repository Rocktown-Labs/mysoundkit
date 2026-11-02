/* eslint-disable one-var, sort-vars */
import {
  analyticsRoute,
  analyticsSites,
  isAnalyticsEvent,
  sanitizeAnalyticsProperties,
  analyticsValue,
} from "./contracts";
import type { AnalyticsSurface } from "./contracts";

export const traksCollectorUrl =
  "https://traks-collect.rocktown-labs.workers.dev/api/event";

interface TrackerPayload {
  t: "pageview" | "event" | "engagement";
  s: string;
  p: string;
  h: string;
  sid: string;
  en?: string;
  ep?: string;
  ev?: number;
  r?: string;
}

export function createTraksClient({
  surface,
  hostname,
  transport = globalThis.fetch,
  getPathname,
  now = () => performance.now(),
}: {
  surface: AnalyticsSurface;
  hostname: string;
  transport?: typeof fetch;
  getPathname?: () => string;
  now?: () => number;
}) {
  const site = analyticsSites[surface],
    enabled = hostname === site.domain || hostname === `www.${site.domain}`,
    identifier = enabled ? globalThis.crypto?.randomUUID?.() : undefined;
  let path = "/",
    previousPathname: string | null = null,
    visibleSince: number | null = null,
    previousMediaType: "audio" | "video" | null = null;

  const send = async (event: Omit<TrackerPayload, "s" | "h" | "sid" | "p">) => {
      if (!enabled || !identifier) {
        return;
      }
      const payload: TrackerPayload = {
        ...event,
        h: site.domain,
        p: path,
        s: site.key,
        sid: identifier,
      };
      try {
        // No referrer, cookies, credentials, raw URL or browser-persisted ID.
        await transport(traksCollectorUrl, {
          body: JSON.stringify(payload),
          credentials: "omit",
          headers: { "Content-Type": "text/plain" },
          keepalive: true,
          method: "POST",
          referrerPolicy: "no-referrer",
        });
      } catch {
        // Optional measurement must never interrupt playback or a purchase.
      }
    },
    flushEngagement = () => {
      if (visibleSince === null) {
        return;
      }
      const seconds = Math.floor((now() - visibleSince) / 1000);
      if (previousPathname !== null && seconds > 0 && seconds <= 14_400) {
        send({ ev: seconds, t: "engagement" });
      }
      visibleSince = now();
    },
    pageview = (pathname: string) => {
      if (pathname === previousPathname) {
        return;
      }
      flushEngagement();
      path = analyticsRoute(pathname, surface);
      previousPathname = pathname;
      void send({ r: "", t: "pageview" });
    };
  return {
    capture(
      event: string,
      properties?: Record<string, unknown>,
      value?: number
    ) {
      if (!isAnalyticsEvent(event)) {
        return;
      }
      if (getPathname) {
        pageview(getPathname());
      }
      if (event === "track_play_started" || event === "video_play_started") {
        const mediaType = event === "track_play_started" ? "audio" : "video";
        if (previousMediaType && previousMediaType !== mediaType) {
          void send({
            en: "media_transition_completed",
            ep: JSON.stringify({ media_type: mediaType, surface }),
            t: "event",
          });
        }
        previousMediaType = mediaType;
      }
      void send({
        en: event,
        ep: JSON.stringify({
          ...sanitizeAnalyticsProperties(event, properties),
          surface,
        }),
        ev: analyticsValue(event, value),
        t: "event",
      });
    },
    pageview,
    setVisible(visible: boolean) {
      if (visible && visibleSince === null) {
        visibleSince = now();
      } else if (!visible) {
        flushEngagement();
        visibleSince = null;
      }
    },
  };
}

export type TraksClient = ReturnType<typeof createTraksClient>;

declare global {
  interface Window {
    traks?: ((
      name: string,
      props?: Record<string, unknown>,
      value?: number
    ) => void) & { q?: unknown[][] };
  }
}

export function captureAnalytics(
  event: string,
  properties?: Record<string, unknown>,
  value?: number
): void {
  if (!isAnalyticsEvent(event) || typeof window === "undefined") {
    return;
  }
  try {
    window.traks?.(
      event,
      sanitizeAnalyticsProperties(event, properties),
      analyticsValue(event, value)
    );
  } catch {
    // A tracker supplied by an extension or blocked by the browser is optional.
  }
}

// These instances exist only in the browser, never in an SSR request scope.
const browserClients = new WeakMap<
  Window,
  Map<AnalyticsSurface, TraksClient>
>();
export function getBrowserTraksClient(surface: AnalyticsSurface): TraksClient {
  if (typeof window === "undefined") {
    return createTraksClient({ hostname: "", surface });
  }
  let clients = browserClients.get(window);
  if (!clients) {
    clients = new Map();
    browserClients.set(window, clients);
  }
  let client = clients.get(surface);
  if (!client) {
    client = createTraksClient({
      getPathname: () => window.location.pathname,
      hostname: window.location.hostname,
      surface,
    });
    clients.set(surface, client);
  }
  return client;
}
