import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  battles,
  userNotifications,
  webhookEvents,
} from "@soundkit/db/schema/app";
import { and, eq, gte, lte, or } from "drizzle-orm";

import type { EmailDeliveryQueueMessage } from "@/lib/email-delivery";
import {
  notifyBattleReminderEmailsForBattle,
  notifyBattleResultsEmailsForBattle,
} from "@/lib/email-events";

const reminderLookaheadMs = 30 * 60 * 1000,
  liveTransitionLookbackMs = 15 * 60 * 1000,
  resultsLookbackMs = 7 * 24 * 60 * 60 * 1000,
  sweepLimit = 100;

type BattleServiceStatus = "ignored" | "processed";

const reminderEventTypes = new Set([
    "battle.reminder",
    "battle.starts_soon",
    "battle.starting_soon",
  ]),
  liveEventTypes = new Set(["battle.live", "battle.started", "battle.start"]),
  resultsEventTypes = new Set([
    "battle.completed",
    "battle.results",
    "battle.results_ready",
  ]),
  loadBattle = async (battleId: string) => {
    const [battle] = await createDb()
      .select({
        challengerArtistUserId: battles.challengerArtistUserId,
        endedAt: battles.endedAt,
        id: battles.id,
        opponentArtistUserId: battles.opponentArtistUserId,
        startsAt: battles.startsAt,
        status: battles.status,
        title: battles.title,
      })
      .from(battles)
      .where(
        or(eq(battles.id, battleId), eq(battles.externalBattleId, battleId))
      )
      .limit(1);

    return battle ?? null;
  },
  getBattleRecipientUserIds = (battle: {
    challengerArtistUserId: null | string;
    opponentArtistUserId: null | string;
  }) => [
    ...new Set(
      [battle.challengerArtistUserId, battle.opponentArtistUserId].filter(
        (userId): userId is string => Boolean(userId)
      )
    ),
  ],
  insertBattleNotifications = async ({
    battleId,
    eventId,
    link = "/dashboard/live",
    message,
    recipientUserIds,
    title,
    type,
  }: {
    battleId: string;
    eventId: string;
    link?: string;
    message: string;
    recipientUserIds: string[];
    title: string;
    type: string;
  }) => {
    if (recipientUserIds.length === 0) {
      return 0;
    }

    const rows = recipientUserIds.map((userId) => ({
      id: `${type}:${battleId}:${eventId}:${userId}`,
      link,
      message,
      title,
      type,
      userId,
    }));

    await createDb()
      .insert(userNotifications)
      .values(rows)
      .onConflictDoNothing();

    return rows.length;
  },
  getResultsSummary = (payload: Record<string, unknown>) => {
    const direct =
      typeof payload.resultsSummary === "string"
        ? payload.resultsSummary
        : null;

    if (direct) {
      return direct;
    }

    const snake =
      typeof payload.results_summary === "string"
        ? payload.results_summary
        : null;

    if (snake) {
      return snake;
    }

    return typeof payload.summary === "string" ? payload.summary : null;
  },
  applyBattleServiceEvent = async ({
    battleId,
    emailQueue,
    eventId,
    eventType,
    payload,
  }: {
    battleId: string;
    emailQueue?: Queue<EmailDeliveryQueueMessage> | null;
    eventId: string;
    eventType: string;
    payload: Record<string, unknown>;
  }): Promise<BattleServiceStatus> => {
    const battle = await loadBattle(battleId);

    if (!battle) {
      return "ignored";
    }

    const recipientUserIds = getBattleRecipientUserIds(battle);

    if (reminderEventTypes.has(eventType)) {
      await notifyBattleReminderEmailsForBattle({
        battleId: battle.id,
        eventId,
        queue: emailQueue,
      });
      await insertBattleNotifications({
        battleId: battle.id,
        eventId,
        message: `${battle.title} starts soon. Open the battle room to make sure everything is ready.`,
        recipientUserIds,
        title: "Battle Starts Soon",
        type: "battle_reminder",
      });

      return "processed";
    }

    if (liveEventTypes.has(eventType)) {
      await createDb()
        .update(battles)
        .set({
          status: "live",
          updatedAt: new Date(),
        })
        .where(and(eq(battles.id, battle.id), eq(battles.status, "scheduled")));
      await insertBattleNotifications({
        battleId: battle.id,
        eventId,
        message: `${battle.title} is live now.`,
        recipientUserIds,
        title: "Battle Is Live",
        type: "battle_live",
      });

      return "processed";
    }

    if (resultsEventTypes.has(eventType)) {
      const resultsSummary =
        getResultsSummary(payload) ??
        "The final round data has been saved to your dashboard.";

      await notifyBattleResultsEmailsForBattle({
        battleId: battle.id,
        eventId,
        queue: emailQueue,
        resultsSummary,
      });
      await insertBattleNotifications({
        battleId: battle.id,
        eventId,
        message: `${battle.title} is complete. Open the recap to review the results.`,
        recipientUserIds,
        title: "Battle Results Ready",
        type: "battle_results",
      });

      return "processed";
    }

    return "ignored";
  };

export const processBattleServiceEvent = async ({
  battleId,
  emailQueue,
  eventId,
  eventType,
  payload,
}: {
  battleId: string;
  emailQueue?: Queue<EmailDeliveryQueueMessage> | null;
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
}) => {
  if (!isDatabaseConfigured()) {
    return { skipped: false, status: "ignored" as const };
  }

  const db = createDb(),
    [existingEvent] = await db
      .select({
        id: webhookEvents.id,
        status: webhookEvents.status,
      })
      .from(webhookEvents)
      .where(
        and(
          eq(webhookEvents.provider, "battle_service"),
          eq(webhookEvents.externalEventId, eventId)
        )
      )
      .limit(1);

  if (
    existingEvent &&
    (existingEvent.status === "processed" || existingEvent.status === "ignored")
  ) {
    return { skipped: true, status: existingEvent.status };
  }

  const eventRowId = existingEvent?.id ?? crypto.randomUUID();

  if (!existingEvent) {
    await db.insert(webhookEvents).values({
      eventType,
      externalEventId: eventId,
      id: eventRowId,
      payload,
      provider: "battle_service",
      status: "received",
    });
  }

  try {
    const status = await applyBattleServiceEvent({
      battleId,
      emailQueue,
      eventId,
      eventType,
      payload,
    });

    await db
      .update(webhookEvents)
      .set({
        processedAt: new Date(),
        status,
      })
      .where(eq(webhookEvents.id, eventRowId));

    return { skipped: false, status };
  } catch (error) {
    await db
      .update(webhookEvents)
      .set({
        processedAt: new Date(),
        status: "failed",
      })
      .where(eq(webhookEvents.id, eventRowId));
    throw error;
  }
};

export const runBattleServiceSweep = async ({
  emailQueue,
  now = new Date(),
}: {
  emailQueue?: Queue<EmailDeliveryQueueMessage> | null;
  now?: Date;
}) => {
  if (!isDatabaseConfigured()) {
    return {
      live: 0,
      reminders: 0,
      results: 0,
      skipped: true,
    };
  }

  const db = createDb(),
    reminderHorizon = new Date(now.getTime() + reminderLookaheadMs),
    liveFloor = new Date(now.getTime() - liveTransitionLookbackMs),
    resultsFloor = new Date(now.getTime() - resultsLookbackMs),
    [reminderBattles, liveBattles, resultBattles] = await Promise.all([
      db
        .select({
          id: battles.id,
          startsAt: battles.startsAt,
        })
        .from(battles)
        .where(
          and(
            eq(battles.status, "scheduled"),
            gte(battles.startsAt, now),
            lte(battles.startsAt, reminderHorizon)
          )
        )
        .limit(sweepLimit),
      db
        .select({
          id: battles.id,
          startsAt: battles.startsAt,
        })
        .from(battles)
        .where(
          and(
            eq(battles.status, "scheduled"),
            gte(battles.startsAt, liveFloor),
            lte(battles.startsAt, now)
          )
        )
        .limit(sweepLimit),
      db
        .select({
          endedAt: battles.endedAt,
          id: battles.id,
        })
        .from(battles)
        .where(
          and(
            eq(battles.status, "completed"),
            gte(battles.endedAt, resultsFloor),
            lte(battles.endedAt, now)
          )
        )
        .limit(sweepLimit),
    ]);

  let live = 0,
    reminders = 0,
    results = 0;

  for (const battle of reminderBattles) {
    const startsAt = battle.startsAt?.toISOString() ?? "unknown",
      outcome = await processBattleServiceEvent({
        battleId: battle.id,
        emailQueue,
        eventId: `scheduler:battle.reminder:${battle.id}:${startsAt}`,
        eventType: "battle.starts_soon",
        payload: {
          battleId: battle.id,
          generatedAt: now.toISOString(),
          startsAt,
          type: "battle.starts_soon",
        },
      });

    if (outcome.status === "processed" && !outcome.skipped) {
      reminders += 1;
    }
  }

  for (const battle of liveBattles) {
    const startsAt = battle.startsAt?.toISOString() ?? "unknown",
      outcome = await processBattleServiceEvent({
        battleId: battle.id,
        emailQueue,
        eventId: `scheduler:battle.live:${battle.id}:${startsAt}`,
        eventType: "battle.live",
        payload: {
          battleId: battle.id,
          generatedAt: now.toISOString(),
          startsAt,
          type: "battle.live",
        },
      });

    if (outcome.status === "processed" && !outcome.skipped) {
      live += 1;
    }
  }

  for (const battle of resultBattles) {
    const endedAt = battle.endedAt?.toISOString() ?? "unknown",
      outcome = await processBattleServiceEvent({
        battleId: battle.id,
        emailQueue,
        eventId: `scheduler:battle.results_ready:${battle.id}:${endedAt}`,
        eventType: "battle.results_ready",
        payload: {
          battleId: battle.id,
          endedAt,
          generatedAt: now.toISOString(),
          type: "battle.results_ready",
        },
      });

    if (outcome.status === "processed" && !outcome.skipped) {
      results += 1;
    }
  }

  return {
    live,
    reminders,
    results,
    skipped: false,
  };
};
