import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { orderItems, purchases } from "@soundkit/db/schema/app";
import { eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";

import {
  sampleLibraryOverview,
  samplePurchasedCatalogItems,
  sampleTracks,
} from "@/lib/sample-data";
import {
  libraryOverviewSchema,
  purchasedCatalogItemSchema,
  trackSummarySchema,
} from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>();

app.openapi(
  createRoute({
    method: "get",
    path: "/overview",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        libraryOverviewSchema,
        "Library overview"
      ),
    },
    tags: ["Library"],
  }),
  (c) => c.json(sampleLibraryOverview, HttpStatusCodes.OK)
);

app.openapi(
  createRoute({
    method: "get",
    path: "/recent",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        trackSummarySchema.array(),
        "Recent plays"
      ),
    },
    tags: ["Library"],
  }),
  (c) => c.json(sampleTracks, HttpStatusCodes.OK)
);

app.openapi(
  createRoute({
    method: "get",
    path: "/saved",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        trackSummarySchema.array(),
        "Saved tracks"
      ),
    },
    tags: ["Library"],
  }),
  (c) => c.json(sampleTracks.slice(0, 1), HttpStatusCodes.OK)
);

app.openapi(
  createRoute({
    method: "get",
    path: "/purchases",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        purchasedCatalogItemSchema.array(),
        "Purchased catalog items"
      ),
    },
    tags: ["Library"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!user || !isDatabaseConfigured()) {
      return c.json(samplePurchasedCatalogItems, HttpStatusCodes.OK);
    }

    const db = createDb();
    const rows = await db
      .select({
        id: purchases.id,
        licenseOptionId: orderItems.licenseOptionId,
        priceCents: orderItems.priceSnapshot,
        productType: orderItems.productType,
        purchasedAt: purchases.purchasedAt,
        title: orderItems.titleSnapshot,
        trackId: purchases.trackId,
      })
      .from(purchases)
      .innerJoin(orderItems, eq(orderItems.id, purchases.orderItemId))
      .where(eq(purchases.buyerUserId, user.id));

    return c.json(
      rows.map((row) => {
        const priceCents = Math.round(Number(row.priceCents) * 100);
        const productType: "track" | "project" =
          row.productType === "project" ? "project" : "track";
        const purchaseMode: "digital_download" | "license" = row.licenseOptionId
          ? "license"
          : "digital_download";
        return {
          artist: "SoundKit Artist",
          artistSlug: "artist",
          cover: "/placeholder.svg",
          downloadUrl: row.trackId ? `/downloads/${row.trackId}` : null,
          duration: null,
          id: row.trackId ?? row.id,
          licenseName: row.licenseOptionId ? "Licensed Instrumental" : null,
          priceCents,
          priceLabel: `$${(priceCents / 100).toFixed(2)}`,
          productType,
          purchaseMode,
          purchasedAt: row.purchasedAt.toISOString(),
          title: row.title,
        };
      }),
      HttpStatusCodes.OK
    );
  }
);

export default app;
