/* eslint-disable unicorn/no-await-expression-member, unicorn/no-useless-undefined */
import { OpenAPIHono } from "@hono/zod-openapi";
import { describe, expect, it } from "vitest";

import type { AppEnv, AuthenticatedUser } from "@/lib/types";

import routes from "./admin-analytics";

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
  it("reports missing infrastructure rather than a healthy empty backlog", async () => {
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
