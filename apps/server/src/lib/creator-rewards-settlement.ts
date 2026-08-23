/* eslint-disable one-var */
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  accountingPeriods,
  creatorEarnings,
  rewardConfigurationVersions,
  rewardUnits,
  subscriptionRewardAllocations,
} from "@soundkit/db/schema/app";
import { subscription,user as authUser } from "@soundkit/db/schema/auth";
import { and, eq, gt, isNotNull, isNull, lte, or, sql } from "drizzle-orm";

import type { EmailDeliveryQueueMessage } from "@/lib/email-delivery";
import { enqueueForRecipient, getUserRecipient } from "@/lib/email-events";
import { isSellerEnabled } from "@/lib/seller";
import { logInfo, logWarn } from "@/middleware/structured-logging";

type SoundKitDb = ReturnType<typeof createDb>;

// $5.00 of each premium subscription flows into the creator pool monthly
// (mirrors reward_configuration_versions.creatorAllocationCents default).
const DEFAULT_CREATOR_ALLOCATION_CENTS = 500,
  PAYOUT_MINIMUM_CENTS = 2500,
  HALFWAY_THRESHOLD_CENTS = Math.floor(PAYOUT_MINIMUM_CENTS / 2),
  SETTLEMENT_BATCH_LIMIT = 200;

interface SettlementResult {
  allocationsCreated: number;
  emailsSent: number;
  earningsRows: number;
  skipped: boolean;
}

const monthWindow = (now: Date) => ({
  endsAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  startsAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
});

const getActiveRewardConfig = async (db: SoundKitDb, now: Date) => {
  const [config] = await db
    .select({
      creatorAllocationCents:
        rewardConfigurationVersions.creatorAllocationCents,
      id: rewardConfigurationVersions.id,
    })
    .from(rewardConfigurationVersions)
    .where(
      and(
        lte(rewardConfigurationVersions.effectiveFrom, now),
        or(
          isNull(rewardConfigurationVersions.effectiveTo),
          gt(rewardConfigurationVersions.effectiveTo, now)
        )
      )
    )
    .orderBy(sql`${rewardConfigurationVersions.effectiveFrom} desc`)
    .limit(1);

  return config ?? null;
};

const getOrCreateMonthlyPeriod = async (
  db: SoundKitDb,
  now: Date
): Promise<null | string> => {
  const { endsAt, startsAt } = monthWindow(now),
    [existing] = await db
      .select({ id: accountingPeriods.id })
      .from(accountingPeriods)
      .where(
        and(
          eq(accountingPeriods.periodType, "monthly"),
          eq(accountingPeriods.startsAt, startsAt),
          eq(accountingPeriods.endsAt, endsAt)
        )
      )
      .limit(1);

  if (existing) {
    return existing.id;
  }

  const id = crypto.randomUUID();
  await db
    .insert(accountingPeriods)
    .values({
      configurationVersionId: null,
      currency: "USD",
      endsAt,
      id,
      periodType: "monthly",
      startsAt,
      status: "open",
    })
    .onConflictDoNothing();

  return id;
};

export const runCreatorRewardsSettlement = async ({
  emailQueue,
  now = new Date(),
}: {
  emailQueue?: Queue<EmailDeliveryQueueMessage> | null;
  now?: Date;
}): Promise<SettlementResult> => {
  if (!isDatabaseConfigured()) {
    return {
      allocationsCreated: 0,
      earningsRows: 0,
      emailsSent: 0,
      skipped: true,
    };
  }

  const db = createDb(),
    config = await getActiveRewardConfig(db, now),
    periodId = await getOrCreateMonthlyPeriod(db, now);

  if (!(config && periodId)) {
    return {
      allocationsCreated: 0,
      earningsRows: 0,
      emailsSent: 0,
      skipped: true,
    };
  }

  // --- Step 1: allocate each active premium subscription's creator share ---
  const activeSubscriptions = await db
      .select({
        periodStart: subscription.periodStart,
        plan: subscription.plan,
        referenceId: subscription.referenceId,
        subId: subscription.id,
        userId: authUser.id,
      })
      .from(subscription)
      .innerJoin(authUser, eq(authUser.id, subscription.referenceId))
      .where(
        and(
          eq(subscription.status, "active"),
          sql`${subscription.plan} like '%premium%'`
        )
      )
      .limit(SETTLEMENT_BATCH_LIMIT),
    existingAllocations = await db
      .select({ subscriptionId: subscriptionRewardAllocations.subscriptionId })
      .from(subscriptionRewardAllocations)
      .where(eq(subscriptionRewardAllocations.accountingPeriodId, periodId)),
    allocatedSubscriptionIds = new Set(
      existingAllocations.map((row) => row.subscriptionId)
    ),
    freshSubscriptionRows = activeSubscriptions.filter(
      (sub) => !allocatedSubscriptionIds.has(sub.subId)
    );

  let allocationsCreated = 0;

  if (freshSubscriptionRows.length > 0) {
    await db
      .insert(subscriptionRewardAllocations)
      .values(
        freshSubscriptionRows.map((sub) => ({
          accountingPeriodId: periodId,
          allocationStatus: "funded" as const,
          configurationVersionId: config.id,
          createdAt: now,
          creatorAllocationCents:
            config.creatorAllocationCents ?? DEFAULT_CREATOR_ALLOCATION_CENTS,
          currency: "USD",
          fundedAt: now,
          grossSubscriptionAmountCents:
            config.creatorAllocationCents ?? DEFAULT_CREATOR_ALLOCATION_CENTS,
          id: crypto.randomUUID(),
          subscriptionId: sub.subId,
          subscriptionPeriodEnd: null,
          subscriptionPeriodStart: sub.periodStart ?? now,
          userId: sub.userId,
        }))
      )
      .onConflictDoNothing();
    allocationsCreated = freshSubscriptionRows.length;
  }

  // --- Step 2: distribute the pool across artists by qualified reward units ---
  const [poolRow] = await db
      .select({
        totalCents: sql<number>`coalesce(sum(${subscriptionRewardAllocations.creatorAllocationCents}), 0)::int`,
      })
      .from(subscriptionRewardAllocations)
      .where(eq(subscriptionRewardAllocations.accountingPeriodId, periodId)),
    poolCents = Number(poolRow?.totalCents ?? 0),
    unitRows = (
      await db
        .select({
          artistUserId: rewardUnits.artistUserId,
          unitCount: sql<number>`count(*)::int`,
        })
        .from(rewardUnits)
        .where(
          and(
            eq(rewardUnits.accountingPeriodId, periodId),
            eq(rewardUnits.status, "eligible"),
            isNotNull(rewardUnits.artistUserId)
          )
        )
        .groupBy(rewardUnits.artistUserId)
    ).filter(
      (row): row is { artistUserId: string; unitCount: number } =>
        row.artistUserId !== null
    ),
    totalUnits = unitRows.reduce((sum, row) => sum + Number(row.unitCount), 0);

  if (!(poolCents > 0) || totalUnits === 0 || unitRows.length === 0) {
    return {
      allocationsCreated,
      earningsRows: 0,
      emailsSent: 0,
      skipped: false,
    };
  }

  let remainingCents = poolCents,
    earningsRows = 0,
    emailsSent = 0;

  for (const [index, row] of unitRows.entries()) {
    const shareCents =
      index === unitRows.length - 1
        ? remainingCents
        : Math.floor((poolCents * Number(row.unitCount)) / totalUnits);

    remainingCents -= shareCents;

    if (shareCents <= 0) {
      continue;
    }

    const earningId = `reward-earning:${periodId}:${row.artistUserId}`,
      [priorEarning] = await db
        .select({ id: creatorEarnings.id })
        .from(creatorEarnings)
        .where(eq(creatorEarnings.artistUserId, row.artistUserId))
        .limit(1),
      isFirstEverEarning = !priorEarning,
      [inserted] = await db
        .insert(creatorEarnings)
        .values({
          accountingPeriodId: periodId,
          artistUserId: row.artistUserId,
          currency: "USD",
          earningType: "premium_stream_reward",
          grossAmountCents: shareCents,
          heldAmountCents: shareCents,
          id: earningId,
          quantity: Number(row.unitCount),
          status: "held",
        })
        .onConflictDoNothing()
        .returning({ id: creatorEarnings.id });

    if (!inserted) {
      continue;
    }
    earningsRows += 1;

    // --- Step 3: milestone emails ---
    const recipient = await getUserRecipient(row.artistUserId);
    if (!recipient) {
      continue;
    }

    const [totals] = await db
        .select({
          lifetimeGrossCents: sql<number>`coalesce(sum(${creatorEarnings.grossAmountCents}), 0)::int`,
        })
        .from(creatorEarnings)
        .where(eq(creatorEarnings.artistUserId, row.artistUserId)),
      lifetimeCents = Number(totals?.lifetimeGrossCents ?? 0),
      payoutsReady = await isSellerEnabled({
        organizationId: null,
        userId: row.artistUserId,
      }),
      connectReminder = payoutsReady
        ? null
        : {
            description: "Connect Stripe to receive payouts when you hit $25.",
            href: "/dashboard/career/payments",
            label: "Connect payouts",
          };

    const milestoneEmails: {
      heading: string;
      body: string;
      subject: string;
      key: string;
    }[] = [];

    if (isFirstEverEarning) {
      milestoneEmails.push({
        body: `Your music just earned its first creator reward on SoundKit. Qualified streams build toward the $${PAYOUT_MINIMUM_CENTS / 100} payout minimum — keep sharing your tracks.`,
        heading: "Your first creator reward has landed",
        key: `first-earning/${row.artistUserId}`,
        subject: "Your first SoundKit creator reward",
      });
    }

    if (lifetimeCents >= HALFWAY_THRESHOLD_CENTS) {
      milestoneEmails.push({
        body: `You're over halfway to your next payout — $${(lifetimeCents / 100).toFixed(2)} earned so far. Keep the momentum going.`,
        heading: "Halfway to your next payout",
        key: `earnings-halfway/${periodId}/${row.artistUserId}`,
        subject: "You're halfway to your next payout",
      });
    }

    for (const milestone of milestoneEmails) {
      const outcome = await enqueueForRecipient({
        actionPath: "/dashboard/finance",
        body: milestone.body,
        ctaLabel: "View earnings",
        eyebrow: "Creator rewards",
        footerNote:
          "You are receiving this because creator reward emails are part of your SoundKit account.",
        heading: milestone.heading,
        idempotencyKey: milestone.key,
        links: connectReminder ? [connectReminder] : [],
        preference: "sales",
        previewText: milestone.heading,
        queue: emailQueue,
        recipient,
        subject: milestone.subject,
        template: milestone.key.startsWith("first-earning/")
          ? "first_stream_earning"
          : "earnings_halfway",
      });

      if (outcome.enqueued) {
        emailsSent += 1;
      }

      if (!payoutsReady) {
        logWarn({
          event: "earning_email_without_payouts",
          userId: row.artistUserId,
        });
      }
    }
  }

  logInfo({
    allocationsCreated,
    earningsRows,
    emailsSent,
    event: "creator_rewards_settled",
    periodId,
    poolCents,
  });

  return {
    allocationsCreated,
    earningsRows,
    emailsSent,
    skipped: false,
  };
};
