import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  orderItems,
  orders,
  purchases,
  userNotifications,
} from "@soundkit/db/schema/app";
import { WorkflowEntrypoint } from "cloudflare:workers";
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { eq } from "drizzle-orm";

import type { EmailDeliveryQueueMessage } from "@/lib/email-delivery";
import { notifyPurchaseEmails } from "@/lib/email-events";

interface PurchaseFulfillmentPayload { orderId: string }

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
    const {orderId} = event.payload;

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
