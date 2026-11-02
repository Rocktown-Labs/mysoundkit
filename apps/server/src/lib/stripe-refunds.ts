/* oxlint-disable one-var, sort-vars -- Keep dependent Stripe reads explicit. */
import { createDb } from "@soundkit/db";
import { orders } from "@soundkit/db/schema/app";
import { paymentRefunds, transactions } from "@soundkit/db/schema/payments";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { stripeRequest } from "./stripe";

const reference = z
  .union([z.string(), z.object({ id: z.string() })])
  .transform((value) => (typeof value === "string" ? value : value.id));
const chargeSchema = z.object({
  amount: z.number().int().positive(),
  captured: z.boolean(),
  currency: z.string().regex(/^[a-z]{3}$/iu),
  id: z.string().regex(/^ch_/u),
  metadata: z.record(z.string(), z.string()).optional(),
  paid: z.boolean(),
  payment_intent: reference.nullable(),
});
const refundSchema = z.object({
  amount: z.number().int().positive(),
  charge: reference.nullable(),
  currency: z.string().regex(/^[a-z]{3}$/iu),
  id: z.string().regex(/^re_/u),
  payment_intent: reference.nullable(),
  reason: z.string().nullish(),
  status: z.enum([
    "pending",
    "requires_action",
    "succeeded",
    "failed",
    "canceled",
  ]),
});
const listSchema = z.object({
  data: z.array(refundSchema),
  has_more: z.boolean(),
});
const refundEvents = new Set([
  "charge.refunded",
  "charge.refund.updated",
  "refund.created",
  "refund.updated",
  "refund.failed",
]);
type RefundDatabase = Pick<
  ReturnType<typeof createDb>,
  "select" | "transaction"
>;
type Charge = z.infer<typeof chargeSchema>;
type Refund = z.infer<typeof refundSchema>;

export const isStripeRefundEvent = (eventType: string) =>
  refundEvents.has(eventType);

async function readSnapshot(
  id: string,
  eventType: string,
  connectedAccountId?: string
) {
  let direct: Refund | undefined;
  let chargeId = id;
  if (eventType !== "charge.refunded") {
    direct = refundSchema.parse(
      await stripeRequest<unknown>({
        connectedAccountId,
        method: "GET",
        path: `/refunds/${encodeURIComponent(id)}`,
      })
    );
    if (!direct.charge) {
      return null;
    }
    if (direct.id !== id) {
      throw new Error("Stripe refund identity mismatch");
    }
    chargeId = direct.charge;
  }
  const charge = chargeSchema.parse(
    await stripeRequest<unknown>({
      connectedAccountId,
      method: "GET",
      path: `/charges/${encodeURIComponent(chargeId)}`,
    })
  );
  if (charge.id !== chargeId) {
    throw new Error("Stripe refund charge identity mismatch");
  }
  return { charge, direct };
}

async function confirmedRefunds(
  charge: Charge,
  direct: Refund | undefined,
  connectedAccountId?: string
) {
  const refunds = new Map<string, Refund>();
  const cursors = new Set<string>();
  let cursor: string | undefined;
  for (;;) {
    const params = new URLSearchParams({ charge: charge.id, limit: "100" });
    if (cursor) {
      params.set("starting_after", cursor);
    }
    const page = listSchema.parse(
      await stripeRequest<unknown>({
        connectedAccountId,
        method: "GET",
        params,
        path: "/refunds",
      })
    );
    for (const refund of page.data) {
      refunds.set(refund.id, refund);
    }
    if (!page.has_more) {
      break;
    }
    const next = page.data.at(-1)?.id;
    if (!next || cursors.has(next)) {
      throw new Error("Stripe refund pagination did not advance");
    }
    cursors.add(next);
    cursor = next;
  }
  // Read the event's Refund again after pagination so an older event or
  // a status change during these reads cannot override the latest object.
  if (direct) {
    const current = refundSchema.parse(
      await stripeRequest<unknown>({
        connectedAccountId,
        method: "GET",
        path: `/refunds/${encodeURIComponent(direct.id)}`,
      })
    );
    if (current.id !== direct.id || current.charge !== charge.id) {
      throw new Error("Stripe refund identity changed during reconciliation");
    }
    refunds.set(current.id, current);
  }
  const succeeded = [...refunds.values()].filter(
    (refund) => refund.status === "succeeded"
  );
  for (const refund of succeeded) {
    if (
      refund.charge !== charge.id ||
      refund.payment_intent !== charge.payment_intent ||
      refund.currency.toUpperCase() !== charge.currency.toUpperCase()
    ) {
      throw new Error("Stripe refund does not match its charge");
    }
  }
  if (
    succeeded.reduce((total, refund) => total + refund.amount, 0) >
    charge.amount
  ) {
    throw new Error("Confirmed Stripe refunds exceed the charge amount");
  }
  return {
    confirmed: succeeded,
    unconfirmed: [...refunds.values()]
      .filter((refund) => refund.status !== "succeeded")
      .map((refund) => refund.id),
  };
}

async function findTransaction(
  charge: Charge,
  db: RefundDatabase,
  connectedAccountId?: string
) {
  const matches = await db
    .select()
    .from(transactions)
    .where(eq(transactions.stripePaymentIntentId, charge.payment_intent ?? ""))
    .limit(2);
  if (matches.length > 1) {
    throw new Error("Stripe refund payment intent is ambiguously bound");
  }
  if (matches[0]) {
    return matches[0];
  }
  // Refunds may precede Checkout's webhook. Metadata alone is insufficient:
  // verify the stored Checkout Session actually owns this PaymentIntent.
  const metadataId = charge.metadata?.transactionId;
  if (!metadataId) {
    return;
  }
  const [candidate] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, metadataId))
    .limit(1);
  if (!candidate) {
    return;
  }
  if (!candidate.stripeCheckoutSessionId) {
    throw new Error("Refund arrived before the Checkout binding was saved");
  }
  const session = z.object({ payment_intent: reference.nullable() }).parse(
    await stripeRequest<unknown>({
      connectedAccountId,
      method: "GET",
      path: `/checkout/sessions/${encodeURIComponent(candidate.stripeCheckoutSessionId)}`,
    })
  );
  if (session.payment_intent !== charge.payment_intent) {
    throw new Error("Refund Checkout Session does not own the payment intent");
  }
  return candidate;
}

/** Reads Stripe and records facts only. Never refunds, transfers or fulfills. */
export async function syncConfirmedStripeRefunds({
  id,
  eventType,
  connectedAccountId,
  db = createDb(),
}: {
  id: string;
  eventType: string;
  connectedAccountId?: string;
  db?: RefundDatabase;
}): Promise<{ recorded: number; fullRefund: boolean }> {
  const snapshot = await readSnapshot(id, eventType, connectedAccountId);
  if (!snapshot?.charge.payment_intent) {
    return { fullRefund: false, recorded: 0 };
  }
  const { charge, direct } = snapshot;
  const transaction = await findTransaction(charge, db, connectedAccountId);
  if (!transaction) {
    return { fullRefund: false, recorded: 0 };
  }
  const { confirmed: refunds, unconfirmed } = await confirmedRefunds(
    charge,
    direct,
    connectedAccountId
  );
  const total = refunds.reduce((sum, refund) => sum + refund.amount, 0);
  return await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(transactions)
      .where(eq(transactions.id, transaction.id))
      .for("update");
    if (
      !current ||
      current.amountCents !== charge.amount ||
      current.currency.toUpperCase() !== charge.currency.toUpperCase() ||
      (current.stripePaymentIntentId &&
        current.stripePaymentIntentId !== charge.payment_intent)
    ) {
      throw new Error(
        "Stripe refund transaction amount/currency/binding mismatch"
      );
    }
    if (!charge.paid || !charge.captured) {
      throw new Error("Refund charge is not a captured payment");
    }
    for (const refundId of unconfirmed) {
      const [existing] = await tx
        .select({ id: paymentRefunds.id })
        .from(paymentRefunds)
        .where(eq(paymentRefunds.stripeRefundId, refundId))
        .limit(1);
      if (existing) {
        throw new Error(
          "A recorded Stripe refund is no longer successful; manual reconciliation required"
        );
      }
    }
    // Preserve the paid fact when a full refund arrives before Checkout's event.
    // All writes commit together, including outbox triggers when installed.
    if (current.status === "pending" && refunds.length > 0) {
      await tx
        .update(transactions)
        .set({
          status: "succeeded",
          stripePaymentIntentId: charge.payment_intent,
        })
        .where(eq(transactions.id, current.id));
    }
    let recorded = 0;
    for (const refund of refunds) {
      const inserted = await tx
        .insert(paymentRefunds)
        .values({
          amountCents: refund.amount,
          id: crypto.randomUUID(),
          reason: refund.reason,
          stripeRefundId: refund.id,
          transactionId: current.id,
        })
        .onConflictDoNothing({ target: paymentRefunds.stripeRefundId })
        .returning({ id: paymentRefunds.id });
      if (inserted.length === 0) {
        const [existing] = await tx
          .select()
          .from(paymentRefunds)
          .where(eq(paymentRefunds.stripeRefundId, refund.id))
          .limit(1);
        if (
          !existing ||
          existing.transactionId !== current.id ||
          existing.amountCents !== refund.amount
        ) {
          throw new Error("Existing refund fact conflicts with Stripe");
        }
      }
      recorded += inserted.length;
    }
    const fullRefund = total === current.amountCents && total > 0;
    if (fullRefund) {
      await tx
        .update(transactions)
        .set({
          status: "refunded",
          stripePaymentIntentId: charge.payment_intent,
        })
        .where(eq(transactions.id, current.id));
      await tx
        .update(orders)
        .set({ status: "refunded" })
        .where(eq(orders.transactionId, current.id));
    }
    return { fullRefund, recorded };
  });
}
