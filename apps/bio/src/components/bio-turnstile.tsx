"use client";

import { useEffect, useRef } from "react";

const TURNSTILE_SCRIPT_ID = "soundkit-bio-turnstile",
  TURNSTILE_SCRIPT_SRC =
    "https://challenges.cloudflare.com/turnstile/v0/api.js",
  isBioTurnstileConfigured = Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY);

export { isBioTurnstileConfigured };

type TurnstileWidgetId = string | number;

interface TurnstileApi {
  render: (
    element: HTMLElement,
    options: {
      action: string;
      callback: (token: string) => void;
      "error-callback": () => void;
      "expired-callback": () => void;
      sitekey: string;
    }
  ) => TurnstileWidgetId;
  reset: (widgetId?: TurnstileWidgetId) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function BioTurnstile({
  onTokenChange,
  resetKey = 0,
}: {
  onTokenChange: (token: string) => void;
  resetKey?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null),
    siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY,
    widgetIdRef = useRef<TurnstileWidgetId | null>(null);

  useEffect(() => {
    if (!siteKey) {
      onTokenChange("");
      return;
    }

    let cancelled = false;
    const existingScript = document.querySelector(`#${TURNSTILE_SCRIPT_ID}`),
      renderWidget = () => {
        if (cancelled || !window.turnstile || !containerRef.current) {
          return;
        }

        containerRef.current.replaceChildren();
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          action: "signup",
          callback: onTokenChange,
          "error-callback": () => onTokenChange(""),
          "expired-callback": () => onTokenChange(""),
          sitekey: siteKey,
        });
      };

    if (window.turnstile) {
      renderWidget();
    } else if (existingScript) {
      existingScript.addEventListener("load", renderWidget);
    } else {
      const script = document.createElement("script");
      script.async = true;
      script.defer = true;
      script.id = TURNSTILE_SCRIPT_ID;
      script.src = TURNSTILE_SCRIPT_SRC;
      script.addEventListener("load", renderWidget);
      document.head.append(script);
    }

    return () => {
      cancelled = true;
      existingScript?.removeEventListener("load", renderWidget);
      if (widgetIdRef.current !== null && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current);
      }
      widgetIdRef.current = null;
      onTokenChange("");
    };
  }, [onTokenChange, siteKey]);

  useEffect(() => {
    if (resetKey === 0 || widgetIdRef.current === null || !window.turnstile) {
      return;
    }

    window.turnstile.reset(widgetIdRef.current);
    onTokenChange("");
  }, [onTokenChange, resetKey]);

  if (!siteKey) {
    return null;
  }

  return (
    <div
      aria-label="Security verification"
      className="min-h-16"
      ref={containerRef}
    />
  );
}
