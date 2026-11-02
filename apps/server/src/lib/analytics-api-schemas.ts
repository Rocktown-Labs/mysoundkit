/* eslint-disable one-var, unicorn/max-nested-calls */
import { z } from "zod";

export const analyticsHealthSchema = z.object({
  max_delivery_lag_seconds: z.number(),
  oldest_pending_seconds: z.number(),
  pending: z.number(),
  quarantined: z.number(),
  rejected: z.number(),
  retry_attempts: z.number(),
});
export const analyticsFailuresSchema = z.object({
  events: z.array(
    z.object({
      attempts: z.number(),
      event_type: z.string(),
      failure_code: z.string().nullable(),
      id: z.string().uuid(),
      occurred_at: z.string().datetime(),
      quarantined_at: z.string().datetime(),
    })
  ),
});
export const analyticsReconciliationQuerySchema = z
  .object({
    before_created_at: z.string().datetime({ precision: 6 }).optional(),
    before_id: z.string().min(1).max(256).optional(),
  })
  .refine(
    (value) => Boolean(value.before_created_at) === Boolean(value.before_id),
    { message: "Both cursor fields are required." }
  );
export const analyticsReconciliationSchema = z.object({
  access_without_paid_order: z.number(),
  amount_currency_mismatches: z.number(),
  checked_orders: z.number(),
  missing_digital_access: z.number(),
  next_cursor: z
    .object({
      createdAt: z.string().datetime({ precision: 6 }),
      id: z.string(),
    })
    .nullable(),
  paid_without_settled_transaction: z.number(),
  truncated: z.boolean(),
});
export const analyticsRetentionSchema = z.object({
  cohorts: z.array(
    z.object({
      accounts: z.number(),
      cohort_day: z.string(),
      day_1: z.number(),
      day_1_mature: z.boolean(),
      day_30: z.number(),
      day_30_mature: z.boolean(),
      day_7: z.number(),
      day_7_mature: z.boolean(),
    })
  ),
  daily: z.array(z.object({ accounts: z.number(), day: z.string() })),
});
export const analyticsReplaySchema = z.object({ replayed: z.boolean() });
export const analyticsErasureSchema = z.object({ erased: z.boolean() });
export const analyticsEventParamSchema = z.object({ id: z.string().uuid() });
export const analyticsAccountParamSchema = z.object({
  userId: z.string().min(1).max(256),
});
