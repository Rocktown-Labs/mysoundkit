/* eslint-disable sort-vars, one-var, complexity */
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  orderItems,
  orders,
  purchases,
  userNotifications,
} from "@soundkit/db/schema/app";
import { physicalReleases } from "@soundkit/db/schema/commerce";
import {
  merchDesigns,
  merchFulfillments,
  orderShippingSelections,
} from "@soundkit/db/schema/fulfillment";
import { WorkflowEntrypoint } from "cloudflare:workers";
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { and, eq, inArray, isNotNull } from "drizzle-orm";

import type { EmailDeliveryQueueMessage } from "@/lib/email-delivery";
import { notifyPurchaseEmails } from "@/lib/email-events";
import { createKunakiClient } from "@/lib/kunaki";
import { confirmPrintfulOrder, createPrintfulDraftOrder } from "@/lib/printful";
import { logError, logInfo, logWarn } from "@/middleware/structured-logging";

interface PurchaseFulfillmentPayload {
  orderId: string;
}

const stepRetryConfig = {
    retries: {
      delay: "30 seconds" as const,
      limit: 5,
    },
    timeout: "5 minutes" as const,
  },
  fulfillmentInstanceId = (orderId: string) => `purchase_${orderId}`;

export const purchaseFulfillmentWorkflowInstanceId = fulfillmentInstanceId;

/**
 * Launch (or reuse) the durable fulfillment instance for an order. Safe to
 * call on every Stripe webhook re-delivery.
 */
export const ensurePurchaseFulfillmentWorkflow = async ({
  orderId,
  workflow,
}: {
  orderId: string;
  workflow: null | Workflow<PurchaseFulfillmentPayload> | undefined;
}): Promise<{ launched: boolean }> => {
  if (!workflow) {
    return { launched: false };
  }

  const instanceId = fulfillmentInstanceId(orderId);

  try {
    await workflow.createBatch([
      {
        id: instanceId,
        params: { orderId },
        retention: {
          errorRetention: "30 days",
          successRetention: "30 days",
        },
      },
    ]);
    return { launched: true };
  } catch {
    // Deterministic IDs throw on duplicates in some engine versions; reuse
    // the existing instance instead.
    try {
      await workflow.get(instanceId);
      return { launched: true };
    } catch {
      return { launched: false };
    }
  }
};

/**
 * Durable post-payment fulfillment. Triggered by the Stripe webhook after the
 * order is marked paid; every step is idempotent so webhook re-deliveries and
 * step retries never duplicate purchases or emails.
 */
export class PurchaseFulfillmentWorkflow extends WorkflowEntrypoint<
  Env,
  PurchaseFulfillmentPayload
> {
  public async run(
    event: WorkflowEvent<PurchaseFulfillmentPayload>,
    step: WorkflowStep
  ) {
    const { orderId } = event.payload;

    if (!isDatabaseConfigured()) {
      return { fulfilled: false as const, reason: "no_database" };
    }

    const emailQueue = (
        this.env as unknown as {
          EMAIL_DELIVERY_QUEUE?: Queue<EmailDeliveryQueueMessage>;
        }
      ).EMAIL_DELIVERY_QUEUE,
      isPaid = await step.do("verify order paid", async () => {
        const db = createDb(),
          [order] = await db
            .select({ status: orders.status })
            .from(orders)
            .where(eq(orders.id, orderId))
            .limit(1);

        return order?.status === "paid";
      });

    if (!isPaid) {
      // Terminal: the webhook only launches fulfillment for paid orders.
      return { fulfilled: false as const, reason: "order_not_paid" };
    }

    await step.do("grant purchases", stepRetryConfig, async () => {
      const db = createDb(),
        items = await db
          .select()
          .from(orderItems)
          .where(eq(orderItems.orderId, orderId)),
        [order] = await db
          .select({ buyerUserId: orders.buyerUserId })
          .from(orders)
          .where(eq(orders.id, orderId))
          .limit(1);

      if (!(order?.buyerUserId && items.length > 0)) {
        return;
      }

      await db
        .insert(purchases)
        .values(
          items.map((item) => ({
            buyerUserId: order.buyerUserId,
            id: crypto.randomUUID(),
            orderItemId: item.id,
            projectId: item.projectId,
            trackId: item.trackId,
            videoId: item.videoId,
          }))
        )
        .onConflictDoNothing();
    });

    const physicalOrderResult = await step.do(
      "submit physical order to kunaki",
      async () => {
        const db = createDb(),
          [order] = await db
            .select()
            .from(orders)
            .where(eq(orders.id, orderId))
            .limit(1);

        if (!order || order.kunakiOrderId) {
          return { kunakiOrderId: order?.kunakiOrderId ?? null, skipped: true };
        }

        const physicalItems = await db
          .select()
          .from(orderItems)
          .where(
            and(
              eq(orderItems.orderId, orderId),
              isNotNull(orderItems.physicalReleaseId)
            )
          );

        if (physicalItems.length === 0) {
          return { kunakiOrderId: null, skipped: true };
        }

        if (
          !order.shippingName ||
          !order.shippingAddress1 ||
          !order.shippingCity ||
          !order.shippingPostalCode ||
          !order.shippingCountry
        ) {
          logWarn({
            event: "kunaki_fulfillment_missing_address",
            message:
              "Cannot fulfill Kunaki order: shipping address missing on order.",
            orderId,
          });
          await db
            .update(orders)
            .set({ fulfillmentStatus: "failed" })
            .where(eq(orders.id, orderId));
          return { kunakiOrderId: null, skipped: true };
        }

        const releaseIds = physicalItems
            .map((item) => item.physicalReleaseId)
            .filter((id): id is string => Boolean(id)),
          releaseRows =
            releaseIds.length > 0
              ? await db
                  .select()
                  .from(physicalReleases)
                  .where(inArray(physicalReleases.id, releaseIds))
              : [],
          releaseMap = new Map(releaseRows.map((r) => [r.id, r])),
          kunakiItems: { productId: string; quantity: number }[] = [];

        for (const item of physicalItems) {
          const release = item.physicalReleaseId
            ? releaseMap.get(item.physicalReleaseId)
            : null;

          if (!release?.kunakiProductId) {
            logError({
              event: "kunaki_fulfillment_missing_product_id",
              message: `Cannot fulfill Kunaki order: release ${item.physicalReleaseId ?? "unknown"} has no Kunaki product ID configured for format ${release?.mediaFormat ?? "unknown"}.`,
              orderId,
            });
            await db
              .update(orders)
              .set({ fulfillmentStatus: "failed" })
              .where(eq(orders.id, orderId));
            return { kunakiOrderId: null, skipped: true };
          }

          kunakiItems.push({
            productId: release.kunakiProductId,
            quantity: item.quantity,
          });
        }

        // Persist an in-flight marker before initiating outbound API call
        if (order.fulfillmentStatus !== "kunaki_processing") {
          await db
            .update(orders)
            .set({ fulfillmentStatus: "kunaki_processing" })
            .where(eq(orders.id, orderId));
        }

        const kunaki = createKunakiClient();
        try {
          const kunakiOrderId = await kunaki.createOrder({
            address1: order.shippingAddress1,
            address2: order.shippingAddress2 ?? undefined,
            city: order.shippingCity,
            country: order.shippingCountry,
            items: kunakiItems,
            name: order.shippingName,
            postalCode: order.shippingPostalCode,
            shippingDescription:
              order.shippingDescription ?? "USPS First Class Mail",
            stateProvince: order.shippingStateProvince ?? undefined,
          });

          return { kunakiOrderId, skipped: false };
        } catch (error) {
          logError({
            error: error instanceof Error ? error.message : String(error),
            event: "kunaki_order_failed",
            orderId,
          });
          await db
            .update(orders)
            .set({ fulfillmentStatus: "failed" })
            .where(eq(orders.id, orderId));
          throw error;
        }
      }
    );

    if (physicalOrderResult?.kunakiOrderId) {
      await step.do(
        "record kunaki order confirmation",
        stepRetryConfig,
        async () => {
          const db = createDb();
          await db
            .update(orders)
            .set({
              fulfillmentStatus: "kunaki_processing",
              kunakiOrderId: physicalOrderResult.kunakiOrderId,
            })
            .where(eq(orders.id, orderId));

          logInfo({
            event: "kunaki_order_created",
            kunakiOrderId: physicalOrderResult.kunakiOrderId,
            orderId,
          });
        }
      );
    }

    // Printful merch dispatch (apparel/accessories) — creates a draft order,
    // waits for costs, confirms. Idempotent: skips if a printfulOrderId
    // already exists on the fulfillment record.
    await step.do(
      "dispatch printful merch order",
      stepRetryConfig,
      async () => {
        const db = createDb(),
          [existingFulfillment] = await db
            .select()
            .from(merchFulfillments)
            .where(eq(merchFulfillments.orderId, orderId))
            .limit(1);

        if (existingFulfillment?.printfulOrderId) {
          return {
            printfulOrderId: existingFulfillment.printfulOrderId,
            skipped: true,
          };
        }

        const merchItems = await db
          .select()
          .from(orderItems)
          .where(
            and(
              eq(orderItems.orderId, orderId),
              isNotNull(orderItems.merchDesignId)
            )
          );

        if (merchItems.length === 0) {
          return { printfulOrderId: null, skipped: true };
        }

        const [order] = await db
          .select()
          .from(orders)
          .where(eq(orders.id, orderId))
          .limit(1);

        if (!order?.shippingAddress1 || !order.shippingCity) {
          logWarn({
            event: "printful_dispatch_missing_address",
            orderId,
          });
          return { printfulOrderId: null, skipped: true };
        }

        // Build Printful order items from the merch designs + variants.
        const designIds = [
            ...new Set(merchItems.map((item) => item.merchDesignId)),
          ].filter((id): id is string => Boolean(id)),
          designRows = await db
            .select({
              designFileUrl: merchDesigns.designFileUrl,
              id: merchDesigns.id,
              placement: merchDesigns.placement,
              technique: merchDesigns.technique,
            })
            .from(merchDesigns)
            .where(inArray(merchDesigns.id, designIds)),
          designMap = new Map(designRows.map((d) => [d.id, d])),
          [shippingSelection] = await db
            .select()
            .from(orderShippingSelections)
            .where(
              and(
                eq(orderShippingSelections.orderId, orderId),
                eq(orderShippingSelections.provider, "printful")
              )
            )
            .limit(1),
          printfulItems = merchItems
            .filter(
              (item) =>
                item.printfulVariantId &&
                designMap.has(item.merchDesignId as string)
            )
            .map((item) => {
              const design = designMap.get(item.merchDesignId as string);

              return {
                catalog_variant_id: Number(item.printfulVariantId),
                external_id: item.id,
                name: item.titleSnapshot,
                placements: [
                  {
                    layers: [
                      {
                        type: "file",
                        url: design?.designFileUrl ?? "",
                      },
                    ],
                    placement: design?.placement ?? "front",
                    technique: design?.technique ?? "dtg",
                  },
                ],
                quantity: item.quantity,
                retail_price: String(item.priceSnapshot),
              };
            });

        if (printfulItems.length === 0) {
          logWarn({
            event: "printful_dispatch_no_valid_items",
            orderId,
          });
          return { printfulOrderId: null, skipped: true };
        }

        const fulfillmentId = existingFulfillment?.id ?? crypto.randomUUID();

        if (!existingFulfillment) {
          await db.insert(merchFulfillments).values({
            externalId: orderId,
            id: fulfillmentId,
            orderId,
            status: "draft",
          });
        }

        // Mark in-flight before the outbound API call.
        await db
          .update(orders)
          .set({ fulfillmentStatus: "printful_processing" })
          .where(eq(orders.id, orderId));

        const draftOrder = await createPrintfulDraftOrder({
          externalId: orderId,
          items: printfulItems,
          recipient: {
            address1: order.shippingAddress1,
            address2: order.shippingAddress2 ?? "",
            city: order.shippingCity,
            country_code: (order.shippingCountry ?? "US").toUpperCase(),
            name: order.shippingName ?? "",
            state_code: (order.shippingStateProvince ?? "").toUpperCase(),
            zip: order.shippingPostalCode ?? "",
          },
          shippingMethod: shippingSelection?.optionCode,
        });

        if (!draftOrder?.id) {
          throw new Error("Printful returned no draft order id.");
        }

        await db
          .update(merchFulfillments)
          .set({
            printfulCosts: draftOrder.costs as unknown as Record<
              string,
              unknown
            >,
            printfulOrderId: String(draftOrder.id),
          })
          .where(eq(merchFulfillments.id, fulfillmentId));

        logInfo({
          event: "printful_draft_order_created",
          orderId,
          printfulOrderId: draftOrder.id,
        });

        return { printfulOrderId: String(draftOrder.id), skipped: false };
      }
    );

    // Confirm the Printful order after costs are calculated.
    await step.do("confirm printful order", async () => {
      const db = createDb(),
        [fulfillment] = await db
          .select()
          .from(merchFulfillments)
          .where(eq(merchFulfillments.orderId, orderId))
          .limit(1);

      if (!fulfillment?.printfulOrderId || fulfillment.status !== "draft") {
        return { confirmed: false, reason: "no_pending_draft" };
      }

      await confirmPrintfulOrder(Number(fulfillment.printfulOrderId));

      await db
        .update(merchFulfillments)
        .set({
          confirmedAt: new Date(),
          lastSyncedAt: new Date(),
          status: "confirmed",
        })
        .where(eq(merchFulfillments.id, fulfillment.id));

      logInfo({
        event: "printful_order_confirmed",
        orderId,
        printfulOrderId: fulfillment.printfulOrderId,
      });

      return { confirmed: true };
    });

    await step.do("send purchase delivery emails", stepRetryConfig, () =>
      notifyPurchaseEmails({ orderId, queue: emailQueue })
    );

    await step.do("send in-app notifications", stepRetryConfig, async () => {
      const db = createDb(),
        [order] = await db
          .select({
            buyerUserId: orders.buyerUserId,
            sellerUserId: orders.sellerUserId,
          })
          .from(orders)
          .where(eq(orders.id, orderId))
          .limit(1);

      if (!order?.buyerUserId) {
        return;
      }

      const [firstPurchase] = await db
        .select({ id: purchases.id })
        .from(purchases)
        .innerJoin(orderItems, eq(orderItems.id, purchases.orderItemId))
        .where(eq(orderItems.orderId, orderId))
        .limit(1);

      await db
        .insert(userNotifications)
        .values([
          {
            id: `purchase_ready:${orderId}:${order.buyerUserId}`,
            link: firstPurchase
              ? `/library/purchased/${firstPurchase.id}`
              : "/library/purchased",
            message: "Your purchase is ready in your SoundKit library.",
            title: "Purchase Ready",
            type: "purchase_ready",
            userId: order.buyerUserId,
          },
          ...(order.sellerUserId
            ? [
                {
                  id: `sale_notification:${orderId}:${order.sellerUserId}`,
                  link: "/dashboard/career/payments",
                  message: "You made a new sale on SoundKit.",
                  title: "New Sale",
                  type: "sale_notification",
                  userId: order.sellerUserId,
                },
              ]
            : []),
        ])
        .onConflictDoNothing();
    });

    return { fulfilled: true as const };
  }
}
