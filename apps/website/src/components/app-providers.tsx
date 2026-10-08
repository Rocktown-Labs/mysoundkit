"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

import { AudioPlayerProvider } from "@/components/audio-player-provider";
import { CartProvider } from "@/components/cart-provider";
import { KeyboardShortcutsProvider } from "@/components/keyboard-shortcuts-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { loadAnalytics } from "@/lib/analytics";
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
      : null,
  MusicPlayer = lazy(async () => {
    const { MusicPlayer: Player } =
      await import("@/components/explore/music-player");

    return { default: Player };
  }),
  FloatingChatBar = lazy(async () => {
    const { FloatingChatBar: ChatBar } =
      await import("@/components/dashboard/floating-chat-bar");

    return { default: ChatBar };
  }),
  BattleQueueCta = lazy(async () => {
    const { BattleQueueCta: QueueCta } =
      await import("@/components/live/battle-queue-cta");

    return { default: QueueCta };
  }),
  BattleReturnMonitor = lazy(async () => {
    const { BattleReturnMonitor: Monitor } =
      await import("@/components/live/battle-return-monitor");

    return { default: Monitor };
  });

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

  // Analytics loads on idle after first paint (see lib/analytics).
  useEffect(() => {
    loadAnalytics();
  }, []);

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
                  <Suspense fallback={null}>
                    <MusicPlayer />
                    <FloatingChatBar />
                    <BattleQueueCta />
                    <BattleReturnMonitor />
                  </Suspense>
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
