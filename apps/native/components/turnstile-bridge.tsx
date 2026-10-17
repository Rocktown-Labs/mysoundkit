/* oxlint-disable one-var, sort-vars, sort-keys */
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

const BRIDGE_CLEANUP_SCRIPT = `
(function() {
  try {
    var style = document.createElement('style');
    style.innerHTML = 'html, body, main { min-height: 0 !important; height: 68px !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; background: transparent !important; } main p { display: none !important; } main > div { gap: 0 !important; }';
    document.head.appendChild(style);
    var widget = document.querySelector('[aria-label="Security verification"]');
    if (widget && window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        available: true,
        source: 'soundkit-turnstile',
        token: ''
      }));
    }
  } catch (e) {}
})();
true;
`;

/**
 * Hosts the website's /auth/turnstile-bridge page in a visible WebView so the
 * Cloudflare challenge runs on an approved hostname (siteverify checks the
 * `hostname` claim against TURNSTILE_HOSTNAMES) and the user can see and
 * interact with the Turnstile checkbox when Managed mode prompts them.
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
    hasTokenRef = useRef(false),
    [ready, setReady] = useState(false),
    [hidden, setHidden] = useState(false);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const handleMessage = useCallback((raw: string) => {
    try {
      const parsed = JSON.parse(raw) as TurnstileBridgeMessage;
      if (parsed.source !== "soundkit-turnstile") {
        return;
      }
      if (!parsed.available) {
        setHidden(true);
        onMessageRef.current(parsed);
        return;
      }
      setHidden(false);
      // Do not overwrite an already-solved token with the initial mount probe
      if (parsed.token.length === 0 && hasTokenRef.current) {
        return;
      }
      hasTokenRef.current = parsed.token.length > 0;
      onMessageRef.current(parsed);
    } catch {
      // Ignore non-bridge messages from the page.
    }
  }, []);

  // Re-solve after a failed attempt: reload the bridge fresh.
  useEffect(() => {
    if (resetKey > 0) {
      hasTokenRef.current = false;
      webviewRef.current?.reload();
    }
  }, [resetKey]);

  if (hidden) {
    return null;
  }

  return (
    <View style={styles.bridgeWrap}>
      <WebView
        bounces={false}
        domStorageEnabled
        injectedJavaScript={BRIDGE_CLEANUP_SCRIPT}
        javaScriptEnabled
        onLoadEnd={() => {
          setReady(true);
          webviewRef.current?.injectJavaScript(BRIDGE_CLEANUP_SCRIPT);
        }}
        onMessage={(event) => {
          handleMessage(event.nativeEvent.data);
        }}
        onShouldStartLoadWithRequest={() => true}
        originWhitelist={["*"]}
        ref={webviewRef}
        scrollEnabled={false}
        setSupportMultipleWindows={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        source={{
          uri: `${WEB_PUBLIC_URL}/auth/turnstile-bridge?action=${action}`,
        }}
        style={styles.webview}
      />
      {ready ? null : (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={NAV_THEME.dark.primary} size="small" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bridgeWrap: {
    alignItems: "center",
    borderRadius: 10,
    height: 68,
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
    width: "100%",
  },
  loadingOverlay: {
    alignItems: "center",
    backgroundColor: "#050507",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  webview: {
    backgroundColor: "transparent",
    flex: 1,
    width: 300,
  },
});
