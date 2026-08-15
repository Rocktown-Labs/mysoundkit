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
}

const PresenceContext = createContext<PresenceContextValue>({
  getUserPresence: () => {},
  isUserOnline: () => false,
  onlineCount: 0,
  onlineUserIds: [],
});

export function PresenceProvider({ children }: { children: ReactNode }) {
  const meQuery = useMeQuery(),
    userId = meQuery.data?.user.id,
    [onlineUsers, setOnlineUsers] = useState<Record<string, UserPresenceInfo>>(
      {}
    ),
    socketRef = useRef<WebSocket | null>(null),
    heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null),

  // Poll HTTP presence fallback
   fetchHttpPresence = useCallback(async () => {
    try {
      const res = await fetch(`${API_V1_URL}/presence`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = (await res.json()) as {
          onlineUserIds?: string[];
          users?: Record<string, { lastSeen: number; status: string }>;
        };
        if (data.users) {
          const mapped: Record<string, UserPresenceInfo> = {};
          for (const [id, u] of Object.entries(data.users)) {
            mapped[id] = {
              isOnline: true,
              lastSeen: u.lastSeen,
              status: u.status,
            };
          }
          setOnlineUsers(mapped);
        }
      }
    } catch {
      // Ignore network errors on presence polling
    }
  }, []),

  // Send HTTP heartbeat fallback
   sendHeartbeat = useCallback(async () => {
    if (!userId) {
      return;
    }
    try {
      await fetch(`${API_V1_URL}/presence/heartbeat`, {
        body: JSON.stringify({ status: "online", userId }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
    } catch {
      // Ignore heartbeat failure
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setOnlineUsers({});
      return;
    }

    // Always send initial heartbeat and fetch current presence
    sendHeartbeat();
    fetchHttpPresence();

    // WebSocket connection for real-time live presence
    let isMounted = true;
    const wsUrl = `${API_V1_URL.replace(/^http/i, "ws")}/presence/ws?userId=${encodeURIComponent(userId)}`;

    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onmessage = (event) => {
        if (!isMounted) {
          return;
        }
        try {
          const data = JSON.parse(event.data) as {
            onlineUserIds?: string[];
            type?: string;
            users?: Record<string, { lastSeen: number; status: string }>;
          };
          if (data.type === "presence" && data.users) {
            const mapped: Record<string, UserPresenceInfo> = {};
            for (const [id, u] of Object.entries(data.users)) {
              mapped[id] = {
                isOnline: true,
                lastSeen: u.lastSeen,
                status: u.status,
              };
            }
            setOnlineUsers(mapped);
          }
        } catch {
          // Ignore json parse error
        }
      };

      ws.onerror = () => {
        // Fall back to HTTP polling
      };

      ws.onclose = () => {
        socketRef.current = null;
      };
    } catch {
      // Fall back to polling
    }

    // Periodic heartbeat every 25 seconds
    heartbeatIntervalRef.current = setInterval(() => {
      if (
        socketRef.current &&
        socketRef.current.readyState === WebSocket.OPEN
      ) {
        socketRef.current.send(JSON.stringify({ type: "heartbeat" }));
      } else {
        sendHeartbeat();
        fetchHttpPresence();
      }
    }, 25_000);

    return () => {
      isMounted = false;
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [userId, sendHeartbeat, fetchHttpPresence]);

  const isUserOnline = useCallback(
    (targetUserId?: string | null) => {
      if (!targetUserId) {
        return false;
      }
      // The current logged-in user is always online
      if (userId && targetUserId === userId) {
        return true;
      }
      const user = onlineUsers[targetUserId];
      return Boolean(user && user.isOnline);
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
      return onlineUsers[targetUserId];
    },
    [onlineUsers, userId]
  ),

   onlineUserIds = useMemo(() => Object.keys(onlineUsers), [onlineUsers]),

   value = useMemo(
    () => ({
      getUserPresence,
      isUserOnline,
      onlineCount: onlineUserIds.length,
      onlineUserIds,
    }),
    [getUserPresence, isUserOnline, onlineUserIds]
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
