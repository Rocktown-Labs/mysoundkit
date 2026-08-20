import { env } from "@soundkit/env/web";
import { useEffect, useRef } from "react";

const TURNSTILE_SCRIPT_ID = "soundkit-cloudflare-turnstile",
 TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js";

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

export const isTurnstileConfigured = Boolean(env.VITE_TURNSTILE_SITE_KEY);

export function TurnstileWidget({
  action,
  onTokenChange,
  resetKey = 0,
}: {
  action: "forgot_password" | "login" | "signup";
  onTokenChange: (token: string) => void;
  resetKey?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null),
    widgetIdRef = useRef<TurnstileWidgetId | null>(null),
    siteKey = env.VITE_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey) {
      onTokenChange("");
      return;
    }

    let cancelled = false;
    const renderWidget = () => {
      if (cancelled || !window.turnstile || !containerRef.current) {
        return;
      }

      containerRef.current.replaceChildren();
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        action,
        callback: onTokenChange,
        "error-callback": () => onTokenChange(""),
        "expired-callback": () => onTokenChange(""),
        sitekey: siteKey,
      });
    },

     existingScript = document.querySelector(`#${TURNSTILE_SCRIPT_ID}`);
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
      if (widgetIdRef.current !== null && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current);
      }
      widgetIdRef.current = null;
      onTokenChange("");
    };
  }, [action, onTokenChange, resetKey, siteKey]);

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
