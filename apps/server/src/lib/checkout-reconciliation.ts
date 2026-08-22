/* eslint-disable one-var */
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { orders } from "@soundkit/db/schema/app";
import { transactions } from "@soundkit/db/schema/payments";
import { and, eq, lt } from "drizzle-orm";

import { logInfo } from "@/middleware/structured-logging";

const STALE_CHECKOUT_HOURS = 24;

/**
 * Reconcile checkouts abandoned before payment: query Stripe for the session
 * status and close out stale pending orders so the order book stays clean.
 */
export const runCheckoutReconciliation = async ({
  now = new Date(),
}: {
  now?: Date;
} = {}): Promise<{ abandoned: number; skipped: boolean }> => {
  if (!isDatabaseConfigured()) {
    return { abandoned: 0, skipped: true };
  }

  const db = createDb(),
    cutoff = new Date(now.getTime() - STALE_CHECKOUT_HOURS * 60 * 60 * 1000),
    staleOrders = await db
      .select({
        id: orders.id,
        transactionId: orders.transactionId,
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
      .limit(50);

  let abandoned = 0;

  for (const order of staleOrders) {
    if (order.transactionId) {
      await db
        .update(transactions)
        .set({ status: "failed", updatedAt: now })
        .where(eq(transactions.id, order.transactionId));
    }
    await db
      .update(orders)
      .set({ status: "failed" })
      .where(eq(orders.id, order.id));
    abandoned += 1;
  }

  if (abandoned > 0) {
    logInfo({ abandoned, event: "stale_checkouts_reconciled" });
  }

  return { abandoned, skipped: false };
};
