/* oxlint-disable one-var, sort-vars -- Explicit purchase history versus access cases. */
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { Hono } from "hono";
import { beforeEach, expect, it, vi } from "vitest";

import type { AppEnv } from "@/lib/types";

import libraryRoutes from "./library";

const { select } = vi.hoisted(() => ({ select: vi.fn() }));
vi.mock("@soundkit/db", () => ({
  createDb: () => ({ select }),
  isDatabaseConfigured: () => true,
}));

const query = (rows: unknown[]) => {
  const chain = Object.assign(Promise.resolve(rows), {
    from: () => chain,
    innerJoin: () => chain,
    orderBy: () => chain,
    where: () => chain,
  });
  return chain;
};

beforeEach(() => vi.resetAllMocks());
it.each([true, false])(
  "keeps purchase history while downloads require entitlement (active=%s)",
  async (isEntitled) => {
    const app = new Hono<AppEnv>(),
      row = {
        id: "receipt",
        isEntitled,
        licenseOptionId: null,
        orderProjectId: null,
        priceCents: "10.00",
        productType: "track",
        purchaseProjectId: null,
        purchasedAt: new Date("2026-01-01T00:00:00Z"),
        title: "Historical purchase",
        trackId: "track",
      };
    app.use("*", async (c, next) => {
      c.set("user", { id: "buyer" });
      return await next();
    });
    app.route("/v1/library", libraryRoutes);
    for (const path of ["/purchases", "/purchases/receipt"]) {
      select.mockReset();
      select.mockReturnValueOnce(query([row]));
      if (isEntitled)
        {select.mockReturnValueOnce(
          query([{ assetKind: "tagged_mp3", id: "download" }])
        );}
      const response = await app.request(`/v1/library${path}`),
        body = (await response.json()) as
          | {
              purchase?: { downloadUrl: string | null; title: string };
              downloads?: unknown[];
            }
          | { downloadUrl: string | null; title: string }[],
        item = Array.isArray(body) ? body[0] : body.purchase;
      expect(response.status).toBe(200);
      expect(item?.title).toBe("Historical purchase");
      expect(item?.downloadUrl).toBe(
        isEntitled ? "/v1/tracks/track/assets/download/download" : null
      );
      expect(select).toHaveBeenCalledTimes(isEntitled ? 2 : 1);
      if (!Array.isArray(body))
        {expect(body.downloads).toHaveLength(isEntitled ? 1 : 0);}
      const projection = select.mock.calls[0]?.[0] as { isEntitled: SQL },
        predicate = new PgDialect().sqlToQuery(projection.isEntitled);
      expect(predicate.sql).toContain('"payment_refunds"');
      expect(predicate.sql).toContain("'refunded'");
    }
  }
);
