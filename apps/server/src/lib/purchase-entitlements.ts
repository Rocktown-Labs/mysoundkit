import { orderItems, orders, purchases } from "@soundkit/db/schema/app";
import { paymentRefunds, transactions } from "@soundkit/db/schema/payments";
import { sql } from "drizzle-orm";

/**
 * Read-only: keep history, revoke only a confirmed full transaction refund.
 * Correlates with an outer query using the unaliased purchases table.
 */
export const purchaseEntitlementCondition =
  () => sql<boolean>`not exists (select 1
  from ${orderItems}
  inner join ${orders} on ${orders.id} = ${orderItems.orderId}
  inner join ${transactions} on ${transactions.id} = ${orders.transactionId}
  where ${orderItems.id} = ${purchases.orderItemId}
    and ${transactions.status} = 'refunded'
    and ${transactions.amountCents} > 0
    and coalesce((select sum(${paymentRefunds.amountCents})
      from ${paymentRefunds}
      where ${paymentRefunds.transactionId} = ${transactions.id}
        and left(${paymentRefunds.stripeRefundId},3) = 're_'
        and ${paymentRefunds.amountCents} > 0),0) >= ${transactions.amountCents})`;
