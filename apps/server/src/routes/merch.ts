import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { createDb } from "@soundkit/db";
import { physicalReleases } from "@soundkit/db/schema/commerce";
import { inArray } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import { createKunakiClient } from "@/lib/kunaki";
import {
  messageResponseSchema,
  shippingQuoteRequestSchema,
  shippingQuoteResponseSchema,
} from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>(),
  // Sample Kunaki test product IDs by media format used when release does not
  // yet have an assigned Kunaki production ID.
  DEFAULT_KUNAKI_PRODUCT_IDS: Record<string, string> = {
    cd: "PX00LRNY2H",
    dvd: "PX00LRNY2H",
    vinyl_12: "PX00LRNY2H",
    vinyl_7: "PX00LRNY2H",
  };

app.openapi(
  createRoute({
    method: "post",
    path: "/shipping-quote",
    request: {
      body: jsonContentRequired(
        shippingQuoteRequestSchema,
        "Kunaki shipping quote request"
      ),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        shippingQuoteResponseSchema,
        "Available shipping options and rates"
      ),
      [HttpStatusCodes.BAD_REQUEST]: jsonContent(
        messageResponseSchema,
        "Invalid request or releases not found"
      ),
      [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
        messageResponseSchema,
        "Failed to calculate shipping options"
      ),
    },
    tags: ["Physical Merch"],
  }),
  async (c) => {
    const body = c.req.valid("json"),
      db = createDb(),
      releaseIds = body.items.map((item) => item.physicalReleaseId),
      releaseRows = await db
        .select()
        .from(physicalReleases)
        .where(inArray(physicalReleases.id, releaseIds));

    if (releaseRows.length === 0) {
      return c.json(
        { message: "No physical merchandise found for the specified items." },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const releaseMap = new Map(releaseRows.map((row) => [row.id, row])),
      kunakiItems: { productId: string; quantity: number }[] = [];

    for (const item of body.items) {
      const release = releaseMap.get(item.physicalReleaseId);
      if (!release) {
        continue;
      }

      const productId =
        release.kunakiProductId ??
        DEFAULT_KUNAKI_PRODUCT_IDS[release.mediaFormat] ??
        "PX00LRNY2H";

      kunakiItems.push({
        productId,
        quantity: item.quantity,
      });
    }

    if (kunakiItems.length === 0) {
      return c.json(
        { message: "No valid physical releases found." },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const kunaki = createKunakiClient();

    try {
      const rawOptions = await kunaki.quoteShipping({
          country: body.country,
          items: kunakiItems,
          postalCode: body.postalCode,
          stateProvince: body.stateProvince,
        }),
        options = rawOptions.map((opt) => ({
          code: opt.description.toLowerCase().replaceAll(/\s+/g, "_"),
          deliveryTimeDescription: opt.deliveryTime,
          description: opt.description,
          priceCents: opt.priceCents,
        })),
        recommended = options[0] ?? null;

      return c.json(
        {
          currency: "USD",
          options,
          recommended,
        },
        HttpStatusCodes.OK
      );
    } catch (error) {
      return c.json(
        {
          message:
            error instanceof Error
              ? error.message
              : "Failed to quote shipping rates.",
        },
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }
);

export default app;
