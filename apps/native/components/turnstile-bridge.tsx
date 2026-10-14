/* oxlint-disable one-var, sort-vars */
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

import { WEB_PUBLIC_URL } from "@/lib/api";
import { NAV_THEME } from "@/lib/constants";

export type TurnstileAction = "forgot_password" | "login" | "signup";

export interface TurnstileBridgeMessage {
  /** False when the website deployment has no Turnstile sitekey (dev). */
  available: boolean;
  source: "soundkit-turnstile";
  /** Single-use token; empty string when expired or not yet solved. */
  token: string;
}

/**
 * Hosts the website's /auth/turnstile-bridge page in a WebView so the
 * Cloudflare challenge runs on an approved hostname (siteverify checks the
 * `hostname` claim against TURNSTILE_HOSTNAMES, and a local HTML blob would
 * fail it). The solved token flows back via postMessage and is sent to the
 * API as the X-Turnstile-Token header, exactly like the web forms.
 */
export function TurnstileBridge({
  action,
  onMessage,
  resetKey = 0,
}: {
  action: TurnstileAction;
  onMessage: (message: TurnstileBridgeMessage) => void;
  resetKey?: number;
}) {
  const webviewRef = useRef<WebView>(null),
    onMessageRef = useRef(onMessage),
    [ready, setReady] = useState(false);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const handleMessage = useCallback((raw: string) => {
    try {
      const parsed = JSON.parse(raw) as TurnstileBridgeMessage;
      if (parsed.source === "soundkit-turnstile") {
        onMessageRef.current(parsed);
      }
    } catch {
      // Ignore non-bridge messages from the page.
    }
  }, []);

  // Re-solve after a failed attempt: reload the bridge fresh.
  useEffect(() => {
    if (resetKey > 0) {
      webviewRef.current?.reload();
    }
  }, [resetKey]);

  return (
    <View style={styles.bridgeWrap}>
      <WebView
        javaScriptEnabled
        onMessage={(event) => {
          handleMessage(event.nativeEvent.data);
        }}
        onLoadEnd={() => {
          setReady(true);
        }}
        originWhitelist={[WEB_PUBLIC_URL]}
        ref={webviewRef}
        source={{
          uri: `${WEB_PUBLIC_URL}/auth/turnstile-bridge?action=${action}`,
        }}
        style={styles.webview}
      />
      {ready ? null : (
        <ActivityIndicator
          color={NAV_THEME.dark.primary}
          style={styles.loading}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bridgeWrap: {
    backgroundColor: NAV_THEME.dark.card,
    borderColor: NAV_THEME.dark.border,
    borderRadius: 12,
    borderWidth: 1,
    height: 64,
    overflow: "hidden",
  },
  loading: {
    alignSelf: "center",
    marginTop: -46,
  },
  webview: { backgroundColor: "transparent" },
});
