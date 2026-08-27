/* eslint-disable complexity, one-var, sort-vars */
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  conversationParticipants,
  messages,
  notificationEmailCooldowns,
  notificationSettings,
  userNotifications,
  userPresence,
} from "@soundkit/db/schema/app";
import { user as authUser } from "@soundkit/db/schema/auth";
import { and, eq, lte } from "drizzle-orm";

import type {
  EmailDeliveryQueueMessage,
  EnqueueTransactionalEmailOptions,
} from "@/lib/email-delivery";
import { enqueueTransactionalEmail } from "@/lib/email-delivery";
import type {
  ActivityEmailPreference,
  NotificationEvent,
  NotificationEventDefinition,
} from "@/lib/notification-events";
import { defineNotificationEvent } from "@/lib/notification-events";

const MESSAGE_EMAIL_DELAY_SECONDS = 10 * 60,
  MESSAGE_EMAIL_COOLDOWN_MS = 15 * 60 * 1000,
  PRESENCE_ACTIVE_THRESHOLD_MS = 90_000;

export const NOTIFICATION_QUEUE_NAME = "activity-notifications";

export interface NotificationQueueMessage {
  event: Extract<NotificationEvent, { type: "message.received" }>;
  kind: "evaluate_missed_message";
}

export interface NotificationPreferences {
  emailCollaborations: boolean;
  emailComments: boolean;
  emailFollowers: boolean;
  emailLive: boolean;
  emailMessages: boolean;
  emailSales: boolean;
  emailTrackProcessing: boolean;
}

export interface NotificationRecipient {
  email: string;
  name: string;
  userId: string;
}

export interface PersistInAppInput {
  definition: NotificationEventDefinition;
  event: NotificationEvent;
  notificationId: string;
}

export interface NotificationDispatcherDependencies {
  enqueueEmail: (options: EnqueueTransactionalEmailOptions) => Promise<unknown>;
  getPreferences: (userId: string) => Promise<NotificationPreferences | null>;
  getRecipient: (userId: string) => Promise<NotificationRecipient | null>;
  persistInApp: (input: PersistInAppInput) => Promise<boolean>;
}

export interface DispatchNotificationOptions {
  beforeEmail?: () => Promise<boolean>;
  deliveryMode?: "all" | "email_only";
  emailQueue?: Queue<EmailDeliveryQueueMessage> | null;
  notificationQueue?: Queue<NotificationQueueMessage> | null;
}

const defaultPreferences: NotificationPreferences = {
    emailCollaborations: true,
    emailComments: true,
    emailFollowers: true,
    emailLive: true,
    emailMessages: true,
    emailSales: true,
    emailTrackProcessing: true,
  },
  preferenceFooters: Record<ActivityEmailPreference, string> = {
    collaborations:
      "You are receiving this because collaboration and opportunity emails are turned on for your SoundKit account.",
    comments:
      "You are receiving this because comment emails are turned on for your SoundKit account.",
    followers:
      "You are receiving this because follower and release emails are turned on for your SoundKit account.",
    live: "You are receiving this because live emails are turned on for your SoundKit account.",
    messages:
      "You are receiving this because missed-message emails are turned on for your SoundKit account.",
    sales:
      "You are receiving this because sales emails are turned on for your SoundKit account.",
    trackProcessing:
      "You are receiving this because track-processing emails are turned on for your SoundKit account.",
  },
  preferenceEnabled = (
    preference: ActivityEmailPreference,
    settings: NotificationPreferences
  ): boolean => {
    if (preference === "collaborations") {
      return settings.emailCollaborations;
    }
    if (preference === "comments") {
      return settings.emailComments;
    }
    if (preference === "followers") {
      return settings.emailFollowers;
    }
    if (preference === "live") {
      return settings.emailLive;
    }
    if (preference === "messages") {
      return settings.emailMessages;
    }
    if (preference === "sales") {
      return settings.emailSales;
    }
    return settings.emailTrackProcessing;
  },
  notificationIdForEvent = (event: NotificationEvent): string =>
    `notification:${event.type}:${event.eventId}:${event.recipientUserId}`,
  emailIdempotencyKeyForEvent = (event: NotificationEvent): string =>
    `notification-email/${event.type}/${event.eventId}/${event.recipientUserId}`,
  loadNotificationPreferences = async (
    userId: string
  ): Promise<NotificationPreferences | null> => {
    if (!isDatabaseConfigured()) {
      return null;
    }

    const [settings] = await createDb()
      .select({
        emailCollaborations: notificationSettings.emailCollaborations,
        emailComments: notificationSettings.emailComments,
        emailFollowers: notificationSettings.emailFollowers,
        emailLive: notificationSettings.emailLive,
        emailMessages: notificationSettings.emailMessages,
        emailSales: notificationSettings.emailSales,
        emailTrackProcessing: notificationSettings.emailTrackProcessing,
      })
      .from(notificationSettings)
      .where(eq(notificationSettings.userId, userId))
      .limit(1);

    return settings ?? null;
  },
  loadNotificationRecipient = async (
    userId: string
  ): Promise<NotificationRecipient | null> => {
    if (!isDatabaseConfigured()) {
      return null;
    }

    const [recipient] = await createDb()
      .select({
        email: authUser.email,
        name: authUser.name,
        userId: authUser.id,
      })
      .from(authUser)
      .where(eq(authUser.id, userId))
      .limit(1);

    if (!recipient?.email) {
      return null;
    }

    return {
      email: recipient.email,
      name: recipient.name ?? "there",
      userId: recipient.userId,
    };
  },
  persistInAppNotification = async ({
    definition,
    event,
    notificationId,
  }: PersistInAppInput): Promise<boolean> => {
    if (!isDatabaseConfigured()) {
      return false;
    }

    const [created] = await createDb()
      .insert(userNotifications)
      .values({
        actorUserId: event.actorUserId ?? null,
        aggregationKey: event.aggregationKey ?? null,
        entityId: event.entity?.id ?? null,
        entityType: event.entity?.type ?? null,
        id: notificationId,
        link: definition.inApp.link,
        message: definition.inApp.message,
        metadata: event.metadata ?? null,
        title: definition.inApp.title,
        type: definition.inApp.type,
        userId: event.recipientUserId,
      })
      .onConflictDoNothing()
      .returning({ id: userNotifications.id });

    return Boolean(created);
  },
  defaultDependencies: NotificationDispatcherDependencies = {
    enqueueEmail: enqueueTransactionalEmail,
    getPreferences: loadNotificationPreferences,
    getRecipient: loadNotificationRecipient,
    persistInApp: persistInAppNotification,
  };

export const createNotificationDispatcher =
  (dependencies: NotificationDispatcherDependencies) =>
  async (
    event: NotificationEvent,
    options: DispatchNotificationOptions = {}
  ) => {
    if (event.actorUserId && event.actorUserId === event.recipientUserId) {
      return {
        email: "self_notification_suppressed" as const,
        inApp: "self_notification_suppressed" as const,
      };
    }

    const definition = defineNotificationEvent(event),
      deliveryMode = options.deliveryMode ?? "all";
    let inApp: "created" | "duplicate" | "not_requested" = "not_requested";

    if (deliveryMode === "all" && definition.channels.inApp) {
      const created = await dependencies.persistInApp({
        definition,
        event,
        notificationId: notificationIdForEvent(event),
      });
      inApp = created ? "created" : "duplicate";
    }

    if (definition.channels.email === "none") {
      return { email: "not_requested" as const, inApp };
    }

    if (
      definition.channels.email === "delayed" &&
      deliveryMode !== "email_only"
    ) {
      if (!options.notificationQueue || event.type !== "message.received") {
        return { email: "delay_queue_unavailable" as const, inApp };
      }

      await options.notificationQueue.send(
        { event, kind: "evaluate_missed_message" },
        {
          contentType: "json",
          delaySeconds: MESSAGE_EMAIL_DELAY_SECONDS,
        }
      );
      return { email: "scheduled" as const, inApp };
    }

    if (!definition.email) {
      return { email: "not_requested" as const, inApp };
    }

    if (definition.preference) {
      const settings =
        (await dependencies.getPreferences(event.recipientUserId)) ??
        defaultPreferences;
      if (!preferenceEnabled(definition.preference, settings)) {
        return { email: "preference_disabled" as const, inApp };
      }
    }

    const recipient = await dependencies.getRecipient(event.recipientUserId);
    if (!recipient) {
      return { email: "recipient_not_found" as const, inApp };
    }

    if (options.beforeEmail && !(await options.beforeEmail())) {
      return { email: "cooldown_active" as const, inApp };
    }

    await dependencies.enqueueEmail({
      actionPath: definition.inApp.link,
      idempotencyKey: emailIdempotencyKeyForEvent(event),
      payload: {
        ...(definition.email.battleOutcomeAudience
          ? {
              battleOutcomeArtistName: definition.email.battleOutcomeArtistName,
              battleOutcomeAudience: definition.email.battleOutcomeAudience,
              battleOutcomeKind: definition.email.battleOutcomeKind,
              battleOutcomeReason: definition.email.battleOutcomeReason,
              battleTitle: definition.email.battleTitle,
            }
          : {}),
        body: definition.email.body,
        ctaLabel: definition.email.ctaLabel,
        eyebrow: definition.email.eyebrow,
        footerNote: definition.preference
          ? preferenceFooters[definition.preference]
          : "You are receiving this because this message is important to your SoundKit account or billing.",
        heading: definition.email.heading,
        previewText: definition.email.previewText,
        subject: definition.email.subject,
      },
      queue: options.emailQueue,
      recipientEmail: recipient.email,
      recipientName: recipient.name,
      template: definition.email.template ?? "notification",
      userId: recipient.userId,
    });

    return { email: "enqueued" as const, inApp };
  };

export const notify = createNotificationDispatcher(defaultDependencies);

const messageIsStillMissed = async (
    event: Extract<NotificationEvent, { type: "message.received" }>
  ): Promise<boolean> => {
    if (!isDatabaseConfigured()) {
      return false;
    }

    const [state] = await createDb()
      .select({
        lastReadAt: conversationParticipants.lastReadAt,
        messageCreatedAt: messages.createdAt,
        senderUserId: messages.senderUserId,
      })
      .from(messages)
      .innerJoin(
        conversationParticipants,
        and(
          eq(conversationParticipants.conversationId, messages.conversationId),
          eq(conversationParticipants.userId, event.recipientUserId)
        )
      )
      .where(
        and(
          eq(messages.id, event.data.messageId),
          eq(messages.conversationId, event.data.conversationId)
        )
      )
      .limit(1);

    return Boolean(
      state &&
      state.senderUserId !== event.recipientUserId &&
      (!state.lastReadAt || state.lastReadAt < state.messageCreatedAt)
    );
  },
  recipientIsActive = async (recipientUserId: string): Promise<boolean> => {
    if (!isDatabaseConfigured()) {
      return false;
    }

    const [presence] = await createDb()
      .select({
        lastSeen: userPresence.lastSeen,
        status: userPresence.status,
      })
      .from(userPresence)
      .where(eq(userPresence.userId, recipientUserId))
      .limit(1);

    return Boolean(
      presence &&
      presence.status !== "offline" &&
      Date.now() - presence.lastSeen.getTime() < PRESENCE_ACTIVE_THRESHOLD_MS
    );
  },
  claimMessageEmailCooldown = async ({
    conversationId,
    recipientUserId,
  }: {
    conversationId: string;
    recipientUserId: string;
  }): Promise<boolean> => {
    if (!isDatabaseConfigured()) {
      return false;
    }

    const now = new Date(),
      cooldownCutoff = new Date(now.getTime() - MESSAGE_EMAIL_COOLDOWN_MS),
      [claimed] = await createDb()
        .insert(notificationEmailCooldowns)
        .values({
          lastSentAt: now,
          recipientUserId,
          scope: `message:${conversationId}`,
        })
        .onConflictDoUpdate({
          set: { lastSentAt: now },
          setWhere: lte(notificationEmailCooldowns.lastSentAt, cooldownCutoff),
          target: [
            notificationEmailCooldowns.recipientUserId,
            notificationEmailCooldowns.scope,
          ],
        })
        .returning({ lastSentAt: notificationEmailCooldowns.lastSentAt });

    return Boolean(claimed);
  };

export interface MissedMessageProcessorDependencies {
  claimCooldown: (
    event: Extract<NotificationEvent, { type: "message.received" }>
  ) => Promise<boolean>;
  deliverEmail: (
    event: Extract<NotificationEvent, { type: "message.received" }>
  ) => Promise<unknown>;
  isRecipientActive: (recipientUserId: string) => Promise<boolean>;
  isStillMissed: (
    event: Extract<NotificationEvent, { type: "message.received" }>
  ) => Promise<boolean>;
}

export const createMissedMessageProcessor =
  (dependencies: MissedMessageProcessorDependencies) =>
  async (event: Extract<NotificationEvent, { type: "message.received" }>) => {
    if (!(await dependencies.isStillMissed(event))) {
      return { email: "already_read" as const };
    }

    if (await dependencies.isRecipientActive(event.recipientUserId)) {
      return { email: "recipient_active" as const };
    }

    if (!(await dependencies.claimCooldown(event))) {
      return { email: "cooldown_active" as const };
    }

    await dependencies.deliverEmail(event);
    return { email: "enqueued" as const };
  };

export const processMissedMessageNotification = ({
  emailQueue,
  event,
}: {
  emailQueue?: Queue<EmailDeliveryQueueMessage> | null;
  event: Extract<NotificationEvent, { type: "message.received" }>;
}) =>
  createMissedMessageProcessor({
    claimCooldown: (messageEvent) =>
      claimMessageEmailCooldown({
        conversationId: messageEvent.data.conversationId,
        recipientUserId: messageEvent.recipientUserId,
      }),
    deliverEmail: (messageEvent) =>
      notify(messageEvent, {
        deliveryMode: "email_only",
        emailQueue,
      }),
    isRecipientActive: recipientIsActive,
    isStillMissed: messageIsStillMissed,
  })(event);

export const handleNotificationQueue = async (
  batch: MessageBatch<NotificationQueueMessage>,
  emailQueue?: Queue<EmailDeliveryQueueMessage> | null
) => {
  for (const message of batch.messages) {
    if (message.body.kind !== "evaluate_missed_message") {
      message.ack();
      continue;
    }

    try {
      await processMissedMessageNotification({
        emailQueue,
        event: message.body.event,
      });
      message.ack();
    } catch {
      message.retry({ delaySeconds: Math.min(300, 2 ** message.attempts) });
    }
  }
};
