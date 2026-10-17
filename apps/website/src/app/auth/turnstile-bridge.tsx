/* eslint-disable one-var, sort-vars, react/todo */

import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

import {
  TurnstileWidget,
  isTurnstileConfigured,
} from "@/components/auth/turnstile-widget";

export const Route = createFileRoute("/auth/turnstile-bridge")({
  component: TurnstileBridgePage,
  validateSearch: (
    search: Record<string, unknown>
  ): { action: "forgot_password" | "login" | "signup" } => ({
    action:
      search.action === "signup" || search.action === "forgot_password"
        ? search.action
        : "login",
  }),
});

interface NativeBridgeMessage {
  available: boolean;
  source: "soundkit-turnstile";
  token: string;
}

/** Hosted on an approved hostname so the widget's siteverify `hostname`
 * matches the server's TURNSTILE_HOSTNAMES. The native app loads this page in
 * a WebView and collects the single-use token via postMessage. */
function postToNative(message: NativeBridgeMessage) {
  try {
    const payload = JSON.stringify(message);
    // React Native WebView
    (
      window as unknown as {
        ReactNativeWebView?: { postMessage: (data: string) => void };
      }
    ).ReactNativeWebView?.postMessage(payload);
  } catch {
    // Never fatal — the bridge page may be opened in a plain browser.
  }
}

function TurnstileBridgePage() {
  const { action } = Route.useSearch();

  useEffect(() => {
    postToNative({
      available: isTurnstileConfigured,
      source: "soundkit-turnstile",
      token: "",
    });
  }, []);

  return (
    <main className="flex h-[68px] items-center justify-center overflow-hidden bg-transparent m-0 p-0">
      {isTurnstileConfigured ? (
        <TurnstileWidget
          action={action}
          onTokenChange={(token) => {
            postToNative({
              available: true,
              source: "soundkit-turnstile",
              token,
            });
          }}
        />
      ) : null}
    </main>
  );
}
