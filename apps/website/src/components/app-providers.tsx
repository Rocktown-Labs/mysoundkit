"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { lazy, Suspense, useState } from "react";

import { AudioPlayerProvider } from "@/components/audio-player-provider";
import { CartProvider } from "@/components/cart-provider";
import { FloatingChatBar } from "@/components/dashboard/floating-chat-bar";
import { MusicPlayer } from "@/components/explore/music-player";
import { KeyboardShortcutsProvider } from "@/components/keyboard-shortcuts-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { PresenceProvider } from "@/lib/presence-context";

const AppDevtools = import.meta.env.DEV
  ? lazy(async () => {
      const { AppDevtools: DevtoolsComponent } =
        await import("@/components/app-devtools");

      return {
        default: DevtoolsComponent,
      };
    })
  : null;

export function AppProviders({ children }: Readonly<{ children: ReactNode }>) {
  const [queryClient, setQueryClient] = useState(() => new QueryClient());
  void setQueryClient;

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableColorScheme={false}
        enableSystem={false}
      >
        <KeyboardShortcutsProvider>
          <PresenceProvider>
            <AudioPlayerProvider>
              <CartProvider>{children}</CartProvider>
              <MusicPlayer />
              <FloatingChatBar />
            </AudioPlayerProvider>
          </PresenceProvider>
        </KeyboardShortcutsProvider>
        <Toaster />
        {AppDevtools ? (
          <Suspense fallback={null}>
            <AppDevtools />
          </Suspense>
        ) : null}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
