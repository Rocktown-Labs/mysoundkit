/// <reference types="@cloudflare/vitest-pool-workers/types" />

import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import type { PresenceDurableObject } from "./presence";

const presenceNamespace = (
  env as unknown as {
    PRESENCE: DurableObjectNamespace<PresenceDurableObject>;
  }
).PRESENCE;

describe("PresenceDurableObject", () => {
  it("keeps one user's heartbeat and status on the same durable instance", async () => {
    const presence = presenceNamespace.getByName(
        `presence-${crypto.randomUUID()}`
      ),
      userId = "user_presence_test";

    await expect(presence.heartbeat(userId)).resolves.toMatchObject({
      isOnline: true,
      status: "online",
      userId,
    });
    await expect(presence.heartbeat(userId, "away")).resolves.toMatchObject({
      isOnline: true,
      status: "away",
      userId,
    });
    await expect(presence.getStatus(userId)).resolves.toMatchObject({
      isOnline: true,
      status: "away",
      userId,
    });
  });
});
