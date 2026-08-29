/* eslint-disable one-var, sort-vars, unicorn/no-useless-undefined, unicorn/require-post-message-target-origin, require-unicode-regexp, unicorn/prefer-add-event-listener */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

import { API_V1_URL } from "./api";
import { useMeQuery } from "./soundkit-api-hooks";

const ACTIVE_PRESENCE_INTERVAL_MS = 60_000,
  PRESENCE_ACTIVE_THRESHOLD_MS = 90_000,
  LEASE_DURATION_MS = 25_000,
  LEASE_RENEWAL_INTERVAL_MS = 10_000,
  PRESENCE_CHANNEL_NAME = "soundkit-presence",
  PRESENCE_LEASE_KEY = "soundkit-presence-leader";

interface UserPresenceInfo {
  isOnline: boolean;
  lastSeen: number;
  status: string;
}

interface PresenceContextValue {
  getUserPresence: (userId?: string | null) => UserPresenceInfo | undefined;
  isUserOnline: (userId?: string | null) => boolean;
  onlineCount: number;
  onlineUserIds: string[];
  registerPresenceUsers: (userIds: string[]) => () => void;
}

interface PresenceBroadcast {
  type: "presence";
  users: Record<string, UserPresenceInfo>;
}

const isFreshPresence = (presence: UserPresenceInfo) =>
    presence.isOnline &&
    presence.status !== "offline" &&
    Date.now() - presence.lastSeen < PRESENCE_ACTIVE_THRESHOLD_MS,
  noopCleanup = (): undefined => undefined,
  PresenceContext = createContext<PresenceContextValue>({
    getUserPresence: () => undefined,
    isUserOnline: () => false,
    onlineCount: 0,
    onlineUserIds: [],
    registerPresenceUsers: () => noopCleanup,
  }),
  isVisible = () =>
    typeof document === "undefined" || document.visibilityState === "visible",
  tabId = () => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
    return `tab-${Date.now()}-${performance.now()}`;
  };

export function PresenceProvider({ children }: { children: ReactNode }) {
  const meQuery = useMeQuery(),
    userId = meQuery.data?.user.id,
    [onlineUsers, setOnlineUsers] = useState<Record<string, UserPresenceInfo>>(
      {}
    ),
    [watchedUserIds, setWatchedUserIds] = useState<string[]>([]),
    watchedCountsRef = useRef(new Map<string, number>()),
    watchedUserIdsRef = useRef<string[]>([]),
    socketRef = useRef<WebSocket | null>(null),
    leaderRef = useRef(false),
    reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null),
    heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null),
    leaseIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null),
    reconnectAttemptRef = useRef(0),
    tabIdRef = useRef<string>(tabId());

  watchedUserIdsRef.current = watchedUserIds;

  const applyPresence = useCallback(
      (users: Record<string, UserPresenceInfo>) => {
        setOnlineUsers((current) => ({ ...current, ...users }));
      },
      []
    ),
    registerPresenceUsers = useCallback((ids: string[]) => {
      const normalizedIds = [...new Set(ids.filter(Boolean))];
      for (const id of normalizedIds) {
        watchedCountsRef.current.set(
          id,
          (watchedCountsRef.current.get(id) ?? 0) + 1
        );
      }
      setWatchedUserIds([...watchedCountsRef.current.keys()]);

      return () => {
        for (const id of normalizedIds) {
          const nextCount = (watchedCountsRef.current.get(id) ?? 1) - 1;
          if (nextCount > 0) {
            watchedCountsRef.current.set(id, nextCount);
          } else {
            watchedCountsRef.current.delete(id);
          }
        }
        setWatchedUserIds([...watchedCountsRef.current.keys()]);
      };
    }, []),
    fetchTargetedPresence = useCallback(async () => {
      const ids = watchedUserIdsRef.current;
      if (ids.length === 0) {
        return;
      }

      try {
        const response = await fetch(`${API_V1_URL}/presence/query`, {
          body: JSON.stringify({ userIds: ids.slice(0, 100) }),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as {
          users?: Record<string, UserPresenceInfo>;
        };
        if (data.users) {
          applyPresence(data.users);
        }
      } catch {
        // Presence reads are advisory; the next visible poll will retry.
      }
    }, [applyPresence]),
    sendHeartbeat = useCallback(async (status: "away" | "online") => {
      try {
        await fetch(`${API_V1_URL}/presence/heartbeat`, {
          body: JSON.stringify({ status }),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
      } catch {
        // The WebSocket reconnect loop handles recovery when available.
      }
    }, []);

  useEffect(() => {
    if (!userId || typeof window === "undefined") {
      setOnlineUsers({});
      return;
    }

    const leaseKey = `${PRESENCE_LEASE_KEY}:${userId}`,
      channel =
        typeof BroadcastChannel === "undefined"
          ? null
          : new BroadcastChannel(`${PRESENCE_CHANNEL_NAME}:${userId}`),
      releaseLease = () => {
        try {
          const lease = JSON.parse(
            window.localStorage.getItem(leaseKey) ?? "null"
          ) as { tabId?: string } | null;
          if (lease?.tabId === tabIdRef.current) {
            window.localStorage.removeItem(leaseKey);
          }
        } catch {
          // Storage can be unavailable in privacy-restricted browsers.
        }
        leaderRef.current = false;
      },
      broadcast = (users: Record<string, UserPresenceInfo>) => {
        const message: PresenceBroadcast = { type: "presence", users };
        channel?.postMessage(message);
      },
      claimLease = () => {
        try {
          const current = JSON.parse(
            window.localStorage.getItem(leaseKey) ?? "null"
          ) as { expiresAt?: number; tabId?: string } | null;
          if (
            current?.tabId &&
            current.tabId !== tabIdRef.current &&
            (current.expiresAt ?? 0) > Date.now()
          ) {
            leaderRef.current = false;
            return false;
          }
          window.localStorage.setItem(
            leaseKey,
            JSON.stringify({
              expiresAt: Date.now() + LEASE_DURATION_MS,
              tabId: tabIdRef.current,
            })
          );
          leaderRef.current = true;
          channel?.postMessage({ type: "leader" });
          return true;
        } catch {
          // If storage is blocked, this tab remains the best-effort leader.
          leaderRef.current = true;
          return true;
        }
      },
      closeSocket = () => {
        if (socketRef.current) {
          socketRef.current.close();
          socketRef.current = null;
        }
      },
      connectSocket = () => {
        if (
          !leaderRef.current ||
          !isVisible() ||
          socketRef.current ||
          reconnectTimerRef.current
        ) {
          return;
        }

        const url = new URL(
          `${API_V1_URL.replace(/^http/i, "ws")}/presence/ws`
        );
        url.searchParams.set("tabId", tabIdRef.current);

        try {
          const socket = new WebSocket(url);
          socketRef.current = socket;
          socket.onopen = () => {
            reconnectAttemptRef.current = 0;
            socket.send(
              JSON.stringify({ status: "online", type: "heartbeat" })
            );
            void fetchTargetedPresence();
          };
          socket.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data) as UserPresenceInfo & {
                type?: string;
                userId?: string;
              };
              if (data.type === "presence" && data.userId) {
                const users = { [data.userId]: data };
                applyPresence(users);
                broadcast(users);
              }
            } catch {
              // Ignore malformed advisory presence events.
            }
          };
          socket.onerror = () => {
            socket.close();
          };
          socket.onclose = () => {
            socketRef.current = null;
            if (!leaderRef.current || !isVisible()) {
              return;
            }
            const delay = Math.min(
              30_000,
              1000 * 2 ** reconnectAttemptRef.current
            );
            reconnectAttemptRef.current += 1;
            reconnectTimerRef.current = setTimeout(() => {
              reconnectTimerRef.current = null;
              connectSocket();
            }, delay);
          };
        } catch {
          socketRef.current = null;
        }
      },
      handleVisibility = () => {
        if (!isVisible()) {
          if (leaderRef.current) {
            void sendHeartbeat("away");
          }
          closeSocket();
          releaseLease();
          return;
        }

        if (claimLease()) {
          void sendHeartbeat("online");
          connectSocket();
          void fetchTargetedPresence();
        }
      },
      onChannelMessage = (event: MessageEvent<PresenceBroadcast>) => {
        if (event.data?.type === "presence" && event.data.users) {
          applyPresence(event.data.users);
        }
      };

    channel?.addEventListener("message", onChannelMessage);
    claimLease();
    if (leaderRef.current) {
      void sendHeartbeat("online");
      connectSocket();
      void fetchTargetedPresence();
    }

    heartbeatIntervalRef.current = setInterval(() => {
      if (!leaderRef.current || !isVisible()) {
        return;
      }
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: "heartbeat" }));
      } else {
        void sendHeartbeat("online");
        connectSocket();
      }
      // The Presence DO broadcasts a user's own status, not every watched
      // user's status. Poll the same authoritative endpoint for all watched
      // users so battle chat and direct messages share one freshness window.
      void fetchTargetedPresence();
    }, ACTIVE_PRESENCE_INTERVAL_MS);
    leaseIntervalRef.current = setInterval(() => {
      if (isVisible() && claimLease()) {
        connectSocket();
      }
    }, LEASE_RENEWAL_INTERVAL_MS);

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", releaseLease);
    window.addEventListener("pageshow", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", releaseLease);
      window.removeEventListener("pageshow", handleVisibility);
      channel?.removeEventListener("message", onChannelMessage);
      channel?.close();
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      if (leaseIntervalRef.current) {
        clearInterval(leaseIntervalRef.current);
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      closeSocket();
      releaseLease();
    };
  }, [applyPresence, fetchTargetedPresence, sendHeartbeat, userId]);

  useEffect(() => {
    if (userId && leaderRef.current && isVisible()) {
      void fetchTargetedPresence();
    }
  }, [fetchTargetedPresence, userId, watchedUserIds]);

  const isUserOnline = useCallback(
      (targetUserId?: string | null) => {
        if (!targetUserId) {
          return false;
        }
        if (userId && targetUserId === userId) {
          return true;
        }
        const presence = onlineUsers[targetUserId];
        return presence ? isFreshPresence(presence) : false;
      },
      [onlineUsers, userId]
    ),
    getUserPresence = useCallback(
      (targetUserId?: string | null) => {
        if (!targetUserId) {
          return;
        }
        if (userId && targetUserId === userId) {
          return { isOnline: true, lastSeen: Date.now(), status: "online" };
        }
        const presence = onlineUsers[targetUserId];
        return presence
          ? { ...presence, isOnline: isFreshPresence(presence) }
          : undefined;
      },
      [onlineUsers, userId]
    ),
    onlineUserIds = useMemo(
      () =>
        Object.entries(onlineUsers)
          .filter(([, presence]) => isFreshPresence(presence))
          .map(([id]) => id),
      [onlineUsers]
    ),
    value = useMemo(
      () => ({
        getUserPresence,
        isUserOnline,
        onlineCount: onlineUserIds.length,
        onlineUserIds,
        registerPresenceUsers,
      }),
      [getUserPresence, isUserOnline, onlineUserIds, registerPresenceUsers]
    );

  return (
    <PresenceContext.Provider value={value}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence() {
  return useContext(PresenceContext);
}
