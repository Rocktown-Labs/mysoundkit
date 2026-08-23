import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  accountingPeriods,
  creatorEarnings,
  sellerAccounts,
} from "@soundkit/db/schema/app";
import { WorkflowEntrypoint } from "cloudflare:workers";
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { and, eq, sql } from "drizzle-orm";

import { notifyPayoutFailedEmail } from "@/lib/email-events";
import { executeSellerTransfer } from "@/lib/stripe";

interface PayoutRunPayload { periodId: string }

const PAYOUT_MINIMUM_CENTS = 2500,
  RESERVE_DAYS = 30,
  stepRetryConfig = {
    retries: {
      delay: "60 seconds" as const,
      limit: 5,
    },
    timeout: "15 minutes" as const,
  };

interface EligibleSeller {
  artistUserId: string;
  payableCents: number;
  stripeAccountId: string;
}

/**
 * Executes creator payouts for an accounting period. Held earnings age into
 * "payable" after the reserve window; sellers above the payout minimum with a
 * ready Stripe Connect account receive a transfer. Failures email the artist
 * and leave earnings payable for the next run.
 */
export class PayoutRunWorkflow extends WorkflowEntrypoint<
  Env,
  PayoutRunPayload
> {
  public async run(event: WorkflowEvent<PayoutRunPayload>, step: WorkflowStep) {
    const { periodId } = event.payload;

    if (!isDatabaseConfigured()) {
      return { paidSellers: 0, skipped: true };
    }

    // 1) Age reserved earnings into payable once the reserve window passes.
    await step.do("age reserved earnings", stepRetryConfig, async () => {
      const db = createDb(),
        cutoff = new Date(Date.now() - RESERVE_DAYS * 24 * 60 * 60 * 1000);

      await db
        .update(creatorEarnings)
        .set({
          payableAmountCents: sql`${creatorEarnings.grossAmountCents}`,
          status: "payable",
        })
        .where(
          and(
            eq(creatorEarnings.accountingPeriodId, periodId),
            eq(creatorEarnings.status, "held"),
            sql`${creatorEarnings.createdAt} <= ${cutoff.toISOString()}`
          )
        );
    });

    // 2) Snapshot sellers crossing the payout minimum.
    const eligibleSellers = await step.do<EligibleSeller[]>(
      "snapshot eligible sellers",
      stepRetryConfig,
      async () => {
        const db = createDb(),
          rows = await db
            .select({
              artistUserId: creatorEarnings.artistUserId,
              payableCents: sql<number>`coalesce(sum(${creatorEarnings.payableAmountCents}), 0)::int`,
              stripeAccountId: sellerAccounts.stripeAccountId,
            })
            .from(creatorEarnings)
            .innerJoin(
              sellerAccounts,
              eq(sellerAccounts.userId, creatorEarnings.artistUserId)
            )
            .where(
              and(
                eq(creatorEarnings.accountingPeriodId, periodId),
                eq(creatorEarnings.status, "payable"),
                eq(sellerAccounts.onboardingStatus, "enabled"),
                eq(sellerAccounts.chargesEnabled, true)
              )
            )
            .groupBy(
              creatorEarnings.artistUserId,
              sellerAccounts.stripeAccountId
            );

        return rows.flatMap((row) =>
          row.artistUserId &&
          row.stripeAccountId &&
          row.payableCents >= PAYOUT_MINIMUM_CENTS
            ? [
                {
                  artistUserId: row.artistUserId,
                  payableCents: row.payableCents,
                  stripeAccountId: row.stripeAccountId,
                },
              ]
            : []
        );
      }
    );

    let paidSellers = 0;

    // 3) One transfer per seller; failures email the artist and leave
    // earnings payable for the next run.
    for (const [index, seller] of eligibleSellers.entries()) {
      await step.do(
        `payout seller ${index + 1} of ${eligibleSellers.length}`,
        stepRetryConfig,
        async () => {
          const db = createDb(),
            transferId = await executeSellerTransfer({
              amountCents: seller.payableCents,
              destinationAccountId: seller.stripeAccountId,
            });

          if (!transferId) {
            await notifyPayoutFailedEmail({
              failureReason: "stripe_transfer_failed",
              recipientUserId: seller.artistUserId,
            });
            return;
          }

          await db
            .update(creatorEarnings)
            .set({
              metadata: { payoutPeriodId: periodId, transferId },
              payableAmountCents: 0,
              status: "paid",
            })
            .where(
              and(
                eq(creatorEarnings.accountingPeriodId, periodId),
                eq(creatorEarnings.artistUserId, seller.artistUserId),
                eq(creatorEarnings.status, "payable")
              )
            );
          paidSellers += 1;
        }
      );
    }

    return { paidSellers };
  }
}

/**
 * Ensures a payout run exists for every closed period that still has
 * unsettled earnings. Called from the cron scheduler.
 */
export const scheduleDuePayoutRuns = async ({
  workflow,
}: {
  workflow: null | Workflow<PayoutRunPayload> | undefined;
}): Promise<{ scheduled: number }> => {
  if (!isDatabaseConfigured() || !workflow) {
    return { scheduled: 0 };
  }

  const db = createDb(),
    duePeriods = await db
      .select({
        periodId: creatorEarnings.accountingPeriodId,
      })
      .from(creatorEarnings)
      .innerJoin(
        accountingPeriods,
        eq(accountingPeriods.id, creatorEarnings.accountingPeriodId)
      )
      .where(
        and(
          sql`${accountingPeriods.status} <> 'open'`,
          sql`${creatorEarnings.status} in ('held', 'finalized', 'payable')`
        )
      )
      .groupBy(creatorEarnings.accountingPeriodId);

  let scheduled = 0;

  for (const row of duePeriods) {
    if (!row.periodId) {
      continue;
    }

    try {
      await workflow.createBatch([
        {
          id: `payouts_${row.periodId}`,
          params: { periodId: row.periodId },
          retention: {
            errorRetention: "30 days",
            successRetention: "30 days",
          },
        },
      ]);
      scheduled += 1;
    } catch {
      // Instance already exists — nothing to do.
    }
  }

  return { scheduled };
};
