"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { lazy, Suspense, useMemo, useSyncExternalStore } from "react";

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

const AppDevtools =
  import.meta.env.DEV && import.meta.env.VITE_DISABLE_DEVTOOLS !== "true"
    ? lazy(async () => {
        const { AppDevtools: DevtoolsComponent } =
          await import("@/components/app-devtools");

        return {
          default: DevtoolsComponent,
        };
      })
    : null;

function createScopedQueryClient(_scopeKey: string) {
  return new QueryClient();
}

function unsubscribeFromClientMount() {
  return null;
}

function subscribeToClientMount() {
  return unsubscribeFromClientMount;
}

function ClientDevtools() {
  const hasMounted = useSyncExternalStore(
    subscribeToClientMount,
    () => true,
    () => false
  );

  if (!(hasMounted && AppDevtools)) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <AppDevtools />
    </Suspense>
  );
}

export function AppProviders({ children }: Readonly<{ children: ReactNode }>) {
  const { data: session } = authClient.useSession(),
    clientScopeKey = session?.user.id ?? "anonymous",
    queryClient = useMemo(
      () => createScopedQueryClient(clientScopeKey),
      [clientScopeKey]
    );

  return (
    <QueryClientProvider client={queryClient}>
      <DataDbProvider
        key={clientScopeKey}
        queryClient={queryClient}
        scopeKey={clientScopeKey}
      >
        <MessagingDbProvider
          key={clientScopeKey}
          queryClient={queryClient}
          scopeKey={clientScopeKey}
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
            {AppDevtools ? <ClientDevtools /> : null}
          </ThemeProvider>
        </MessagingDbProvider>
      </DataDbProvider>
    </QueryClientProvider>
  );
}
