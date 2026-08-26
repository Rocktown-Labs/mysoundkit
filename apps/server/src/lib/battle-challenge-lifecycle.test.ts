import { describe, expect, it } from "vitest";

import {
  BATTLE_CHALLENGE_EXPIRY_MS,
  getBattleChallengeExpiryCutoff,
  getBattleChallengeExpiresAt,
  hasBattleChallengeExpired,
} from "./battle-challenge-lifecycle";

describe("battle challenge lifecycle", () => {
  const createdAt = new Date("2026-08-01T12:00:00.000Z");

  it("expires a challenge seven days after creation", () => {
    const expiresAt = getBattleChallengeExpiresAt(createdAt);

    expect(expiresAt.toISOString()).toBe("2026-08-08T12:00:00.000Z");
    expect(BATTLE_CHALLENGE_EXPIRY_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("identifies challenges at or beyond the expiry boundary", () => {
    const expiresAt = getBattleChallengeExpiresAt(createdAt);

    const beforeExpiry = new Date(expiresAt.getTime() - 1),
      hasExpiredBeforeBoundary = hasBattleChallengeExpired({
        createdAt,
        now: beforeExpiry,
      }),
      hasExpiredAtBoundary = hasBattleChallengeExpired({
        createdAt,
        now: expiresAt,
      });

    expect(hasExpiredBeforeBoundary).toBe(false);
    expect(hasExpiredAtBoundary).toBe(true);
  });

  it("derives the pending challenge cutoff from the sweep time", () => {
    const now = new Date("2026-08-10T12:00:00.000Z");

    expect(getBattleChallengeExpiryCutoff(now).toISOString()).toBe(
      "2026-08-03T12:00:00.000Z"
    );
  });
});
