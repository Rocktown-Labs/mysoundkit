/* eslint-disable unicorn/max-nested-calls, sort-vars, one-var, complexity, require-unicode-regexp, no-nested-ternary */
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  uploadIntents,
  projects as projectsTable,
} from "@soundkit/db/schema/app";
import { physicalReleases } from "@soundkit/db/schema/commerce";
import {
  merchCatalogProducts,
  merchCatalogVariants,
  merchDesigns,
  merchMockups,
} from "@soundkit/db/schema/fulfillment";
import { and, desc, eq, inArray } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";
import jsonContentRequired from "stoker/openapi/helpers/json-content-required";

import { publicAssetUrlFromParts } from "@/lib/asset-urls";
import { isAuthenticatedUser, unauthorizedMessage } from "@/lib/entitlements";
import {
  enqueueDesignMockups,
  registerDesignFile,
} from "@/lib/fulfillment-printful";
import { createKunakiClient } from "@/lib/kunaki";
import {
  MerchEditorError,
  merchEditorSchema,
  merchPrintAreas,
  validateMerchEditor,
  ownedMerchArtwork,
  selectedMerchMockupsReady,
} from "@/lib/merch-production";
import {
  calculatePrintfulShippingRates,
  getPrintfulFile,
  isPrintfulConfigured,
  printfulPriceToCents,
} from "@/lib/printful";
import {
  listPublicMerch,
  listPublicPhysicalReleases,
} from "@/lib/public-merch";
import {
  messageResponseSchema,
  shippingQuoteRequestSchema,
  shippingQuoteResponseSchema,
} from "@/lib/schemas";
import type { AppEnv } from "@/lib/types";
import { logError } from "@/middleware/structured-logging";

const app = new OpenAPIHono<AppEnv>(),
  catalogProductSchema = z.object({
    brand: z.string().nullable(),
    id: z.string(),
    image: z.string().nullable(),
    isDiscontinued: z.boolean(),
    name: z.string(),
    placements: z.array(z.record(z.string(), z.unknown())),
    printAreas: z.array(
      z.object({
        dpi: z.number(),
        height: z.number(),
        placement: z.string(),
        technique: z.string(),
        width: z.number(),
      })
    ),
    retailMaxCents: z.number().int(),
    retailMinCents: z.number().int(),
    type: z.string().nullable(),
  }),
  catalogVariantSchema = z.object({
    basePriceCents: z.number().int(),
    catalogProductId: z.string(),
    color: z.string().nullable(),
    colorCode: z.string().nullable(),
    id: z.string(),
    image: z.string().nullable(),
    inStock: z.boolean(),
    name: z.string(),
    size: z.string().nullable(),
  }),
  merchDesignSchema = z.object({
    createdAt: z.string(),
    description: z.string().nullable(),
    designFileObjectKey: z.string(),
    designFileUrl: z.string().nullable(),
    editorConfig: merchEditorSchema.nullable(),
    id: z.string(),
    mockupCount: z.number().int(),
    ownerUserId: z.string(),
    placement: z.string(),
    platformFeeBps: z.number().int(),
    printfulCatalogProductId: z.string().nullable(),
    printfulFileId: z.string().nullable(),
    projectId: z.string().nullable(),
    publishedAt: z.string().nullable(),
    readyMockupCount: z.number().int(),
    retailPriceCents: z.number().int(),
    status: z.enum(["archived", "draft", "published", "ready"]),
    technique: z.string(),
    title: z.string(),
    trackId: z.string().nullable(),
  }),
  mockupSchema = z.object({
    catalogVariantId: z.string(),
    error: z.string().nullable(),
    id: z.string(),
    mockupUrl: z.string().nullable(),
    status: z.enum(["completed", "failed", "pending", "queued"]),
  }),
  physicalReleaseCardSchema = z.object({
    id: z.string(),
    includesDigitalDownload: z.boolean(),
    kunakiProductId: z.string().nullable(),
    mediaFormat: z.enum(["cd", "dvd", "vinyl_12", "vinyl_7"]),
    projectId: z.string().nullable(),
    projectTitle: z.string().nullable(),
    retailPriceCents: z.number().int(),
    status: z.enum(["archived", "draft", "published", "ready"]),
    title: z.string(),
  }),
  createDesignBodySchema = z.object({
    description: z.string().max(2000).optional(),
    designFileObjectKey: z.string().min(1),
    editorConfig: merchEditorSchema.optional(),
    placement: z.string().min(1),
    printfulCatalogProductId: z.string().min(1),
    printfulFileId: z.string().optional(),
    projectId: z.string().optional(),
    retailPriceCents: z.number().int().min(1200),
    technique: z.string().default("dtg"),
    title: z.string().min(1).max(200),
    trackId: z.string().optional(),
  }),
  updateDesignBodySchema = z.object({
    description: z.string().max(2000).optional(),
    designFileObjectKey: z.string().min(1).optional(),
    editorConfig: merchEditorSchema.optional(),
    placement: z.string().min(1).optional(),
    retailPriceCents: z.number().int().min(1200).optional(),
    status: z.enum(["archived", "draft", "published", "ready"]).optional(),
    technique: z.string().optional(),
    title: z.string().min(1).max(200).optional(),
  }),
  serializeDesign = (
    row: typeof merchDesigns.$inferSelect,
    mockupCount: number,
    readyMockupCount: number
  ) => ({
    createdAt: row.createdAt.toISOString(),
    description: row.description,
    designFileObjectKey: row.designFileObjectKey,
    designFileUrl: row.designFileUrl,
    editorConfig: row.designMetadata?.editor ?? null,
    id: row.id,
    mockupCount,
    ownerUserId: row.ownerUserId,
    placement: row.placement,
    platformFeeBps: row.platformFeeBps,
    printfulCatalogProductId: row.printfulCatalogProductId,
    printfulFileId: row.printfulFileId,
    projectId: row.projectId,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    readyMockupCount,
    retailPriceCents: row.retailPriceCents,
    status: row.status,
    technique: row.technique,
    title: row.title,
    trackId: row.trackId,
  });

async function validateEditorSave(
  userId: string,
  product: typeof merchCatalogProducts.$inferSelect,
  body: {
    editorConfig?: z.infer<typeof merchEditorSchema>;
    designFileObjectKey: string;
    placement: string;
    technique: string;
  }
) {
  if (!body.editorConfig) {
    return;
  }
  if (!ownedMerchArtwork(body.designFileObjectKey, userId)) {
    throw new MerchEditorError(
      "Upload your artwork before saving this design."
    );
  }
  const db = createDb();
  const [intent] = await db
    .select()
    .from(uploadIntents)
    .where(
      and(
        eq(uploadIntents.objectKey, body.designFileObjectKey),
        eq(uploadIntents.userId, userId)
      )
    )
    .limit(1);
  if (
    !intent ||
    !["image/png", "image/jpeg"].includes(intent.mimeType ?? "") ||
    (intent.sizeBytes ?? Infinity) > 20 * 1024 * 1024
  ) {
    throw new MerchEditorError(
      "Choose a PNG or JPEG upload under 20 MB that belongs to your account."
    );
  }
  const variants = await db
    .select()
    .from(merchCatalogVariants)
    .where(eq(merchCatalogVariants.catalogProductId, product.id));
  validateMerchEditor({
    areas: merchPrintAreas(product.printFileRules),
    config: body.editorConfig,
    placement: body.placement,
    technique: body.technique,
    variants,
  });
}

// ---------------------------------------------------------------------------
// Printful merch design CRUD (artist-facing, behind canSellProducts in M4)
// ---------------------------------------------------------------------------

app.openapi(
  createRoute({
    method: "get",
    path: "/catalog",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        z.object({
          products: z.array(catalogProductSchema),
          variants: z.array(catalogVariantSchema),
        }),
        "Curated Printful blanks with variants"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        z.object({ message: z.string() }),
        "Authentication required"
      ),
    },
    tags: ["Merch"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    if (!isDatabaseConfigured()) {
      return c.json({ products: [], variants: [] }, HttpStatusCodes.OK);
    }

    const db = createDb(),
      products = await db
        .select()
        .from(merchCatalogProducts)
        .where(eq(merchCatalogProducts.isCurated, true)),
      variants = await db
        .select()
        .from(merchCatalogVariants)
        .where(eq(merchCatalogVariants.inStock, true));

    return c.json(
      {
        products: products.map((p) => ({
          brand: p.brand,
          id: p.id,
          image: p.image,
          isDiscontinued: p.isDiscontinued,
          name: p.name,
          placements: p.placements as Record<string, unknown>[],
          printAreas: merchPrintAreas(p.printFileRules),
          retailMaxCents: p.retailMaxCents,
          retailMinCents: p.retailMinCents,
          type: p.type,
        })),
        variants: variants
          .filter((v) => products.some((p) => p.id === v.catalogProductId))
          .map((v) => ({
            basePriceCents: v.basePriceCents,
            catalogProductId: v.catalogProductId,
            color: v.color,
            colorCode: v.colorCode,
            id: v.id,
            image: v.image,
            inStock: v.inStock,
            name: v.name,
            size: v.size,
          })),
      },
      HttpStatusCodes.OK
    );
  }
);

// GET /v1/merch/physical-releases — the artist's Kunaki releases across all projects
app.openapi(
  createRoute({
    method: "get",
    path: "/physical-releases",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        z.array(physicalReleaseCardSchema),
        "Artist physical releases (Kunaki)"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        z.object({ message: z.string() }),
        "Authentication required"
      ),
    },
    tags: ["Merch"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    if (!isDatabaseConfigured()) {
      return c.json([], HttpStatusCodes.OK);
    }

    const db = createDb(),
      releases = await db
        .select({
          id: physicalReleases.id,
          includesDigitalDownload: physicalReleases.includesDigitalDownload,
          kunakiProductId: physicalReleases.kunakiProductId,
          mediaFormat: physicalReleases.mediaFormat,
          projectId: physicalReleases.projectId,
          projectTitle: projectsTable.title,
          retailPriceCents: physicalReleases.retailPriceCents,
          status: physicalReleases.status,
          title: physicalReleases.title,
        })
        .from(physicalReleases)
        .leftJoin(
          projectsTable,
          eq(projectsTable.id, physicalReleases.projectId)
        )
        .where(eq(physicalReleases.ownerUserId, user.id))
        .orderBy(desc(physicalReleases.createdAt));

    return c.json(releases, HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "post",
    path: "/designs",
    request: {
      body: jsonContentRequired(
        createDesignBodySchema,
        "New merch design payload"
      ),
    },
    responses: {
      [HttpStatusCodes.CREATED]: jsonContent(
        merchDesignSchema,
        "Created merch design"
      ),
      [HttpStatusCodes.BAD_REQUEST]: jsonContent(
        z.object({ message: z.string() }),
        "Invalid design"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        z.object({ message: z.string() }),
        "Authentication required"
      ),
    },
    tags: ["Merch"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    if (!isDatabaseConfigured()) {
      return c.json(
        { message: "Database is not configured." },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const body = c.req.valid("json"),
      db = createDb(),
      [product] = await db
        .select()
        .from(merchCatalogProducts)
        .where(eq(merchCatalogProducts.id, body.printfulCatalogProductId))
        .limit(1);

    if (!product || !product.isCurated || product.isDiscontinued) {
      return c.json(
        { message: "The selected blank is not available in the catalog." },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if (
      body.retailPriceCents < product.retailMinCents ||
      body.retailPriceCents > product.retailMaxCents
    ) {
      return c.json(
        {
          message: `Retail price must be between $${(product.retailMinCents / 100).toFixed(2)} and $${(product.retailMaxCents / 100).toFixed(2)} for ${product.name}.`,
        },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    if (body.editorConfig) {
      try {
        await validateEditorSave(user.id, product, body);
      } catch (error) {
        if (error instanceof MerchEditorError) {
          return c.json(
            { message: error.message },
            HttpStatusCodes.BAD_REQUEST
          );
        }
        throw error;
      }
    }

    const designFileUrl = body.designFileObjectKey.startsWith("http")
        ? body.designFileObjectKey
        : (publicAssetUrlFromParts({
            metadata: null,
            objectKey: body.designFileObjectKey,
          }) ?? null),
      printfulFileId =
        (body.editorConfig ? undefined : body.printfulFileId) ??
        (designFileUrl
          ? await registerDesignFile({
              designFileUrl,
              filename: body.designFileObjectKey.split("/").pop() ?? "design",
            })
          : null),
      designId = crypto.randomUUID(),
      [design] = await db
        .insert(merchDesigns)
        .values({
          description: body.description ?? null,
          designFileObjectKey: body.designFileObjectKey,
          designFileUrl,
          designMetadata: body.editorConfig
            ? {
                editor: body.editorConfig,
                height: body.editorConfig.artwork.height,
                width: body.editorConfig.artwork.width,
              }
            : null,
          id: designId,
          ownerUserId: user.id,
          placement: body.placement,
          printfulCatalogProductId: body.printfulCatalogProductId,
          printfulFileId: printfulFileId ? String(printfulFileId) : null,
          projectId: body.projectId ?? null,
          retailPriceCents: body.retailPriceCents,
          technique: body.technique,
          title: body.title,
          trackId: body.trackId ?? null,
        })
        .returning();

    if (!design) {
      return c.json(
        { message: "Unable to create the merch design." },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    try {
      await enqueueDesignMockups({ merchDesignId: designId });
    } catch (error) {
      logError({
        error: error instanceof Error ? error.message : String(error),
        operation: "enqueue_design_mockups",
        requestId: c.get("requestId"),
      });
    }

    return c.json(serializeDesign(design, 0, 0), HttpStatusCodes.CREATED);
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/designs",
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        z.array(merchDesignSchema),
        "Artist merch designs"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        z.object({ message: z.string() }),
        "Authentication required"
      ),
    },
    tags: ["Merch"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    if (!isDatabaseConfigured()) {
      return c.json([], HttpStatusCodes.OK);
    }

    const db = createDb(),
      designs = await db
        .select()
        .from(merchDesigns)
        .where(eq(merchDesigns.ownerUserId, user.id))
        .orderBy(desc(merchDesigns.createdAt)),
      allMockups =
        designs.length > 0
          ? await db
              .select({
                merchDesignId: merchMockups.merchDesignId,
                status: merchMockups.status,
              })
              .from(merchMockups)
          : [];

    return c.json(
      designs.map((d) => {
        const designMockups = allMockups.filter(
          (m) => m.merchDesignId === d.id
        );

        return serializeDesign(
          d,
          designMockups.length,
          designMockups.filter((m) => m.status === "completed").length
        );
      }),
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/designs/{id}/mockups",
    request: {
      params: z.object({ id: z.string() }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        z.array(mockupSchema),
        "Design mockups"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        z.object({ message: z.string() }),
        "Design not found"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        z.object({ message: z.string() }),
        "Authentication required"
      ),
    },
    tags: ["Merch"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    if (!isDatabaseConfigured()) {
      return c.json([], HttpStatusCodes.OK);
    }

    const db = createDb(),
      { id } = c.req.valid("param"),
      [design] = await db
        .select()
        .from(merchDesigns)
        .where(
          and(eq(merchDesigns.id, id), eq(merchDesigns.ownerUserId, user.id))
        )
        .limit(1);

    if (!design) {
      return c.json(
        { message: "Design not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    const mockups = await db
      .select()
      .from(merchMockups)
      .where(eq(merchMockups.merchDesignId, id));

    return c.json(
      mockups.map((m) => ({
        catalogVariantId: m.catalogVariantId,
        error: m.error,
        id: m.id,
        mockupUrl: m.mockupUrl,
        status: m.status,
      })),
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "patch",
    path: "/designs/{id}",
    request: {
      body: jsonContentRequired(
        updateDesignBodySchema,
        "Design update payload"
      ),
      params: z.object({ id: z.string() }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(merchDesignSchema, "Updated design"),
      [HttpStatusCodes.BAD_REQUEST]: jsonContent(
        z.object({ message: z.string() }),
        "Invalid update"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        z.object({ message: z.string() }),
        "Design not found"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        z.object({ message: z.string() }),
        "Authentication required"
      ),
    },
    tags: ["Merch"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    if (!isDatabaseConfigured()) {
      return c.json(
        { message: "Database is not configured." },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const db = createDb();
    const body = c.req.valid("json");
    const { id } = c.req.valid("param");
    const artworkChange =
      body.editorConfig !== undefined ||
      body.designFileObjectKey !== undefined ||
      body.placement !== undefined ||
      body.technique !== undefined;
    if (
      artworkChange &&
      (!body.editorConfig ||
        !body.designFileObjectKey ||
        !body.placement ||
        !body.technique ||
        body.status === "published")
    ) {
      return c.json(
        {
          message:
            "Save the complete artwork configuration as a draft before publishing.",
        },
        HttpStatusCodes.BAD_REQUEST
      );
    }
    let updated: typeof merchDesigns.$inferSelect;
    try {
      updated = await db.transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(merchDesigns)
          .where(
            and(eq(merchDesigns.id, id), eq(merchDesigns.ownerUserId, user.id))
          )
          .limit(1)
          .for("update");
        if (!existing) {
          throw new MerchEditorError("Design not found.");
        }
        const [product] = existing.printfulCatalogProductId
          ? await tx
              .select()
              .from(merchCatalogProducts)
              .where(
                eq(merchCatalogProducts.id, existing.printfulCatalogProductId)
              )
              .limit(1)
          : [];
        if (
          body.retailPriceCents !== undefined &&
          product &&
          (body.retailPriceCents < product.retailMinCents ||
            body.retailPriceCents > product.retailMaxCents)
        ) {
          throw new MerchEditorError(
            "Set a price within this product's retail range."
          );
        }
        let artworkValues = {};
        if (
          artworkChange &&
          body.editorConfig &&
          body.designFileObjectKey &&
          body.placement &&
          body.technique
        ) {
          if (
            existing.publishedAt ||
            existing.status === "published" ||
            existing.status === "archived"
          ) {
            throw new MerchEditorError(
              "Published artwork is locked to protect existing orders. Create a new design for a new edition."
            );
          }
          if (!product || !product.isCurated || product.isDiscontinued) {
            throw new MerchEditorError("This product is no longer available.");
          }
          await validateEditorSave(user.id, product, {
            ...body,
            designFileObjectKey: body.designFileObjectKey,
            placement: body.placement,
            technique: body.technique,
          });
          const url = publicAssetUrlFromParts({
            metadata: null,
            objectKey: body.designFileObjectKey,
          });
          if (!url) {
            throw new MerchEditorError("Artwork URL could not be resolved.");
          }
          const fileId = await registerDesignFile({
            designFileUrl: url,
            filename: body.designFileObjectKey.split("/").pop() ?? "artwork",
          });
          artworkValues = {
            designFileObjectKey: body.designFileObjectKey,
            designFileUrl: url,
            designMetadata: {
              ...existing.designMetadata,
              editor: body.editorConfig,
            },
            placement: body.placement,
            printfulFileId: fileId ? String(fileId) : null,
            status: "draft" as const,
            technique: body.technique,
          };
          await tx
            .delete(merchMockups)
            .where(eq(merchMockups.merchDesignId, id));
        }
        if (body.status === "published") {
          if (existing.status === "archived")
            {throw new MerchEditorError(
              "Restore an archived product before publishing."
            );}
          const mockups = await tx
            .select()
            .from(merchMockups)
            .where(eq(merchMockups.merchDesignId, id));
          if (existing.designMetadata?.editor) {
            if (
              !selectedMerchMockupsReady(
                existing.designMetadata.editor,
                mockups
              )
            ) {
              throw new MerchEditorError(
                "Wait until every selected variant has a completed mockup before publishing."
              );
            }
            if (!existing.printfulFileId || !isPrintfulConfigured()) {
              throw new MerchEditorError(
                "Printful must process your artwork before publishing."
              );
            }
            const file = await getPrintfulFile(Number(existing.printfulFileId));
            if (
              file?.status !== "ok" ||
              !["image/png", "image/jpeg"].includes(file.mime_type ?? "") ||
              file.url !== existing.designFileUrl ||
              file.width !== existing.designMetadata.editor.artwork.width ||
              file.height !== existing.designMetadata.editor.artwork.height
            ) {
              throw new MerchEditorError(
                "Printful has not verified this artwork yet. Check the file and try again shortly."
              );
            }
          } else if (!mockups.some((mockup) => mockup.status === "completed")) {
            throw new MerchEditorError(
              "Wait for a completed mockup before publishing."
            );
          }
        }
        const [saved] = await tx
          .update(merchDesigns)
          .set({
            ...(body.title === undefined ? {} : { title: body.title }),
            ...(body.description === undefined
              ? {}
              : { description: body.description }),
            ...(body.retailPriceCents === undefined
              ? {}
              : { retailPriceCents: body.retailPriceCents }),
            ...(body.status === undefined
              ? {}
              : {
                  publishedAt:
                    body.status === "published"
                      ? new Date()
                      : existing.publishedAt,
                  status: body.status,
                }),
            ...artworkValues,
          })
          .where(eq(merchDesigns.id, id))
          .returning();
        if (!saved) {
          throw new MerchEditorError("Unable to save the design.");
        }
        return saved;
      });
    } catch (error) {
      if (error instanceof MerchEditorError) {
        return c.json({ message: error.message }, HttpStatusCodes.BAD_REQUEST);
      }
      throw error;
    }
    if (artworkChange) {
      await enqueueDesignMockups({ merchDesignId: id });
    }
    const mockups = await db
      .select()
      .from(merchMockups)
      .where(eq(merchMockups.merchDesignId, id));
    return c.json(
      serializeDesign(
        updated,
        mockups.length,
        mockups.filter((mockup) => mockup.status === "completed").length
      ),
      HttpStatusCodes.OK
    );
  }
);

app.openapi(
  createRoute({
    method: "delete",
    path: "/designs/{id}",
    request: {
      params: z.object({ id: z.string() }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        z.object({ message: z.string() }),
        "Design archived"
      ),
      [HttpStatusCodes.BAD_REQUEST]: jsonContent(
        z.object({ message: z.string() }),
        "Database is not configured"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        z.object({ message: z.string() }),
        "Design not found"
      ),
      [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
        z.object({ message: z.string() }),
        "Authentication required"
      ),
    },
    tags: ["Merch"],
  }),
  async (c) => {
    const user = c.get("user");

    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, HttpStatusCodes.UNAUTHORIZED);
    }

    if (!isDatabaseConfigured()) {
      return c.json(
        { message: "Database is not configured." },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const db = createDb(),
      { id } = c.req.valid("param"),
      [updated] = await db
        .update(merchDesigns)
        .set({ status: "archived" })
        .where(
          and(eq(merchDesigns.id, id), eq(merchDesigns.ownerUserId, user.id))
        )
        .returning();

    if (!updated) {
      return c.json(
        { message: "Design not found." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    return c.json({ message: "Design archived." }, HttpStatusCodes.OK);
  }
);

// ---------------------------------------------------------------------------
// Kunaki physical media shipping quote (#408 — unchanged)
// ---------------------------------------------------------------------------

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

      if (!release.kunakiProductId) {
        return c.json(
          {
            message: `Release "${release.title}" (${release.mediaFormat}) does not have an active Kunaki product ID configured.`,
          },
          HttpStatusCodes.BAD_REQUEST
        );
      }

      kunakiItems.push({
        productId: release.kunakiProductId,
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

// ---------------------------------------------------------------------------
// Retry mockups for an owned design, without resetting completed/pending tasks.
app.openapi(
  createRoute({
    method: "post",
    path: "/designs/{id}/retry-mockups",
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: jsonContent(
        z.object({ success: z.boolean() }),
        "Mockup retry queued"
      ),
      401: jsonContent(messageResponseSchema, "Authentication required"),
      404: jsonContent(messageResponseSchema, "Design not found"),
    },
    tags: ["Merch"],
  }),
  async (c) => {
    const user = c.get("user");
    if (!isAuthenticatedUser(user)) {
      return c.json(unauthorizedMessage, 401);
    }
    const db = createDb();
    const { id } = c.req.valid("param");
    const [design] = await db
      .select()
      .from(merchDesigns)
      .where(
        and(eq(merchDesigns.id, id), eq(merchDesigns.ownerUserId, user.id))
      )
      .limit(1);
    if (!design) {
      return c.json({ message: "Design not found." }, 404);
    }
    if (
      design.designMetadata?.editor &&
      !design.printfulFileId &&
      design.designFileUrl
    ) {
      const id = await registerDesignFile({
        designFileUrl: design.designFileUrl,
        filename: design.designFileObjectKey.split("/").pop() ?? "artwork",
      });
      if (id)
        {await db
          .update(merchDesigns)
          .set({ printfulFileId: String(id) })
          .where(eq(merchDesigns.id, design.id));}
    }
    await db
      .update(merchMockups)
      .set({ error: null, printfulTaskId: null, status: "queued" })
      .where(
        and(
          eq(merchMockups.merchDesignId, id),
          eq(merchMockups.status, "failed")
        )
      );
    await enqueueDesignMockups({ merchDesignId: id });
    return c.json({ success: true }, 200);
  }
);

// Public merch storefront (fan-facing, no auth required)
// ---------------------------------------------------------------------------

const publicMerchQuerySchema = z.object({
  artistUsername: z.string().trim().max(120).optional(),
  catalogProductId: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(24),
  projectId: z.string().trim().optional(),
  trackId: z.string().trim().optional(),
});

app.openapi(
  createRoute({
    method: "get",
    path: "/public",
    request: {
      query: publicMerchQuerySchema,
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        z.array(z.record(z.string(), z.unknown())),
        "Published merch designs with mockups and variants"
      ),
    },
    tags: ["Merch"],
  }),
  async (c) => {
    const query = c.req.valid("query"),
      merch = await listPublicMerch({
        artistUsername: query.artistUsername,
        catalogProductId: query.catalogProductId,
        limit: query.limit,
        projectId: query.projectId,
        trackId: query.trackId,
      });

    return c.json(merch, HttpStatusCodes.OK);
  }
);

const PHYSICAL_MEDIA_FORMATS = ["cd", "dvd", "vinyl_12", "vinyl_7"] as const,
  publicPhysicalSiblingFormatSchema = z.object({
    id: z.string(),
    includesDigitalDownload: z.boolean(),
    mediaFormat: z.enum(["digital", ...PHYSICAL_MEDIA_FORMATS]),
    retailPriceCents: z.number().int(),
    title: z.string(),
  }),
  publicPhysicalReleaseSchema = z.object({
    artistName: z.string().nullable(),
    artistUsername: z.string().nullable(),
    coverArtUrl: z.string().nullable(),
    createdAt: z.string(),
    currency: z.string(),
    description: z.string().nullable(),
    genreName: z.string().nullable(),
    genreSlug: z.string().nullable(),
    id: z.string(),
    includesDigitalDownload: z.boolean(),
    mediaFormat: z.enum(PHYSICAL_MEDIA_FORMATS),
    projectId: z.string().nullable(),
    projectTitle: z.string().nullable(),
    retailPriceCents: z.number().int(),
    siblingFormats: z.array(publicPhysicalSiblingFormatSchema),
    title: z.string(),
    trackId: z.string().nullable(),
    videoId: z.string().nullable(),
  }),
  publicPhysicalReleasesQuerySchema = z.object({
    artistUsername: z.string().trim().max(120).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(48),
    mediaFormat: z.enum(PHYSICAL_MEDIA_FORMATS).optional(),
    projectId: z.string().trim().optional(),
    trackId: z.string().trim().optional(),
    videoId: z.string().trim().optional(),
  });

app.openapi(
  createRoute({
    method: "get",
    path: "/public/physical-releases",
    request: {
      query: publicPhysicalReleasesQuerySchema,
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        z.array(publicPhysicalReleaseSchema),
        "Published physical releases (Vinyl, CD, DVD) with artwork and sibling formats"
      ),
    },
    tags: ["Merch"],
  }),
  async (c) => {
    const query = c.req.valid("query"),
      releases = await listPublicPhysicalReleases({
        artistUsername: query.artistUsername,
        limit: query.limit,
        mediaFormat: query.mediaFormat,
        projectId: query.projectId,
        trackId: query.trackId,
        videoId: query.videoId,
      });

    return c.json(releases, HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/public/physical-releases/{releaseId}",
    request: {
      params: z.object({ releaseId: z.string() }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        publicPhysicalReleaseSchema,
        "Single published physical release"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        z.object({ message: z.string() }),
        "Physical release not found or not published"
      ),
    },
    tags: ["Merch"],
  }),
  async (c) => {
    const { releaseId } = c.req.valid("param"),
      releases = await listPublicPhysicalReleases({
        limit: 1,
        releaseId,
      });

    const release = releases[0];
    if (!release) {
      return c.json(
        { message: "Physical release not found or not published." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    return c.json(release, HttpStatusCodes.OK);
  }
);

app.openapi(
  createRoute({
    method: "get",
    path: "/public/{designId}",
    request: {
      params: z.object({ designId: z.string() }),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        z.record(z.string(), z.unknown()),
        "Single published merch design"
      ),
      [HttpStatusCodes.NOT_FOUND]: jsonContent(
        z.object({ message: z.string() }),
        "Design not found or not published"
      ),
    },
    tags: ["Merch"],
  }),
  async (c) => {
    const { designId } = c.req.valid("param"),
      merch = await listPublicMerch({
        designId,
        limit: 1,
      });

    if (merch.length === 0) {
      return c.json(
        { message: "Design not found or not published." },
        HttpStatusCodes.NOT_FOUND
      );
    }

    return c.json(merch[0], HttpStatusCodes.OK);
  }
);

// ---------------------------------------------------------------------------
// Printful shipping rates (POST /v1/merch/shipping-rates)
// ---------------------------------------------------------------------------

const shippingRatesBodySchema = z.object({
  items: z
    .array(
      z.object({
        printfulVariantId: z.string().min(1),
        quantity: z.number().int().min(1).max(100),
      })
    )
    .min(1)
    .max(20),
  recipient: z.object({
    address1: z.string().min(1).max(200),
    address2: z.string().max(200).optional(),
    city: z.string().min(1).max(100),
    countryCode: z.string().length(2),
    // Printful treats state_code as optional for countries without a
    // state/province (UK, much of the EU, etc.)
    stateCode: z.string().min(2).max(2).optional(),
    zip: z.string().min(3).max(20),
  }),
});

app.openapi(
  createRoute({
    method: "post",
    path: "/shipping-rates",
    request: {
      body: jsonContentRequired(
        shippingRatesBodySchema,
        "Printful shipping rate request"
      ),
    },
    responses: {
      [HttpStatusCodes.OK]: jsonContent(
        shippingQuoteResponseSchema,
        "Available Printful shipping options with EDD"
      ),
      [HttpStatusCodes.BAD_REQUEST]: jsonContent(
        z.object({ message: z.string() }),
        "Invalid request or no available rates"
      ),
      [HttpStatusCodes.SERVICE_UNAVAILABLE]: jsonContent(
        z.object({ message: z.string() }),
        "Printful is not configured"
      ),
      [HttpStatusCodes.BAD_GATEWAY]: jsonContent(
        z.object({ message: z.string() }),
        "Printful rates failed"
      ),
    },
    tags: ["Merch"],
  }),
  async (c) => {
    if (!isPrintfulConfigured()) {
      return c.json(
        {
          message:
            "Printful is not configured. Merch shipping is only available in production.",
        },
        HttpStatusCodes.SERVICE_UNAVAILABLE
      );
    }

    const body = c.req.valid("json");

    try {
      const rates = await calculatePrintfulShippingRates({
        items: body.items.map((item) => ({
          catalog_variant_id: Number(item.printfulVariantId),
          quantity: item.quantity,
        })),
        recipient: {
          address1: body.recipient.address1,
          address2: body.recipient.address2,
          city: body.recipient.city,
          country_code: body.recipient.countryCode.toUpperCase(),
          state_code: body.recipient.stateCode?.toUpperCase(),
          zip: body.recipient.zip,
        },
      });

      if (rates.length === 0) {
        return c.json(
          { message: "No shipping options available for this address." },
          HttpStatusCodes.BAD_REQUEST
        );
      }

      const formatDeliveryTime = (rate: (typeof rates)[number]) => {
        if (rate.min_delivery_days && rate.max_delivery_days) {
          return `${rate.min_delivery_days}-${rate.max_delivery_days} business days`;
        }

        if (rate.max_delivery_date && rate.min_delivery_date) {
          return `arrives ${rate.min_delivery_date} — ${rate.max_delivery_date}`;
        }

        return "Standard delivery";
      };

      // Normalize into the same response shape as the Kunaki shipping-quote
      // so one rate-selector component serves both providers.
      const options = rates.map((rate) => ({
          code: rate.shipping,
          deliveryTimeDescription: formatDeliveryTime(rate),
          description: rate.shipping_method_name,
          priceCents: printfulPriceToCents(rate.rate),
        })),
        recommended = options[0] ?? null;

      return c.json(
        {
          currency: rates[0]?.currency ?? "USD",
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
              : "Failed to get Printful shipping rates.",
        },
        HttpStatusCodes.BAD_GATEWAY
      );
    }
  }
);

export default app;
