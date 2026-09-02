/* eslint-disable one-var, sort-vars */

export const MAX_PRESENCE_RECONNECT_DELAY_MS = 30_000,
  PRESENCE_ACTIVE_THRESHOLD_MS = 90_000,
  PRESENCE_RECONNECT_JITTER_MS = 500;

export interface PresenceStateSnapshot {
  isOnline: boolean;
  lastSeen: number;
  status: string;
}

export const isFreshPresence = (
    presence: PresenceStateSnapshot,
    now = Date.now()
  ) =>
    presence.isOnline &&
    presence.status !== "offline" &&
    now - presence.lastSeen < PRESENCE_ACTIVE_THRESHOLD_MS,
  getPresenceReconnectDelay = (attempt: number, random = Math.random()) => {
    const exponentialDelay = Math.min(
      MAX_PRESENCE_RECONNECT_DELAY_MS,
      1000 * 2 ** attempt
    );
    return Math.min(
      MAX_PRESENCE_RECONNECT_DELAY_MS,
      exponentialDelay + Math.floor(random * PRESENCE_RECONNECT_JITTER_MS)
    );
  };
