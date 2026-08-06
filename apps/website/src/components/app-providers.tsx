"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { lazy, Suspense, useState } from "react";

import { AudioPlayerProvider } from "@/components/audio-player-provider";
import { CartProvider } from "@/components/cart-provider";
import { MusicPlayer } from "@/components/explore/music-player";
import { KeyboardShortcutsProvider } from "@/components/keyboard-shortcuts-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

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
          <AudioPlayerProvider>
            <CartProvider>{children}</CartProvider>
            <MusicPlayer />
          </AudioPlayerProvider>
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
