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
 * a hidden WebView and collects the single-use token via postMessage. */
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
    if (!isTurnstileConfigured) {
      postToNative({
        available: false,
        source: "soundkit-turnstile",
        token: "",
      });
    }
  }, []);

  return (
    <main className="flex min-h-svh items-center justify-center bg-background">
      {isTurnstileConfigured ? (
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
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
          <p className="text-xs">SoundKit security check</p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Security verification is not configured for this deployment.
        </p>
      )}
    </main>
  );
}
