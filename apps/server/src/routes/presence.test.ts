import { describe, expect, it } from "vitest";

import app from "./presence";

describe("Presence Routes", () => {
  it("requires an authenticated session for presence reads and writes", async () => {
    const requests = [
        app.request("/"),
        app.request("/query", {
          body: JSON.stringify({ userIds: ["user_test_presence_123"] }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        }),
        app.request("/heartbeat", {
          body: JSON.stringify({ status: "online" }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        }),
      ],
      responses = await Promise.all(requests);
    expect(responses.map((response) => response.status)).toEqual([
      401, 401, 401,
    ]);
  });

  it("rejects oversized targeted presence queries", async () => {
    const response = await app.request("/query", {
      body: JSON.stringify({
        userIds: Array.from({ length: 101 }, (_, i) => `user-${i}`),
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    expect(response.status).toBe(400);
  });
});
