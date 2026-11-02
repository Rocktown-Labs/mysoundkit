/* eslint-disable one-var, sort-vars */
import { useEffect, useRef } from "react";

import { getBrowserTraksClient } from "./browser";
import type { TraksClient } from "./browser";
import { analyticsDestination } from "./contracts";
import type { AnalyticsSurface } from "./contracts";

export function useTraksAnalytics(
  surface: AnalyticsSurface,
  pathname: string
): void {
  const tracker = useRef<TraksClient | null>(null);

  useEffect(() => {
    const client = getBrowserTraksClient(surface),
      previousCapture = window.traks,
      { capture } = client,
      handleClick = (event: MouseEvent) => {
        const link =
          event.target instanceof Element
            ? event.target.closest("a[href]")
            : null;
        if (!(link instanceof HTMLAnchorElement)) {
          return;
        }
        let url: URL;
        try {
          url = new URL(link.href, window.location.origin);
        } catch {
          return;
        }
        if (!["http:", "https:"].includes(url.protocol)) {
          return;
        }
        if (link.hasAttribute("download")) {
          capture("file_downloaded", {
            destination: analyticsDestination(url),
          });
        } else if (url.hostname !== window.location.hostname) {
          capture("outbound_link_clicked", {
            destination: analyticsDestination(url),
          });
        }
      },
      flushEngagement = () => client.setVisible(false),
      handleVisibility = () =>
        client.setVisible(document.visibilityState === "visible");
    tracker.current = client;
    client.setVisible(document.visibilityState === "visible");
    client.pageview(window.location.pathname);
    window.traks = capture;
    for (const args of previousCapture?.q?.splice(0) ?? []) {
      const [event, properties, value] = args;
      if (typeof event === "string") {
        capture(
          event,
          properties && typeof properties === "object"
            ? (properties as Record<string, unknown>)
            : undefined,
          typeof value === "number" ? value : undefined
        );
      }
    }
    document.addEventListener("click", handleClick, true);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", flushEngagement);
    window.addEventListener("pageshow", handleVisibility);
    return () => {
      flushEngagement();
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", flushEngagement);
      window.removeEventListener("pageshow", handleVisibility);
      if (window.traks === capture) {
        window.traks = previousCapture;
      }
      tracker.current = null;
    };
  }, [surface]);

  useEffect(() => {
    // Router changes invalidate this effect; the browser URL is the single
    // encoded identity also used at mount and before child conversion events.
    if (pathname) {
      tracker.current?.pageview(window.location.pathname);
    }
  }, [pathname]);
}
