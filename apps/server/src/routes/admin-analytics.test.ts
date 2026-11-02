/* eslint-disable one-var, unicorn/no-await-expression-member, unicorn/no-useless-undefined */
import { OpenAPIHono } from "@hono/zod-openapi";
import type * as DatabaseModule from "@soundkit/db";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as OutboxModule from "@/lib/analytics-outbox";
import type { AppEnv, AuthenticatedUser } from "@/lib/types";

import routes from "./admin-analytics";

const state = vi.hoisted(() => ({
  database: true,
  erase: vi.fn(() => Promise.resolve()),
}));
vi.mock("@soundkit/db", async (original) => ({
  ...(await original<typeof DatabaseModule>()),
  isDatabaseConfigured: () => state.database,
}));
vi.mock("@/lib/analytics-outbox", async (original) => ({
  ...(await original<typeof OutboxModule>()),
  eraseAccountAnalytics: state.erase,
}));
beforeEach(() => {
  state.database = true;
  state.erase.mockClear();
});

function appFor(user: AuthenticatedUser | null) {
  const app = new OpenAPIHono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("user", user);
    return await next();
  });
  return app.route("/analytics", routes);
}
const configured = {
  ANALYTICS_STREAM: {
    send: async () => {
      /* No external delivery in these guard tests. */
    },
  },
  SOUNDKIT_ANALYTICS_ENV: "test",
};
describe("internal analytics operational controls", () => {
  it.each([null, { id: "fan", role: "user" }])(
    "rejects unprivileged access %#",
    async (user) => {
      expect(
        (await appFor(user).request("/analytics/health", undefined, configured))
          .status
      ).toBe(403);
    }
  );
  it("reports a missing database rather than a healthy empty backlog", async () => {
    state.database = false;
    expect(
      (
        await appFor({ id: "admin", role: "admin" }).request(
          "/analytics/health",
          undefined,
          {}
        )
      ).status
    ).toBe(503);
  });
  it("can erase account analytics without any export binding", async () => {
    const response = await appFor({ id: "admin", role: "admin" }).request(
      "/analytics/erase/fixture-user",
      { method: "POST" },
      {}
    );
    expect(response.status).toBe(200);
    expect(state.erase).toHaveBeenCalledWith("fixture-user");
  });
  it("validates replay identity before accessing the database", async () => {
    expect(
      (
        await appFor({ id: "admin", role: "admin" }).request(
          "/analytics/replay/not-a-uuid",
          { method: "POST" },
          configured
        )
      ).status
    ).toBe(400);
  });
  it("requires both fields of a bounded reconciliation cursor", async () => {
    expect(
      (
        await appFor({ id: "admin", role: "admin" }).request(
          "/analytics/reconciliation?before_id=one",
          undefined,
          configured
        )
      ).status
    ).toBe(400);
  });
});
