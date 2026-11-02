/* eslint-disable one-var, sort-vars */
import { createDb } from "@soundkit/db";
import { sql } from "drizzle-orm";

import { logInfo, logWarn } from "@/middleware/structured-logging";

import type { AnalyticsDatabase } from "./analytics-outbox";

/** Observation only: never transfers funds, fulfills an order, or repairs access. */
export async function reconcileAnalytics(
  environment: string,
  db: AnalyticsDatabase = createDb(),
  cursor?: { createdAt: string; id: string }
) {
  // capture() v1 emits orders:<id>:order_paid and purchases:<id>:access_granted.
  // Strip only the known prefix/suffix; IDs may themselves contain colons.
  // These immutable source-key formats must change with a versioned producer.
  const result = await db.execute(sql`
    WITH captured AS (
      SELECT source_key,event_type FROM soundkit_analytics.events
      WHERE environment=${environment} AND occurred_at>=now()-interval '30 days'
        AND event_type IN ('order_paid','access_granted')
    ), candidates AS (
      SELECT left(right(source_key,-length('orders:')),-length(':order_paid')) AS id
        FROM captured WHERE event_type='order_paid'
      UNION
      SELECT i.order_id FROM captured e
        JOIN public.purchases p ON p.id=left(right(e.source_key,-length('purchases:')),-length(':access_granted'))
        JOIN public.order_items i ON i.id=p.order_item_id WHERE e.event_type='access_granted'
    ), recent AS (
      SELECT o.id,o.status,o.total_cents,o.currency,o.transaction_id,o.created_at FROM public.orders o
      JOIN candidates c ON c.id=o.id
      WHERE (${cursor?.createdAt ?? null}::timestamp IS NULL OR
        (o.created_at,o.id)<(${cursor?.createdAt ?? null}::timestamp,${cursor?.id ?? ""}))
      ORDER BY o.created_at DESC,o.id DESC LIMIT 501
    ), checked AS (SELECT * FROM recent LIMIT 500)
    SELECT (SELECT count(*)::int FROM checked) AS checked_orders,
      (SELECT count(*)>500 FROM recent) AS truncated,
      CASE WHEN (SELECT count(*)>500 FROM recent) THEN
        (SELECT json_build_object('createdAt',to_char(created_at,'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'id',id) FROM checked ORDER BY created_at,id LIMIT 1)
        ELSE NULL END AS next_cursor,
      count(DISTINCT o.id) FILTER (WHERE o.status='paid' AND o.total_cents>0
        AND (t.id IS NULL OR t.status NOT IN ('succeeded','refunded')))::int AS paid_without_settled_transaction,
      count(DISTINCT o.id) FILTER (WHERE t.status='succeeded' AND o.total_cents IS NOT NULL
        AND (o.total_cents<>t.amount_cents OR upper(o.currency)<>upper(t.currency)))::int AS amount_currency_mismatches,
      count(DISTINCT i.id) FILTER (WHERE o.status='paid' AND i.product_type IN ('track','project','video')
        AND i.physical_release_id IS NULL AND p.id IS NULL)::int AS missing_digital_access,
      count(DISTINCT p.id) FILTER (WHERE o.status NOT IN ('paid','refunded'))::int AS access_without_paid_order
    FROM checked o LEFT JOIN public.transactions t ON t.id=o.transaction_id
    LEFT JOIN public.order_items i ON i.order_id=o.id
    LEFT JOIN public.purchases p ON p.order_item_id=i.id
  `);
  const [summary] = result.rows;
  logInfo({ event: "analytics_reconciliation", ...summary });
  if (
    Number(summary?.paid_without_settled_transaction) +
      Number(summary?.amount_currency_mismatches) +
      Number(summary?.missing_digital_access) +
      Number(summary?.access_without_paid_order) >
    0
  ) {
    logWarn({ event: "analytics_reconciliation_mismatch", ...summary });
  }
  if (summary?.truncated) {
    logWarn({
      checked_orders: summary.checked_orders,
      event: "analytics_reconciliation_truncated",
    });
  }
  return summary;
}

/** Observed account cohorts only; anonymous Traks is deliberately unrelated. */
export async function analyticsRetention(
  environment: string,
  db: AnalyticsDatabase = createDb()
) {
  const result = await db.execute(sql`
    SELECT s.cohort_day::text, count(DISTINCT s.id)::int AS accounts,
      s.cohort_day<=(now() AT TIME ZONE 'UTC')::date-1 AS day_1_mature,
      s.cohort_day<=(now() AT TIME ZONE 'UTC')::date-7 AS day_7_mature,
      s.cohort_day<=(now() AT TIME ZONE 'UTC')::date-30 AS day_30_mature,
      count(DISTINCT s.id) FILTER (WHERE a.day=s.cohort_day+1)::int AS day_1,
      count(DISTINCT s.id) FILTER (WHERE a.day=s.cohort_day+7)::int AS day_7,
      count(DISTINCT s.id) FILTER (WHERE a.day=s.cohort_day+30)::int AS day_30
    FROM soundkit_analytics.subjects s
    LEFT JOIN soundkit_analytics.activity a ON a.user_id=s.user_id AND a.environment=${environment}
    WHERE s.cohort_day>=(now() AT TIME ZONE 'UTC')::date-90 AND s.cohort_day >=
      (SELECT (installed_at AT TIME ZONE 'UTC')::date FROM soundkit_analytics.version WHERE version=1)
      AND s.registration_environment=${environment}
    GROUP BY s.cohort_day ORDER BY s.cohort_day DESC LIMIT 90
  `);
  return result.rows;
}

export async function analyticsDailyActivity(environment: string) {
  const result = await createDb().execute(sql`
    SELECT day::text,count(DISTINCT user_id)::int AS accounts FROM soundkit_analytics.activity
    WHERE environment=${environment} AND day>=(now() AT TIME ZONE 'UTC')::date-90
    GROUP BY day ORDER BY day DESC LIMIT 91
  `);
  return result.rows;
}
