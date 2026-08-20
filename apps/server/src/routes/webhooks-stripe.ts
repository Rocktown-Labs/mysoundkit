/* eslint-disable complexity, unicorn/max-nested-calls, sort-vars, one-var, no-nested-ternary, unicorn/no-nested-ternary, unicorn/no-await-expression-member, unicorn/no-negated-condition, unicorn/prefer-number-properties, unicorn/prefer-ternary, no-shadow */
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  orderItems,
  orders,
  purchases,
  sellerAccounts,
  userNotifications,
} from "@soundkit/db/schema/app";
import {
  communityMembers,
  communitySubscriptions,
} from "@soundkit/db/schema/communities";
import {
  paymentRefunds,
  stripeWebhookEvents,
  transactions,
} from "@soundkit/db/schema/payments";
import { env } from "@soundkit/env/server";
import { and, eq } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import jsonContent from "stoker/openapi/helpers/json-content";

import { resolveCommunitySubscriptionStatus } from "@/lib/community-subscriptions";
import type { EmailDeliveryQueueMessage } from "@/lib/email-delivery";
import {
  notifyBillingIssueEmail,
  notifyPayoutFailedEmail,
  notifyPurchaseEmails,
} from "@/lib/email-events";
import {
  retrieveStripeCharge,
  reverseStripeTransfer,
  verifyStripeSignatureWithSecrets,
} from "@/lib/stripe";
import type { AppEnv } from "@/lib/types";

const app = new OpenAPIHono<AppEnv>(),
  getEnvValue = (key: string) =>
    (env as unknown as Record<string, string | undefined>)[key]?.trim() ?? "";

interface StripeObject {
  account?: string;
  amount?: number;
  capabilities?: Record<string, string>;
  charges_enabled?: boolean;
  charge?: string;
  configuration?: {
    recipient?: {
      capabilities?: {
        stripe_balance?: {
          stripe_transfers?: {
            status?: string;
          };
        };
      };
    };
  };
  current_period_end?: number;
  customer?: string;
  details_submitted?: boolean;
  id?: string;
  metadata?: Record<string, string>;
  payment_intent?: string;
  payouts_enabled?: boolean;
  requirements?: {
    currently_due?: string[];
    entries?: { field?: string }[];
    eventually_due?: string[];
    past_due?: string[];
  };
  status?: string;
  subscription?: string;
}

interface StripeEvent {
  account?: string;
  data?: { object?: StripeObject };
  id?: string;
  type?: string;
}

const processConnectAccountEvent = async ({
    accountId,
    emailQueue,
    eventType,
    object,
  }: {
    accountId: string;
    emailQueue?: Queue<EmailDeliveryQueueMessage> | null;
    eventType: string;
    object: StripeObject;
  }) => {
    const db = createDb();

    if (eventType === "account.application.deauthorized") {
      await db
        .update(sellerAccounts)
        .set({
          chargesEnabled: false,
          detailsSubmitted: false,
          onboardingStatus: "not_started",
          payoutsEnabled: false,
          requirementsDue: [],
        })
        .where(eq(sellerAccounts.stripeAccountId, accountId));
      return;
    }

    const v2TransferStatus =
        object.configuration?.recipient?.capabilities?.stripe_balance
          ?.stripe_transfers?.status,
      chargesEnabled = object.charges_enabled ?? v2TransferStatus === "active",
      payoutsEnabled = object.payouts_enabled ?? v2TransferStatus === "active",
      detailsSubmitted =
        object.details_submitted ??
        (chargesEnabled || object.requirements?.currently_due?.length === 0),
      requirementsDue = [
        ...(object.requirements?.currently_due ?? []),
        ...(object.requirements?.past_due ?? []),
        ...(object.requirements?.entries
          ?.map((entry) => entry.field)
          .filter(Boolean) ?? []),
      ] as string[],
      onboardingStatus =
        chargesEnabled && payoutsEnabled
          ? ("enabled" as const)
          : requirementsDue.length > 0
            ? ("restricted" as const)
            : detailsSubmitted
              ? ("pending" as const)
              : ("not_started" as const);

    await db
      .update(sellerAccounts)
      .set({
        chargesEnabled,
        detailsSubmitted,
        onboardingStatus,
        payoutsEnabled,
        requirementsDue,
      })
      .where(eq(sellerAccounts.stripeAccountId, accountId));

    if (requirementsDue.length > 0 || !payoutsEnabled) {
      const [seller] = await db
        .select({ userId: sellerAccounts.userId })
        .from(sellerAccounts)
        .where(eq(sellerAccounts.stripeAccountId, accountId))
        .limit(1);

      if (seller?.userId) {
        await db
          .insert(userNotifications)
          .values({
            id: `payout_action_required:${accountId}`,
            link: "/dashboard/settings/payouts",
            message:
              "Your payout account has verification requirements due. Update your details to continue receiving payouts.",
            title: "Payout Details Needed",
            type: "payout_action_required",
            userId: seller.userId,
          })
          .onConflictDoNothing();

        await notifyPayoutFailedEmail({
          failureReason:
            requirementsDue.join(", ") || "Verification details required",
          queue: emailQueue,
          recipientUserId: seller.userId,
        });
      }
    }
  },
  processCommunitySubscription = async ({
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

    const db = createDb(),
      status = resolveCommunitySubscriptionStatus({
        currentPeriodEndSeconds: object.current_period_end,
        eventType,
        stripeStatus: object.status,
      }),
      currentPeriodEnd = object.current_period_end
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
  },
  processStripeEvent = async ({
    emailQueue,
    event,
  }: {
    emailQueue?: Queue<EmailDeliveryQueueMessage> | null;
    event: StripeEvent;
  }) => {
    const eventType = event.type ?? "unknown",
      object = event.data?.object ?? {},
      transactionId = object.metadata?.transactionId,
      db = createDb();

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
          const { buyerUserId } = order,
            purchasedItems = await db
              .select()
              .from(orderItems)
              .where(eq(orderItems.orderId, order.id)),
            purchaseRows = purchasedItems.map((item) => ({
              buyerUserId,
              id: crypto.randomUUID(),
              orderItemId: item.id,
              projectId: item.projectId,
              trackId: item.trackId,
              videoId: item.videoId,
            }));

          if (purchaseRows.length > 0) {
            await db
              .insert(purchases)
              .values(purchaseRows)
              .onConflictDoNothing();
          }

          await notifyPurchaseEmails({
            orderId: order.id,
            queue: emailQueue,
          });

          await db
            .insert(userNotifications)
            .values({
              id: `purchase_ready:${order.id}:${buyerUserId}`,
              link: purchaseRows[0]?.id
                ? `/library/purchased/${purchaseRows[0].id}`
                : "/library/purchased",
              message: "Your purchase is ready in your SoundKit library.",
              title: "Purchase Ready",
              type: "purchase_ready",
              userId: buyerUserId,
            })
            .onConflictDoNothing();

          if (order.sellerUserId) {
            await db
              .insert(userNotifications)
              .values({
                id: `sale_notification:${order.id}:${order.sellerUserId}`,
                link: "/dashboard/sales",
                message: "You made a new sale on SoundKit.",
                title: "New Sale",
                type: "sale_notification",
                userId: order.sellerUserId,
              })
              .onConflictDoNothing();
          }
        }
      }

      return;
    }

    if (
      eventType === "invoice.payment_failed" ||
      (eventType === "customer.subscription.updated" &&
        (object.status === "past_due" || object.status === "unpaid"))
    ) {
      await notifyBillingIssueEmail({
        queue: emailQueue,
        stripeCustomerId: object.customer,
        stripeSubscriptionId: object.subscription ?? object.id,
        userId: object.metadata?.userId,
      });

      let targetUserId = object.metadata?.userId;
      if (!targetUserId && object.customer) {
        const [subRow] = await db
          .select({ userId: communitySubscriptions.userId })
          .from(communitySubscriptions)
          .where(eq(communitySubscriptions.stripeCustomerId, object.customer))
          .limit(1);
        targetUserId = subRow?.userId;
      }

      if (targetUserId) {
        await db
          .insert(userNotifications)
          .values({
            id: `billing_issue:${object.id ?? object.subscription ?? targetUserId}`,
            link: "/dashboard/billing",
            message:
              "A subscription payment could not be processed. Please update your payment method to keep your access active.",
            title: "Payment Issue",
            type: "billing_issue",
            userId: targetUserId,
          })
          .onConflictDoNothing();
      }
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

    const connectAccountId =
      event.account ??
      (eventType.startsWith("account.") || eventType.startsWith("capability.")
        ? object.id
        : undefined);

    if (
      connectAccountId &&
      (eventType === "account.updated" ||
        eventType === "account.application.authorized" ||
        eventType === "account.application.deauthorized" ||
        eventType === "capability.updated")
    ) {
      await processConnectAccountEvent({
        accountId: connectAccountId,
        emailQueue,
        eventType,
        object,
      });
      return;
    }

    if (eventType === "charge.dispute.created" && object.charge) {
      const charge = await retrieveStripeCharge(object.charge).catch(
          () => null
        ),
        transactionId = charge?.metadata?.transactionId;
      if (transactionId) {
        await db
          .update(transactions)
          .set({ status: "failed" })
          .where(eq(transactions.id, transactionId));
      }
      if (charge?.transfer) {
        await reverseStripeTransfer(charge.transfer).catch(() => null);
      }
      return;
    }

    if (eventType === "charge.refunded" && object.id) {
      const [transaction] = object.payment_intent
        ? await db
            .select()
            .from(transactions)
            .where(
              eq(transactions.stripePaymentIntentId, object.payment_intent)
            )
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
    const payload = await c.req.raw.text(),
      signature = c.req.raw.headers.get("stripe-signature");

    if (
      !(await verifyStripeSignatureWithSecrets({
        payload,
        secrets: [
          getEnvValue("STRIPE_COMMERCE_WEBHOOK_SECRET"),
          getEnvValue("STRIPE_CONNECT_WEBHOOK_SECRET"),
          getEnvValue("STRIPE_WEBHOOK_SECRET"),
        ],
        signature,
      }))
    ) {
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

    const db = createDb(),
      [existing] = await db
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

    await processStripeEvent({
      emailQueue: c.env.EMAIL_DELIVERY_QUEUE,
      event,
    });
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
