import { describe, expect, it } from "vitest";

import {
  getPresenceReconnectDelay,
  isFreshPresence,
  PRESENCE_ACTIVE_THRESHOLD_MS,
} from "./presence-state";

describe("presence state", () => {
  it("expires online snapshots at the active threshold", () => {
    const presence = {
      isOnline: true,
      lastSeen: 1000,
      status: "online",
    };

    expect(
      isFreshPresence(presence, 1000 + PRESENCE_ACTIVE_THRESHOLD_MS - 1)
    ).toBe(true);
    expect(isFreshPresence(presence, 1000 + PRESENCE_ACTIVE_THRESHOLD_MS)).toBe(
      false
    );
  });

  it("treats away as active but never treats offline as active", () => {
    expect(
      isFreshPresence({ isOnline: true, lastSeen: 1000, status: "away" }, 1001)
    ).toBe(true);
    expect(
      isFreshPresence(
        { isOnline: true, lastSeen: 1000, status: "offline" },
        1001
      )
    ).toBe(false);
  });

  it("uses bounded exponential reconnect delays with jitter", () => {
    expect(getPresenceReconnectDelay(0, 0)).toBe(1000);
    expect(getPresenceReconnectDelay(2, 0.5)).toBe(4250);
    expect(getPresenceReconnectDelay(10, 1)).toBe(30_000);
  });
});
