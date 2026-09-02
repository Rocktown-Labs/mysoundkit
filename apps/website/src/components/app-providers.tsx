"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { lazy, Suspense, useMemo } from "react";

import { AudioPlayerProvider } from "@/components/audio-player-provider";
import { CartProvider } from "@/components/cart-provider";
import { FloatingChatBar } from "@/components/dashboard/floating-chat-bar";
import { MusicPlayer } from "@/components/explore/music-player";
import { KeyboardShortcutsProvider } from "@/components/keyboard-shortcuts-provider";
import { BattleQueueCta } from "@/components/live/battle-queue-cta";
import { BattleReturnMonitor } from "@/components/live/battle-return-monitor";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { authClient } from "@/lib/auth-client";
import { DataDbProvider } from "@/lib/data-db";
import { MessagingDbProvider } from "@/lib/message-db";
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
  const { data: session } = authClient.useSession(),
    scopeKey = session?.user.id ?? "anonymous",
    queryClient = useMemo(() => new QueryClient(), [scopeKey]);

  return (
    <QueryClientProvider client={queryClient}>
      <DataDbProvider
        key={scopeKey}
        queryClient={queryClient}
        scopeKey={scopeKey}
      >
        <MessagingDbProvider
          key={scopeKey}
          queryClient={queryClient}
          scopeKey={scopeKey}
        >
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
                  <BattleQueueCta />
                  <BattleReturnMonitor />
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
        </MessagingDbProvider>
      </DataDbProvider>
    </QueryClientProvider>
  );
}
