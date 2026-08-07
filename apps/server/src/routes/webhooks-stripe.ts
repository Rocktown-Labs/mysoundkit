import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { orderItems, orders, purchases } from "@soundkit/db/schema/app";
import {
  communityMembers,
  communitySubscriptions,
} from "@soundkit/db/schema/communities";
import {
  paymentRefunds,
  stripeWebhookEvents,
  transactions,
} from "@soundkit/db/schema/payments";
import { and, eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";

import { resolveCommunitySubscriptionStatus } from "@/lib/community-subscriptions";
import { verifyStripeSignature } from "@/lib/stripe";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>();

interface StripeObject {
  amount?: number;
  current_period_end?: number;
  customer?: string;
  id?: string;
  metadata?: Record<string, string>;
  payment_intent?: string;
  status?: string;
  subscription?: string;
}

interface StripeEvent {
  data?: { object?: StripeObject };
  id?: string;
  type?: string;
}

const processCommunitySubscription = async ({
  eventType,
  object,
}: {
  eventType: string;
  object: StripeObject;
}) => {
  const communitySubscriptionId = object.metadata?.communitySubscriptionId;

  if (!communitySubscriptionId) {
    return;
  }

  const db = createDb();
  const status = resolveCommunitySubscriptionStatus({
    currentPeriodEndSeconds: object.current_period_end,
    eventType,
    stripeStatus: object.status,
  });
  const currentPeriodEnd = object.current_period_end
    ? new Date(object.current_period_end * 1000)
    : null;

  await db
    .update(communitySubscriptions)
    .set({
      currentPeriodEnd,
      status,
      stripeCustomerId: object.customer,
      stripeSubscriptionId: object.id,
    })
    .where(eq(communitySubscriptions.id, communitySubscriptionId));

  if (status === "active") {
    const [subscription] = await db
      .select()
      .from(communitySubscriptions)
      .where(eq(communitySubscriptions.id, communitySubscriptionId))
      .limit(1);

    if (subscription) {
      await db
        .insert(communityMembers)
        .values({
          communityId: subscription.communityId,
          role: "member",
          userId: subscription.userId,
        })
        .onConflictDoNothing();
    }
  }
};

const processStripeEvent = async (event: StripeEvent) => {
  const eventType = event.type ?? "unknown";
  const object = event.data?.object ?? {};
  const transactionId = object.metadata?.transactionId;
  const db = createDb();

  if (eventType === "checkout.session.completed") {
    if (transactionId) {
      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.transactionId, transactionId))
        .limit(1);

      await db
        .update(transactions)
        .set({
          status: "succeeded",
          stripePaymentIntentId: object.payment_intent,
          stripeSubscriptionId: object.subscription,
        })
        .where(eq(transactions.id, transactionId));
      await db
        .update(orders)
        .set({
          status: "paid",
          stripePaymentIntentId: object.payment_intent,
        })
        .where(eq(orders.transactionId, transactionId));

      if (order?.buyerUserId) {
        const purchasedItems = await db
          .select()
          .from(orderItems)
          .where(eq(orderItems.orderId, order.id));

        if (purchasedItems.length > 0) {
          await db
            .insert(purchases)
            .values(
              purchasedItems.map((item) => ({
                buyerUserId: order.buyerUserId,
                id: crypto.randomUUID(),
                orderItemId: item.id,
                projectId: item.projectId,
                trackId: item.trackId,
                videoId: item.videoId,
              }))
            )
            .onConflictDoNothing();
        }
      }
    }

    return;
  }

  if (
    eventType === "customer.subscription.created" ||
    eventType === "customer.subscription.updated" ||
    eventType === "customer.subscription.deleted"
  ) {
    await processCommunitySubscription({ eventType, object });
    return;
  }

  if (
    eventType === "coupon.created" ||
    eventType === "coupon.updated" ||
    eventType === "coupon.deleted"
  ) {
    console.info(
      `Stripe webhook coupon event received: ${eventType} (${object.id})`
    );
    return;
  }

  if (eventType === "charge.refunded" && object.id) {
    const [transaction] = object.payment_intent
      ? await db
          .select()
          .from(transactions)
          .where(eq(transactions.stripePaymentIntentId, object.payment_intent))
          .limit(1)
      : [];

    if (transaction) {
      await db.insert(paymentRefunds).values({
        amountCents: object.amount ?? transaction.amountCents,
        id: crypto.randomUUID(),
        stripeRefundId: object.id,
        transactionId: transaction.id,
      });
      await db
        .update(transactions)
        .set({ status: "refunded" })
        .where(eq(transactions.id, transaction.id));
    }
  }
};

app.openapi(
  createRoute({
    method: "post",
    path: "/",
    responses: {
      [HttpStatusCodes.BAD_REQUEST]: jsonContent(
        z.object({ message: z.string() }),
        "Invalid Stripe signature"
      ),
      [HttpStatusCodes.OK]: jsonContent(
        z.object({ message: z.string() }),
        "Stripe webhook accepted"
      ),
    },
    tags: ["Webhooks"],
  }),
  async (c) => {
    const payload = await c.req.raw.text();
    const signature = c.req.raw.headers.get("stripe-signature");

    if (!(await verifyStripeSignature({ payload, signature }))) {
      return c.json(
        { message: "Invalid Stripe webhook signature." },
        HttpStatusCodes.BAD_REQUEST
      );
    }

    const event = JSON.parse(payload) as StripeEvent;

    if (!(isDatabaseConfigured() && event.id)) {
      return c.json(
        { message: "Stripe webhook accepted." },
        HttpStatusCodes.OK
      );
    }

    const db = createDb();
    const [existing] = await db
      .select({ id: stripeWebhookEvents.id })
      .from(stripeWebhookEvents)
      .where(eq(stripeWebhookEvents.stripeEventId, event.id))
      .limit(1);

    if (existing) {
      return c.json(
        { message: "Stripe webhook already processed." },
        HttpStatusCodes.OK
      );
    }

    const eventRowId = crypto.randomUUID();
    await db.insert(stripeWebhookEvents).values({
      eventType: event.type ?? "unknown",
      id: eventRowId,
      payload: event as unknown as Record<string, unknown>,
      stripeEventId: event.id,
    });

    await processStripeEvent(event);
    await db
      .update(stripeWebhookEvents)
      .set({ processedAt: new Date(), status: "processed" })
      .where(
        and(
          eq(stripeWebhookEvents.id, eventRowId),
          eq(stripeWebhookEvents.stripeEventId, event.id)
        )
      );

    return c.json({ message: "Stripe webhook accepted." }, HttpStatusCodes.OK);
  }
);

export default app;
