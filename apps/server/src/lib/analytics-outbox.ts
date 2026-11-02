/* eslint-disable one-var, sort-vars, unicorn/max-nested-calls */
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { sql } from "drizzle-orm";
import { z } from "zod";

import { logInfo, logWarn } from "@/middleware/structured-logging";

import { recordDailyActivity } from "./analytics-activity";
import type { ActivityCache } from "./analytics-activity";
import { reconcileAnalytics } from "./analytics-reconciliation";

export type AnalyticsDatabase = Pick<ReturnType<typeof createDb>, "execute">;

export interface AnalyticsStream {
  send: (records: Record<string, unknown>[]) => Promise<void>;
}

export interface OutboxRow {
  id: string;
  event_type: string;
  environment: string;
  subject_id: string | null;
  occurred_at: Date | string;
  cohort_day: string | null;
  properties: unknown;
}

const eventTypes = new Set([
    "account_created",
    "account_active",
    "payment_succeeded",
    "payment_refunded",
    "order_paid",
    "access_granted",
    "media_ready",
    "media_published",
  ]),
  kinds = new Set([
    "",
    "track",
    "project",
    "video",
    "audio",
    "product_purchase",
    "tip",
    "community_subscription",
    "platform_subscription",
    "subscription",
  ]),
  moneyTypes = new Set(["payment_succeeded", "payment_refunded", "order_paid"]),
  uuid = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/iu;

function isValidEnvelope(row: OutboxRow): boolean {
  return (
    uuid.test(row.id) &&
    eventTypes.has(row.event_type) &&
    /^(?:production|pr-\d+|test)$/u.test(row.environment) &&
    (row.subject_id === null || uuid.test(row.subject_id))
  );
}

// Build every export field explicitly. Never export source keys, account IDs,
// provider payloads, URLs or arbitrary JSON even if a producer is changed.
function isValidCohort(value: string | null): boolean {
  return value === null || /^\d{4}-\d{2}-\d{2}$/u.test(value);
}

export function serializeOutboxEvent(row: OutboxRow): Record<string, unknown> {
  if (!isValidEnvelope(row)) {
    throw new Error("Invalid analytics envelope");
  }
  const props = row.properties;
  if (!props || typeof props !== "object" || Array.isArray(props)) {
    throw new Error("Invalid analytics properties");
  }
  const data = props as Record<string, unknown>,
    kind = data.kind ?? "",
    money = moneyTypes.has(row.event_type),
    amount = money ? data.amount_cents : 0,
    currency = money ? data.currency : "";
  if (
    Object.keys(data).some(
      (key) => !["kind", "amount_cents", "currency"].includes(key)
    ) ||
    typeof kind !== "string" ||
    !kinds.has(kind) ||
    !Number.isSafeInteger(amount) ||
    Number(amount) < 0 ||
    typeof currency !== "string" ||
    (money && !/^[A-Z]{3}$/u.test(currency))
  ) {
    throw new Error("Invalid analytics dimensions");
  }
  const occurredAt = new Date(row.occurred_at);
  if (
    !Number.isFinite(occurredAt.getTime()) ||
    !isValidCohort(row.cohort_day)
  ) {
    throw new Error("Invalid analytics time");
  }
  return {
    amount_cents: amount,
    cohort_day: row.cohort_day ?? "",
    currency,
    environment: row.environment,
    event_id: row.id,
    event_type: row.event_type,
    kind,
    occurred_at: occurredAt.toISOString(),
    policy_version: "internal-v1",
    producer_version: "server-outbox-v1",
    schema_version: 1,
    subject_key: row.subject_id ?? "",
  };
}

export async function recordAccountActivity(
  userId: string,
  options: { environment: string; origin: string; cache?: ActivityCache }
): Promise<void> {
  if (!isDatabaseConfigured()) {
    return;
  }
  await recordDailyActivity({
    ...options,
    onCacheError: (phase) =>
      logWarn({ event: "analytics_activity_cache_failed", phase }),
    record: async () => {
      await createDb().execute(
        sql`SELECT soundkit_analytics.record_activity(${userId})`
      );
    },
    userId,
  });
}

export async function dispatchAnalyticsOutbox({
  stream,
  environment,
  db,
}: {
  stream?: AnalyticsStream;
  environment?: string;
  db?: AnalyticsDatabase;
}): Promise<{ delivered: number; rejected: number; skipped: boolean }> {
  if (!stream || !environment || (!db && !isDatabaseConfigured())) {
    return { delivered: 0, rejected: 0, skipped: true };
  }
  const database = db ?? createDb(),
    lease = crypto.randomUUID(),
    claimed = await database.execute(sql`
      WITH due AS (
        SELECT id FROM soundkit_analytics.events
        WHERE environment=${environment} AND delivered_at IS NULL AND quarantined_at IS NULL
          AND available_at <= now() AND (leased_until IS NULL OR leased_until < now())
        ORDER BY available_at,id FOR UPDATE SKIP LOCKED LIMIT 100
      )
      UPDATE soundkit_analytics.events e SET lease_id=${lease}::uuid,
        leased_until=now()+interval '2 minutes', attempts=attempts+1
      FROM due WHERE e.id=due.id
      RETURNING e.id,e.event_type,e.environment,e.subject_id,e.occurred_at,e.properties,
        (SELECT cohort_day::text FROM soundkit_analytics.subjects s WHERE s.id=e.subject_id) AS cohort_day
    `);
  const valid: { id: string; record: Record<string, unknown> }[] = [];
  let rejected = 0;
  const rowSchema = z.object({
    cohort_day: z.string().nullable(),
    environment: z.string(),
    event_type: z.string(),
    id: z.string().uuid(),
    occurred_at: z.union([z.date(), z.string()]),
    properties: z.unknown(),
    subject_id: z.string().nullable(),
  });
  const rows = claimed.rows.map((row) => rowSchema.safeParse(row));
  const parsed = rows.flatMap((row) => (row.success ? [row.data] : []));
  if (parsed.length !== rows.length) {
    const keep = parsed.map((row) => sql`${row.id}::uuid`);
    const invalid =
      await database.execute(sql`UPDATE soundkit_analytics.events SET
      quarantined_at=now(),failure_code='invalid_event',lease_id=NULL,leased_until=NULL
      WHERE lease_id=${lease}::uuid ${keep.length > 0 ? sql`AND id NOT IN (${sql.join(keep, sql`,`)})` : sql``}
      RETURNING id`);
    rejected = invalid.rowCount ?? 0;
    logWarn({ event: "analytics_outbox_parse_failed", rejected });
  }
  for (const row of parsed) {
    let record: Record<string, unknown>;
    try {
      record = serializeOutboxEvent(row);
    } catch {
      await database.execute(sql`UPDATE soundkit_analytics.events SET quarantined_at=now(),
        failure_code='invalid_event',lease_id=NULL,leased_until=NULL WHERE id=${row.id}::uuid AND lease_id=${lease}::uuid`);
      rejected += 1;
      continue;
    }
    valid.push({ id: row.id, record });
  }
  let delivered = 0;
  if (valid.length > 0) {
    const ids = valid.map((item) => item.id);
    try {
      // Ingestion acknowledgement is not event-ID deduplication. Redelivery
      // after a crash carries the same IDs; downstream queries deduplicate.
      await stream.send(valid.map((item) => item.record));
      const ack =
        await database.execute(sql`UPDATE soundkit_analytics.events SET delivered_at=now(),
        failure_code=NULL,lease_id=NULL,leased_until=NULL WHERE id IN (${sql.join(
          ids.map((id) => sql`${id}::uuid`),
          sql`,`
        )}) AND lease_id=${lease}::uuid RETURNING id`);
      delivered = ack.rowCount ?? 0;
    } catch {
      await database.execute(sql`UPDATE soundkit_analytics.events SET
        available_at=now()+make_interval(secs => least(3600,power(2,least(attempts,10))::int*15)),
        quarantined_at=CASE WHEN attempts>=10 THEN now() ELSE NULL END,
        failure_code='delivery_failed',lease_id=NULL,leased_until=NULL
        WHERE id IN (${sql.join(
          ids.map((id) => sql`${id}::uuid`),
          sql`,`
        )}) AND lease_id=${lease}::uuid`);
      logWarn({ event: "analytics_export_delivery_failed" });
    }
  }
  logInfo({ delivered, event: "analytics_export_batch", rejected });
  return { delivered, rejected, skipped: false };
}

export async function analyticsOutboxHealth(
  environment: string,
  db: AnalyticsDatabase = createDb()
) {
  const result = await db.execute(sql`
    SELECT count(*) FILTER (WHERE delivered_at IS NULL AND quarantined_at IS NULL)::int AS pending,
      count(*) FILTER (WHERE quarantined_at IS NOT NULL)::int AS quarantined,
      count(*) FILTER (WHERE failure_code='invalid_event')::int AS rejected,
      coalesce(sum(greatest(attempts-1,0)),0)::int AS retry_attempts,
      coalesce(extract(epoch FROM now()-min(occurred_at) FILTER (WHERE delivered_at IS NULL AND quarantined_at IS NULL)),0)::float8 AS oldest_pending_seconds,
      coalesce(max(extract(epoch FROM delivered_at-occurred_at)),0)::float8 AS max_delivery_lag_seconds
    FROM soundkit_analytics.events WHERE environment=${environment}
  `);
  return result.rows[0];
}

export async function maintainAnalyticsRetention(
  db: AnalyticsDatabase = createDb()
): Promise<void> {
  // Bounded maintenance. Repeated sweeps converge without long table locks.
  await db.execute(sql`UPDATE soundkit_analytics.events SET quarantined_at=now(),failure_code='expired'
    WHERE id IN (SELECT id FROM soundkit_analytics.events WHERE delivered_at IS NULL AND quarantined_at IS NULL
      AND occurred_at<now()-interval '30 days' LIMIT 500)`);
  await db.execute(sql`DELETE FROM soundkit_analytics.events WHERE id IN (
    SELECT id FROM soundkit_analytics.events WHERE
      (delivered_at IS NOT NULL AND occurred_at<now()-interval '30 days') OR
      (quarantined_at IS NOT NULL AND occurred_at<now()-interval '90 days') LIMIT 500)`);
  await db.execute(sql`DELETE FROM soundkit_analytics.activity WHERE (user_id,day,environment) IN (
    SELECT user_id,day,environment FROM soundkit_analytics.activity WHERE day<(now() AT TIME ZONE 'UTC')::date-90 LIMIT 500)`);
  await db.execute(sql`DELETE FROM soundkit_analytics.subjects WHERE id IN (
    SELECT s.id FROM soundkit_analytics.subjects s WHERE s.created_at<now()-interval '90 days'
      AND NOT EXISTS (SELECT 1 FROM soundkit_analytics.activity a WHERE a.user_id=s.user_id)
      AND NOT EXISTS (SELECT 1 FROM soundkit_analytics.events e WHERE e.subject_id=s.id) LIMIT 500)`);
}

export async function replayAnalyticsEvent(
  id: string,
  environment: string,
  db: AnalyticsDatabase = createDb()
) {
  const result = await db.execute(sql`UPDATE soundkit_analytics.events SET
    delivered_at=NULL,quarantined_at=NULL,failure_code=NULL,attempts=0,available_at=now(),lease_id=NULL,leased_until=NULL
    WHERE id=${id}::uuid AND environment=${environment}
      AND (leased_until IS NULL OR leased_until<now()) RETURNING id`);
  return result.rowCount === 1;
}

export async function eraseAccountAnalytics(
  userId: string,
  db: AnalyticsDatabase = createDb()
): Promise<void> {
  await db.execute(sql`SELECT soundkit_analytics.erase_account(${userId})`);
}

export async function runAnalyticsSweep({
  stream,
  environment,
}: {
  stream?: AnalyticsStream;
  environment?: string;
}) {
  if (!stream || !environment || !isDatabaseConfigured()) {
    return;
  }
  try {
    await dispatchAnalyticsOutbox({ environment, stream });
    await maintainAnalyticsRetention();
    const health = await analyticsOutboxHealth(environment);
    logInfo({ event: "analytics_outbox_health", ...health });
    if (
      Number(health?.oldest_pending_seconds) > 600 ||
      Number(health?.quarantined) > 0
    ) {
      logWarn({ event: "analytics_outbox_attention_required", ...health });
    }
    await reconcileAnalytics(environment);
  } catch (error) {
    logWarn({ event: "analytics_sweep_failed" });
    throw error;
  }
}

export async function analyticsFailures(environment: string) {
  const result = await createDb().execute(sql`
    SELECT id,event_type,
      to_char(occurred_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS occurred_at,
      attempts,failure_code,
      to_char(quarantined_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS quarantined_at
    FROM soundkit_analytics.events WHERE environment=${environment} AND quarantined_at IS NOT NULL
    ORDER BY quarantined_at,id LIMIT 50
  `);
  return result.rows;
}
