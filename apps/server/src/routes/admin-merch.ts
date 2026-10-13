/* eslint-disable unicorn/max-nested-calls, sort-vars, one-var */
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { merchCatalogProducts } from "@soundkit/db/schema/fulfillment";
import { eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import { isAdminUser } from "@/lib/admin";
import {
  PrintfulRequestError,
  isPrintfulConfigured,
  searchPrintfulCatalogProducts,
} from "@/lib/printful";
import {
  listPrintfulCatalogRows,
  setPrintfulCatalogProductState,
  syncPrintfulCatalogProduct,
  validateRetailBoundsCents,
} from "@/lib/printful-catalog";
import type { AppEnv } from "@/lib/types";
import { logError } from "@/middleware/structured-logging";

const app = new OpenAPIHono<AppEnv>(),
  retailBoundsFields = {
    retailMaxCents: z.number().int().positive().optional(),
    retailMinCents: z.number().int().min(1200).optional(),
  },
  enableCatalogBodySchema = z.object({
    printfulProductId: z.number().int().positive(),
    ...retailBoundsFields,
  }),
  updateCatalogBodySchema = z.object({
    curated: z.boolean().optional(),
    ...retailBoundsFields,
  }),
  printfulProductsQuerySchema = z.object({
    textSearch: z.string().trim().max(120).optional(),
  }),
  // Printful API failures are upstream (502/404); domain validation failures
  // from the sync library are ours (400).
  printfulErrorStatus = (error: unknown) => {
    if (!(error instanceof PrintfulRequestError)) {
      return error instanceof Error
        ? HttpStatusCodes.BAD_REQUEST
        : HttpStatusCodes.BAD_GATEWAY;
    }

    return error.status === 404
      ? HttpStatusCodes.NOT_FOUND
      : HttpStatusCodes.BAD_GATEWAY;
  };

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        z.array(z.record(z.string(), z.unknown())),
        "Cached merch catalog with curation state"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        z.object({ message: z.string() }),
        "Administrator access is required"
      ),
      [HttpStatusCodes.SERVICE_UNAVAILABLE]: jsonContent(
        z.object({ message: z.string() }),
        "Printful is not configured"
      ),
    },
    tags: ["Admin Merch"],
  }),
  async (c) => {
    if (!isAdminUser(c.get("user"))) {
      return c.json(
        { message: "Administrator access is required." },
        HttpStatusCodes.FORBIDDEN
      );
    }

    if (!isPrintfulConfigured()) {
      return c.json(
        {
          message:
            "Printful is not configured. Set PRINTFUL_API_KEY to manage the merch catalog.",
        },
        HttpStatusCodes.SERVICE_UNAVAILABLE
      );
    }

    return c.json(await listPrintfulCatalogRows(), HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/",
    request: {
      body: jsonContentRequired(
        enableCatalogBodySchema,
        "Enable + sync a Printful catalog product"
      ),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(
        z.record(z.string(), z.unknown()),
        "Synced catalog product"
      ),
      [HttpStatusCodes.BAD_REQUEST]: jsonContent(
        z.object({ message: z.string() }),
        "Invalid product or bounds"
      ),
      [HttpStatusCodes.BAD_GATEWAY]: jsonContent(
        z.object({ message: z.string() }),
        "Printful sync failed"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        z.object({ message: z.string() }),
        "Administrator access is required"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        z.object({ message: z.string() }),
        "Printful product not found"
      ),
      [HttpStatusCodes.SERVICE_UNAVAILABLE]: jsonContent(
        z.object({ message: z.string() }),
        "Printful is not configured"
      ),
    },
    tags: ["Admin Merch"],
  }),
  async (c) => {
    if (!isAdminUser(c.get("user"))) {
      return c.json(
        { message: "Administrator access is required." },
        HttpStatusCodes.FORBIDDEN
      );
    }

    if (!isPrintfulConfigured()) {
      return c.json(
        {
          message:
            "Printful is not configured. Set PRINTFUL_API_KEY to manage the merch catalog.",
        },
        HttpStatusCodes.SERVICE_UNAVAILABLE
      );
    }

    const body = c.req.valid("json");

    if (
      body.retailMinCents !== undefined &&
      body.retailMaxCents !== undefined &&
      !validateRetailBoundsCents({
        retailMaxCents: body.retailMaxCents,
        retailMinCents: body.retailMinCents,
      }).valid
    ) {
      return c.json(
        {
          message:
            "Retail bounds must be integer cents with a minimum of $12.00 and max above min.",
        },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    try {
      const result = await syncPrintfulCatalogProduct({
        curated: true,
        printfulProductId: body.printfulProductId,
        retailMaxCents: body.retailMaxCents,
        retailMinCents: body.retailMinCents,
      });

      return c.json(result, HttpStatusCodes.CREATED);
    } catch (error) {
      logError({
        error: error instanceof Error ? error.message : String(error),
        operation: "enable_printful_catalog_product",
        requestId: c.get("requestId"),
      });

      return c.json(
        {
          message:
            error instanceof Error
              ? error.message
              : "Failed to sync the Printful catalog product.",
        },
        printfulErrorStatus(error)
      );
    }
  }
);

app.openapi(
  createRoute({
    method: "patch",
    path: "/{id}",
    request: {
      body: jsonContentRequired(
        updateCatalogBodySchema,
        "Update curation state or retail bounds"
      ),
      params: z.object({ id: z.string() }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        z.record(z.string(), z.unknown()),
        "Updated catalog product"
      ),
      [HttpStatusCodes.BAD_REQUEST]: jsonContent(
        z.object({ message: z.string() }),
        "Invalid update"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        z.object({ message: z.string() }),
        "Administrator access is required"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        z.object({ message: z.string() }),
        "Catalog product is not synced"
      ),
      [HttpStatusCodes.SERVICE_UNAVAILABLE]: jsonContent(
        z.object({ message: z.string() }),
        "Printful is not configured"
      ),
    },
    tags: ["Admin Merch"],
  }),
  async (c) => {
    if (!isAdminUser(c.get("user"))) {
      return c.json(
        { message: "Administrator access is required." },
        HttpStatusCodes.FORBIDDEN
      );
    }

    if (!isPrintfulConfigured()) {
      return c.json(
        {
          message:
            "Printful is not configured. Set PRINTFUL_API_KEY to manage the merch catalog.",
        },
        HttpStatusCodes.SERVICE_UNAVAILABLE
      );
    }

    const body = c.req.valid("json"),
      { id } = c.req.valid("param");

    try {
      const row = await setPrintfulCatalogProductState({
        catalogProductId: id,
        curated: body.curated,
        retailMaxCents: body.retailMaxCents,
        retailMinCents: body.retailMinCents,
      });

      if (!row) {
        throw new Error("Catalog product update returned no row.");
      }

      return c.json(row, HttpStatusCodes.OK);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Invalid catalog update.";

      return c.json(
        { message },
        message.includes("not synced")
          ? HttpStatusCodes.NOT_FOUND
          : HttpStatusCodes.BAD_REQUEST
      );
    }
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/{id}/refresh",
    request: {
      params: z.object({ id: z.string() }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        z.record(z.string(), z.unknown()),
        "Refreshed catalog product"
      ),
      [HttpStatusCodes.BAD_REQUEST]: jsonContent(
        z.object({ message: z.string() }),
        "Invalid refresh"
      ),
      [HttpStatusCodes.BAD_GATEWAY]: jsonContent(
        z.object({ message: z.string() }),
        "Printful refresh failed"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        z.object({ message: z.string() }),
        "Administrator access is required"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        z.object({ message: z.string() }),
        "Printful product not found"
      ),
      [HttpStatusCodes.SERVICE_UNAVAILABLE]: jsonContent(
        z.object({ message: z.string() }),
        "Printful is not configured"
      ),
    },
    tags: ["Admin Merch"],
  }),
  async (c) => {
    if (!isAdminUser(c.get("user"))) {
      return c.json(
        { message: "Administrator access is required." },
        HttpStatusCodes.FORBIDDEN
      );
    }

    if (!isPrintfulConfigured()) {
      return c.json(
        {
          message:
            "Printful is not configured. Set PRINTFUL_API_KEY to manage the merch catalog.",
        },
        HttpStatusCodes.SERVICE_UNAVAILABLE
      );
    }

    const { id } = c.req.valid("param");

    if (!isDatabaseConfigured()) {
      return c.json(
        { message: "Database is not configured." },
        HttpStatusCodes.SERVICE_UNAVAILABLE
      );
    }

    const [existing] = await createDb()
      .select({ isCurated: merchCatalogProducts.isCurated })
      .from(merchCatalogProducts)
      .where(eq(merchCatalogProducts.id, id))
      .limit(1);

    if (!existing) {
      return c.json(
        { message: `Catalog product ${id} is not synced.` },
        HttpStatusCodes.NOT_FOUND
      );
    }

    // Refresh preserves the current curation; the sync is idempotent by primary key.
    try {
      const result = await syncPrintfulCatalogProduct({
        curated: existing.isCurated,
        printfulProductId: Number(id),
      });

      return c.json(result, HttpStatusCodes.OK);
    } catch (error) {
      logError({
        error: error instanceof Error ? error.message : String(error),
        operation: "refresh_printful_catalog_product",
        requestId: c.get("requestId"),
      });

      return c.json(
        {
          message:
            error instanceof Error
              ? error.message
              : "Failed to refresh the Printful catalog product.",
        },
        printfulErrorStatus(error)
      );
    }
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/printful-products",
    request: {
      query: printfulProductsQuerySchema,
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        z.array(z.record(z.string(), z.unknown())),
        "Live Printful catalog search results"
      ),
      [HttpStatusCodes.BAD_REQUEST]: jsonContent(
        z.object({ message: z.string() }),
        "Invalid search"
      ),
      [HttpStatusCodes.BAD_GATEWAY]: jsonContent(
        z.object({ message: z.string() }),
        "Printful search failed"
      ),
      [HttpStatusCodes.FORBIDDEN]: jsonContent(
        z.object({ message: z.string() }),
        "Administrator access is required"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        z.object({ message: z.string() }),
        "Not found"
      ),
      [HttpStatusCodes.SERVICE_UNAVAILABLE]: jsonContent(
        z.object({ message: z.string() }),
        "Printful is not configured"
      ),
    },
    tags: ["Admin Merch"],
  }),
  async (c) => {
    if (!isAdminUser(c.get("user"))) {
      return c.json(
        { message: "Administrator access is required." },
        HttpStatusCodes.FORBIDDEN
      );
    }

    if (!isPrintfulConfigured()) {
      return c.json(
        {
          message:
            "Printful is not configured. Set PRINTFUL_API_KEY to manage the merch catalog.",
        },
        HttpStatusCodes.SERVICE_UNAVAILABLE
      );
    }

    const { textSearch } = c.req.valid("query");

    try {
      const products = await searchPrintfulCatalogProducts(textSearch ?? "");

      return c.json(
        products.map((product) => ({
          id: product.id,
          image: product.image ?? null,
          isDiscontinued: Boolean(product.is_discontinued),
          name: product.name,
          type: product.type ?? null,
          variantCount: product.variant_count ?? null,
        })),
        HttpStatusCodes.OK
      );
    } catch (error) {
      logError({
        error: error instanceof Error ? error.message : String(error),
        operation: "search_printful_catalog",
        requestId: c.get("requestId"),
      });

      return c.json(
        { message: "Failed to search the Printful catalog." },
        printfulErrorStatus(error)
      );
    }
  }
);

export default app;
