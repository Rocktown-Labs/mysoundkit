/* oxlint-disable one-var, unicorn/no-useless-undefined */
import "@/polyfills";
import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import type { Theme } from "@react-navigation/native";
import {
  useQueryClient,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { CartModal } from "@/components/cart/cart-modal";
import { NowPlayingModal } from "@/components/now-playing-modal";
import { AudioPlayerProvider } from "@/contexts/audio-player-context";
import { CartProvider } from "@/contexts/cart-context";
import { GuestModeProvider } from "@/contexts/guest-mode-context";
import { authClient } from "@/lib/auth-client";
import { NAV_THEME } from "@/lib/constants";

export const unstable_settings = {
  initialRouteName: "(auth)",
};

const DARK_THEME: Theme = {
    ...DarkTheme,
    colors: NAV_THEME.dark,
  },
  queryClient = new QueryClient(),
  styles = StyleSheet.create({
    container: {
      flex: 1,
    },
  });

/**
 * Clears the React Query cache whenever the signed-in identity changes so
 * authenticated queries (/v1/me, dashboard, library) refetch with the new
 * session cookie instead of showing the previous identity's cached data.
 */
function AuthQuerySync() {
  const client = useQueryClient(),
    { data: session } = authClient.useSession(),
    lastUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const userId = session?.user?.id ?? null;
    if (lastUserIdRef.current === undefined) {
      // First run: record the identity without clearing a fresh cache.
      lastUserIdRef.current = userId;
      return;
    }
    if (lastUserIdRef.current !== userId) {
      lastUserIdRef.current = userId;
      void client.clear();
    }
  }, [client, session?.user?.id]);

  return null;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthQuerySync />
      <GuestModeProvider>
        <AudioPlayerProvider>
          <CartProvider>
            <ThemeProvider value={DARK_THEME}>
              {/* oxlint-disable-next-line react/style-prop-object */}
              <StatusBar style="light" />
              <GestureHandlerRootView style={styles.container}>
                <Stack>
                  <Stack.Screen
                    name="(auth)"
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name="(drawer)"
                    options={{ headerShown: false }}
                  />
                </Stack>
                <NowPlayingModal />
                <CartModal />
              </GestureHandlerRootView>
            </ThemeProvider>
          </CartProvider>
        </AudioPlayerProvider>
      </GuestModeProvider>
    </QueryClientProvider>
  );
}
