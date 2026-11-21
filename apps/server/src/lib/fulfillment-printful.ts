import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  merchCatalogProducts,
  merchCatalogVariants,
  merchDesigns,
  merchMockups,
} from "@soundkit/db/schema/fulfillment";
import { and, asc, eq, inArray, isNull, lt } from "drizzle-orm";

import { merchProductionPlacement } from "@/lib/merch-production";
import {
  createPrintfulMockupTask,
  getPrintfulMockupTask,
  isPrintfulConfigured,
  registerPrintfulFile,
  getPrintfulMockupStyles,
} from "@/lib/printful";
import { logWarn } from "@/middleware/structured-logging";

/**
 * Registers the artist's print file with Printful's file library, then
 * returns the Printful file id. If registration fails (e.g., non-production
 * preview without the token), the design still saves — fulfillment will
 * fail closed at order time rather than silently shipping the wrong file.
 */
export const registerDesignFile = async ({
  designFileUrl,
  filename,
}: {
  designFileUrl: string;
  filename: string;
}) => {
  if (!isPrintfulConfigured()) {
    return null;
  }

  try {
    const file = await registerPrintfulFile({ filename, url: designFileUrl });

    return file?.id ?? null;
  } catch (error) {
    logWarn({
      error: error instanceof Error ? error.message : String(error),
      event: "printful_file_registration_failed",
      url: designFileUrl.slice(0, 100),
    });
    return null;
  }
};

/**
 * Enqueues mockup generation for every in-stock variant of the design's
 * blank. Creates merch_mockups rows in "queued" status — the CF queue
 * consumer submits the actual Printful tasks below the 2-10/min ceiling,
 * and the mockup_task_finished webhook (or the poll sweep) flips them to
 * "completed" with the generated URL.
 */
export const enqueueDesignMockups = async ({
  merchDesignId,
}: {
  merchDesignId: string;
}) => {
  const db = createDb(),
    [design] = await db
      .select()
      .from(merchDesigns)
      .where(eq(merchDesigns.id, merchDesignId))
      .limit(1);

  if (!design?.printfulCatalogProductId) {
    return { enqueued: 0 };
  }

  const [product, variants] = await Promise.all([
    db
      .select()
      .from(merchCatalogProducts)
      .where(eq(merchCatalogProducts.id, design.printfulCatalogProductId))
      .limit(1),
    db
      .select()
      .from(merchCatalogVariants)
      .where(
        and(
          eq(
            merchCatalogVariants.catalogProductId,
            design.printfulCatalogProductId
          ),
          eq(merchCatalogVariants.inStock, true)
        )
      ),
  ]);

  if (!product[0] || variants.length === 0) {
    return { enqueued: 0 };
  }

  const existingMockups = await db
      .select({
        catalogVariantId: merchMockups.catalogVariantId,
      })
      .from(merchMockups)
      .where(eq(merchMockups.merchDesignId, merchDesignId)),
    existingVariantIds = new Set(
      existingMockups.map((m) => m.catalogVariantId)
    ),
    newVariants = variants.filter(
      (v) =>
        !existingVariantIds.has(v.id) &&
        (!design.designMetadata?.editor ||
          design.designMetadata.editor.variantIds.includes(v.id))
    );

  for (const variant of newVariants) {
    await db.insert(merchMockups).values({
      catalogVariantId: variant.id,
      id: crypto.randomUUID(),
      merchDesignId,
      status: "queued",
    });
  }

  return { enqueued: newVariants.length };
};

/**
 * Submits a single queued mockup row to Printful. Called by the CF queue
 * consumer (which runs at maxConcurrency: 1 to stay under the 2-10/min
 * task-creation ceiling) and by the admin re-generation endpoint.
 */
export const submitQueuedMockup = async ({
  mockupId,
}: {
  mockupId: string;
}) => {
  const db = createDb(),
    [mockup] = await db
      .select()
      .from(merchMockups)
      .where(eq(merchMockups.id, mockupId))
      .limit(1);

  if (!mockup || mockup.status !== "queued") {
    return { submitted: false };
  }

  const [design] = await db
    .select()
    .from(merchDesigns)
    .where(eq(merchDesigns.id, mockup.merchDesignId))
    .limit(1);

  if (!design?.printfulCatalogProductId || !design.designFileUrl) {
    await db
      .update(merchMockups)
      .set({
        error: "Design has no catalog binding or print file URL.",
        status: "failed",
      })
      .where(eq(merchMockups.id, mockupId));
    return { submitted: false };
  }

  const [product] = await db
    .select()
    .from(merchCatalogProducts)
    .where(eq(merchCatalogProducts.id, design.printfulCatalogProductId))
    .limit(1);

  if (!product) {
    await db
      .update(merchMockups)
      .set({ error: "Catalog product not found in cache.", status: "failed" })
      .where(eq(merchMockups.id, mockupId));
    return { submitted: false };
  }

  const candidates = await db
      .select({ id: merchMockups.id })
      .from(merchMockups)
      .where(
        and(
          eq(merchMockups.merchDesignId, design.id),
          eq(merchMockups.status, "queued")
        )
      )
      .limit(50),
    claimed = candidates.length
      ? await db
          .update(merchMockups)
          .set({ status: "pending", updatedAt: new Date() })
          .where(
            and(
              inArray(
                merchMockups.id,
                candidates.map((row) => row.id)
              ),
              eq(merchMockups.status, "queued")
            )
          )
          .returning()
      : [];
  if (!claimed.length) {
    return { submitted: false };
  }
  const claimedIds = claimed.map((row) => row.id);
  try {
    const placement = (product.placements as Record<string, unknown>[]).find(
        (p) => p.placement === design.placement
      ),
      groups = design.designMetadata?.editor
        ? await getPrintfulMockupStyles(Number(product.id))
        : [],
      mockupStyleIds = design.designMetadata?.editor
        ? (groups
            .find(
              (group) =>
                group.placement === design.placement &&
                group.technique === design.technique
            )
            ?.mockup_styles?.map((style) => style.id) ?? [])
        : (product.mockupStyleIds ?? []);
    if (!placement || mockupStyleIds.length === 0) {
      throw new Error(`No mockup styles for placement "${design.placement}".`);
    }
    const task = await createPrintfulMockupTask({
      products: [
        {
          catalog_product_id: Number(design.printfulCatalogProductId),
          catalog_variant_ids: claimed.map((row) =>
            Number(row.catalogVariantId)
          ),
          mockup_style_ids: mockupStyleIds,
          placements: [merchProductionPlacement(design)],
          source: "catalog",
        },
      ],
    });

    if (!task?.id) {
      throw new Error("Printful returned no mockup task id.");
    }

    await db
      .update(merchMockups)
      .set({ printfulTaskId: String(task.id), status: "pending" })
      .where(inArray(merchMockups.id, claimedIds));

    return { submitted: true, taskId: task.id };
  } catch (error) {
    await db
      .update(merchMockups)
      .set({
        error: error instanceof Error ? error.message : String(error),
        status: "failed",
      })
      .where(inArray(merchMockups.id, claimedIds));
    return { submitted: false };
  }
};

/**
 * Checks a pending mockup task against Printful. Called by the poll sweep
 * and the mockup_task_finished webhook.
 */
export const checkPendingMockupTask = async ({
  printfulTaskId,
}: {
  printfulTaskId: string;
}) => {
  const db = createDb(),
    rows = await db
      .select()
      .from(merchMockups)
      .where(
        and(
          eq(merchMockups.printfulTaskId, printfulTaskId),
          eq(merchMockups.status, "pending")
        )
      );
  if (!rows.length) {
    return { updated: false };
  }
  const task = await getPrintfulMockupTask(Number(printfulTaskId));
  if (!task) {
    return { updated: false };
  }
  for (const mockup of rows) {
    if (task.status === "completed") {
      const image = task.catalog_variant_mockups.find(
        (variant) =>
          String(variant.catalog_variant_id) === mockup.catalogVariantId
      )?.mockups?.[0],
       url = image?.mockup_url ?? image?.url;
      await db
        .update(merchMockups)
        .set(
          url
            ? { error: null, mockupUrl: url, status: "completed" }
            : {
                error: "The provider returned no mockup for this variant.",
                status: "failed",
              }
        )
        .where(eq(merchMockups.id, mockup.id));
    } else if (task.status === "failed") {
      await db
        .update(merchMockups)
        .set({
          error:
            task.failure_reasons
              .map((reason) =>
                typeof reason === "string"
                  ? reason
                  : (reason.detail ?? "Mockup generation failed")
              )
              .join("; ") || "Printful mockup generation failed.",
          status: "failed",
        })
        .where(eq(merchMockups.id, mockup.id));
    } else {
      await db
        .update(merchMockups)
        .set({ updatedAt: new Date() })
        .where(eq(merchMockups.id, mockup.id));
    }
  }
  return { updated: task.status !== "pending" };
};

/**
 * Scheduled sweep: finds pending mockup tasks that haven't been updated
 * recently and polls Printful for their status. This is the webhook safety
 * net — if Printful's mockup_task_finished webhook never arrives, the
 * mockup still completes.
 */
export const runMockupPollSweep = async () => {
  if (!(isDatabaseConfigured() && isPrintfulConfigured())) {
    return { polled: 0 };
  }

  const db = createDb();
  // Recover a claimed task whose worker exited before persisting its task ID.
  await db
    .update(merchMockups)
    .set({ status: "queued", updatedAt: new Date() })
    .where(
      and(
        eq(merchMockups.status, "pending"),
        isNull(merchMockups.printfulTaskId),
        lt(merchMockups.updatedAt, new Date(Date.now() - 10 * 60_000))
      )
    );
  for (let batch = 0; batch < 2; batch += 1) {
    const [row] = await db
      .select({ id: merchMockups.id })
      .from(merchMockups)
      .where(eq(merchMockups.status, "queued"))
      .orderBy(asc(merchMockups.updatedAt))
      .limit(1);
    if (!row) {break;}
    await submitQueuedMockup({ mockupId: row.id });
  }
  const staleMockups = await db
    .select({ printfulTaskId: merchMockups.printfulTaskId })
    .from(merchMockups)
    .where(eq(merchMockups.status, "pending"))
    .orderBy(asc(merchMockups.updatedAt))
    .limit(5);

  let polled = 0;

  const checked = new Set<string>();
  for (const mockup of staleMockups) {
    if (!mockup.printfulTaskId || checked.has(mockup.printfulTaskId)) {
      continue;
    }

    checked.add(mockup.printfulTaskId);
    try {
      await checkPendingMockupTask({ printfulTaskId: mockup.printfulTaskId });
      polled += 1;
    } catch (error) {
      logWarn({
        error: error instanceof Error ? error.message : String(error),
        event: "printful_mockup_poll_failed",
        taskId: mockup.printfulTaskId,
      });
    }
  }

  return { polled };
};
