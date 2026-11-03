/* eslint-disable one-var */
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { orders } from "@soundkit/db/schema/app";
import { transactions } from "@soundkit/db/schema/payments";
import { and, asc, eq, lt } from "drizzle-orm";
import { z } from "zod";

import { logInfo, logWarn } from "@/middleware/structured-logging";

import { stripeRequest } from "./stripe";

const STALE_CHECKOUT_HOURS = 24;
const intentSchema = z.object({
  id: z.string().regex(/^pi_/u),
  status: z.string(),
});
const sessionSchema = z.object({
  id: z.string().regex(/^cs_/u),
  payment_intent: z.union([z.string().regex(/^pi_/u), intentSchema]).nullable(),
  payment_status: z.enum(["paid", "unpaid", "no_payment_required"]),
  status: z.enum(["open", "complete", "expired"]),
});
interface Candidate {
  id: string;
  orderSessionId: string | null;
  sessionId: string | null;
  transactionId: string;
}
type Database = Pick<ReturnType<typeof createDb>, "select" | "transaction">;

/** Provider reads never hold a database lock or create a payment side effect. */
async function expiredIntent(
  candidate: Candidate,
  signal: AbortSignal
): Promise<string | null | false> {
  if (
    !candidate.sessionId ||
    (candidate.orderSessionId &&
      candidate.orderSessionId !== candidate.sessionId)
  ) {
    return false;
  }
  const session = sessionSchema.parse(
    await stripeRequest<unknown>({
      method: "GET",
      params: new URLSearchParams({ "expand[]": "payment_intent" }),
      path: `/checkout/sessions/${encodeURIComponent(candidate.sessionId)}`,
      signal,
    })
  );
  if (
    session.id !== candidate.sessionId ||
    session.status !== "expired" ||
    session.payment_status !== "unpaid"
  ) {
    return false;
  }
  if (!session.payment_intent) {
    return null;
  }
  const intent =
    typeof session.payment_intent === "string"
      ? intentSchema.parse(
          await stripeRequest<unknown>({
            method: "GET",
            path: `/payment_intents/${encodeURIComponent(session.payment_intent)}`,
            signal,
          })
        )
      : session.payment_intent;
  const expectedId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent.id;
  return intent.id === expectedId && intent.status === "canceled"
    ? intent.id
    : false;
}

async function closeExpiredCheckout(
  db: Database,
  candidate: Candidate,
  intentId: string | null,
  cutoff: Date,
  now: Date
) {
  return await db.transaction(async (tx) => {
    // Match settlement/refund lock ordering: payment first, then order.
    const [payment] = await tx
      .select()
      .from(transactions)
      .where(eq(transactions.id, candidate.transactionId))
      .for("update");
    if (
      !payment ||
      payment.status !== "pending" ||
      payment.stripeCheckoutSessionId !== candidate.sessionId ||
      (payment.stripePaymentIntentId &&
        payment.stripePaymentIntentId !== intentId)
    ) {
      return false;
    }
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, candidate.id))
      .for("update");
    if (
      !order ||
      order.status !== "checkout_pending" ||
      order.transactionId !== candidate.transactionId ||
      order.createdAt >= cutoff ||
      (order.stripeCheckoutSessionId &&
        order.stripeCheckoutSessionId !== candidate.sessionId) ||
      (order.stripePaymentIntentId && order.stripePaymentIntentId !== intentId)
    ) {
      return false;
    }
    await tx
      .update(transactions)
      .set({ status: "failed", updatedAt: now })
      .where(
        and(eq(transactions.id, payment.id), eq(transactions.status, "pending"))
      );
    await tx
      .update(orders)
      .set({ status: "failed" })
      .where(
        and(eq(orders.id, order.id), eq(orders.status, "checkout_pending"))
      );
    return true;
  });
}

/** Close only provider-confirmed expired checkouts, never payments inferred from age. */
export const runCheckoutReconciliation = async ({
  now = new Date(),
}: { now?: Date } = {}): Promise<{ abandoned: number; skipped: boolean }> => {
  if (!isDatabaseConfigured()) {
    return { abandoned: 0, skipped: true };
  }
  const cutoff = new Date(
      now.getTime() - STALE_CHECKOUT_HOURS * 60 * 60 * 1000
    ),
    db = createDb(),
    staleOrders = await db
      .select({
        id: orders.id,
        orderSessionId: orders.stripeCheckoutSessionId,
        sessionId: transactions.stripeCheckoutSessionId,
        transactionId: transactions.id,
      })
      .from(orders)
      .innerJoin(transactions, eq(transactions.id, orders.transactionId))
      .where(
        and(
          eq(orders.status, "checkout_pending"),
          eq(transactions.status, "pending"),
          lt(orders.createdAt, cutoff)
        )
      )
      .orderBy(asc(orders.createdAt), asc(orders.id))
      .limit(50);
  let abandoned = 0;
  const sweepDeadline = AbortSignal.timeout(45_000);
  for (const order of staleOrders) {
    if (sweepDeadline.aborted) {
      logWarn({ event: "stale_checkout_reconciliation_budget_exhausted" });
      break;
    }
    try {
      const signal = AbortSignal.any([
        sweepDeadline,
        AbortSignal.timeout(5000),
      ]);
      const intentId = await expiredIntent(order, signal);
      if (
        intentId !== false &&
        (await closeExpiredCheckout(db, order, intentId, cutoff, now))
      ) {
        abandoned += 1;
      }
    } catch {
      // Never expose provider payloads or database credentials through cron logs.
      logWarn({
        event: "stale_checkout_reconciliation_deferred",
        orderId: order.id,
      });
    }
  }
  if (abandoned > 0) {
    logInfo({ abandoned, event: "stale_checkouts_reconciled" });
  }
  return { abandoned, skipped: false };
};
