import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  merchCatalogProducts,
  merchCatalogVariants,
  merchDesigns,
  merchMockups,
} from "@soundkit/db/schema/fulfillment";
import { and, asc, eq, isNull, lt } from "drizzle-orm";

import { merchProductionPlacement } from "@/lib/merch-production";
import {
  createPrintfulMockupTask,
  getPrintfulMockupTask,
  getPrintfulMockupStyles,
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

  const [claimed] = await db
    .update(merchMockups)
    .set({ status: "pending", updatedAt: new Date() })
    .where(
      and(eq(merchMockups.id, mockupId), eq(merchMockups.status, "queued"))
    )
    .returning();
  if (!claimed) {return { submitted: false };}
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
    if (!placement || mockupStyleIds.length === 0)
      {throw new Error(`No mockup styles for placement "${design.placement}".`);}
    const task = await createPrintfulMockupTask({
      products: [
        {
          catalog_product_id: Number(design.printfulCatalogProductId),
          catalog_variant_ids: [Number(mockup.catalogVariantId)],
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
      .where(eq(merchMockups.id, mockupId));

    return { submitted: true, taskId: task.id };
  } catch (error) {
    await db
      .update(merchMockups)
      .set({
        error: error instanceof Error ? error.message : String(error),
        status: "failed",
      })
      .where(eq(merchMockups.id, mockupId));
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
    [mockup] = await db
      .select()
      .from(merchMockups)
      .where(eq(merchMockups.printfulTaskId, printfulTaskId))
      .limit(1);

  if (!mockup) {
    return { updated: false };
  }

  const task = await getPrintfulMockupTask(Number(printfulTaskId));

  if (!task) {
    return { updated: false };
  }

  if (task.status === "completed") {
    const variantMockup = task.catalog_variant_mockups.find(
        (v) => String(v.catalog_variant_id) === mockup.catalogVariantId
      ),
      firstUrl = variantMockup?.mockups?.[0]?.url;

    if (firstUrl) {
      await db
        .update(merchMockups)
        .set({ mockupUrl: firstUrl, status: "completed" })
        .where(eq(merchMockups.id, mockup.id));
      return { updated: true };
    }
  }

  if (task.status === "failed") {
    await db
      .update(merchMockups)
      .set({
        error:
          task.failure_reasons.join("; ") ||
          "Printful mockup generation failed.",
        status: "failed",
      })
      .where(eq(merchMockups.id, mockup.id));
    return { updated: true };
  }

  if (task.status === "pending")
    {await db
      .update(merchMockups)
      .set({ updatedAt: new Date() })
      .where(eq(merchMockups.id, mockup.id));}

  return { updated: false };
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
  const queued = await db
    .select({ id: merchMockups.id })
    .from(merchMockups)
    .where(eq(merchMockups.status, "queued"))
    .orderBy(asc(merchMockups.updatedAt))
    .limit(2);
  for (const row of queued) {await submitQueuedMockup({ mockupId: row.id });}
  const staleMockups = await db
    .select({ printfulTaskId: merchMockups.printfulTaskId })
    .from(merchMockups)
    .where(eq(merchMockups.status, "pending"))
    .orderBy(asc(merchMockups.updatedAt))
    .limit(5);

  let polled = 0;

  for (const mockup of staleMockups) {
    if (!mockup.printfulTaskId) {
      continue;
    }

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
