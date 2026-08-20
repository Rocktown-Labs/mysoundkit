import { describe, expect, it } from "vitest";

import app from "./presence";

describe("Presence Routes", () => {
  it("should handle heartbeat registration and fetch presence list", async () => {
    const heartbeatRes = await app.request("/heartbeat", {
      body: JSON.stringify({
        status: "online",
        userId: "user_test_presence_123",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    expect(heartbeatRes.status).toBe(200);
    const heartbeatBody = (await heartbeatRes.json()) as { success: boolean };
    expect(heartbeatBody.success).toBe(true);

    const presenceRes = await app.request("/");
    expect(presenceRes.status).toBe(200);
    const presenceBody = (await presenceRes.json()) as {
      onlineUserIds: string[];
      users: Record<string, { isOnline: boolean; status: string }>;
    };

    expect(presenceBody.onlineUserIds).toContain("user_test_presence_123");
    expect(presenceBody.users["user_test_presence_123"]?.isOnline).toBe(true);
  });

  it("should query presence for specific user IDs", async () => {
    const queryRes = await app.request("/query", {
      body: JSON.stringify({
        userIds: ["user_test_presence_123", "user_offline_456"],
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    expect(queryRes.status).toBe(200);
    const queryBody = (await queryRes.json()) as {
      users: Record<string, { isOnline: boolean; status: string }>;
    };

    expect(queryBody.users["user_test_presence_123"]?.isOnline).toBe(true);
    expect(queryBody.users["user_offline_456"]?.isOnline).toBe(false);
  });
});
