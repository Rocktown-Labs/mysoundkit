/* oxlint-disable one-var */
import "@/polyfills";
import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import type { Theme } from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { NowPlayingModal } from "@/components/now-playing-modal";
import { AudioPlayerProvider } from "@/contexts/audio-player-context";
import { NAV_THEME } from "@/lib/constants";

export const unstable_settings = {
  initialRouteName: "(drawer)",
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

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AudioPlayerProvider>
        <ThemeProvider value={DARK_THEME}>
          {/* oxlint-disable-next-line react/style-prop-object */}
          <StatusBar style="light" />
          <GestureHandlerRootView style={styles.container}>
            <Stack>
              <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
            </Stack>
            <NowPlayingModal />
          </GestureHandlerRootView>
        </ThemeProvider>
      </AudioPlayerProvider>
    </QueryClientProvider>
  );
}
