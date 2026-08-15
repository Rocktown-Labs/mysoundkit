import { createDb, isDatabaseConfigured } from "@soundkit/db";
import { emailDeliveries } from "@soundkit/db/schema/app";
import { and, eq, isNull, lte, or, sql } from "drizzle-orm";

import { getPublicSiteUrl, sendTransactionalEmail } from "@/lib/email";
import type { TransactionalEmailTemplate } from "@/lib/email";
import { logWarn } from "@/middleware/structured-logging";

export interface EmailDeliveryQueueMessage {
  deliveryId: string;
}

export interface EnqueueTransactionalEmailOptions {
  actionPath: string;
  idempotencyKey: string;
  payload: {
    body?: string;
    ctaLabel?: string;
    eyebrow?: string;
    footerNote?: string;
    heading?: string;
    links?: {
      description?: string;
      href: string;
      label: string;
    }[];
    previewText?: string;
    subject?: string;
    trackId?: string;
    trackTitle?: string;
  };
  queue?: Queue<EmailDeliveryQueueMessage> | null;
  recipientEmail: string;
  recipientName: string;
  template: TransactionalEmailTemplate;
  userId?: string | null;
}

const absoluteUrl = (pathOrUrl: string) => {
  if (/^https?:\/\//u.test(pathOrUrl)) {
    return pathOrUrl;
  }

  return `${getPublicSiteUrl().replace(/\/$/u, "")}/${pathOrUrl.replace(/^\//u, "")}`;
},

 getRetryDelaySeconds = (attempts: number) =>
  Math.min(30 * 2 ** Math.max(0, attempts - 1), 60 * 60),

 getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export const enqueueTransactionalEmail = async ({
  actionPath,
  idempotencyKey,
  payload,
  queue,
  recipientEmail,
  recipientName,
  template,
  userId,
}: EnqueueTransactionalEmailOptions) => {
  if (!(isDatabaseConfigured() && recipientEmail)) {
    return { enqueued: false, reason: "email_delivery_unavailable" as const };
  }

  const db = createDb(),
   [delivery] = await db
    .insert(emailDeliveries)
    .values({
      id: crypto.randomUUID(),
      idempotencyKey,
      payload: {
        actionUrl: absoluteUrl(actionPath),
        recipientName,
        ...payload,
      },
      recipientEmail,
      recipientName,
      template,
      userId: userId ?? null,
    })
    .onConflictDoNothing()
    .returning({ id: emailDeliveries.id });

  if (!delivery) {
    return { enqueued: false, reason: "already_queued" as const };
  }

  if (queue) {
    try {
      await queue.send({ deliveryId: delivery.id }, { contentType: "json" });
      return { deliveryId: delivery.id, enqueued: true, transport: "queue" };
    } catch (error) {
      const message = getErrorMessage(error);
      await db
        .update(emailDeliveries)
        .set({
          error: message,
          nextAttemptAt: new Date(Date.now() + getRetryDelaySeconds(1) * 1000),
          status: "failed",
        })
        .where(eq(emailDeliveries.id, delivery.id));
      logWarn({
        deliveryId: delivery.id,
        error: message,
        event: "email_queue_enqueue_failed",
        template,
      });
      return {
        deliveryId: delivery.id,
        enqueued: false,
        reason: "queue_send_failed" as const,
        retryable: true,
      };
    }
  }

  const result = await deliverTransactionalEmail({ deliveryId: delivery.id });

  return {
    deliveryId: delivery.id,
    enqueued: true,
    sentImmediately: result.delivered,
    transport: "inline",
  };
};

export const retryDueEmailDeliveries = async ({
  limit = 100,
  queue,
}: {
  limit?: number;
  queue?: Queue<EmailDeliveryQueueMessage> | null;
}) => {
  if (!(isDatabaseConfigured() && queue)) {
    return { requeued: 0 };
  }

  const db = createDb(),
   retryIsDue = or(
    isNull(emailDeliveries.nextAttemptAt),
    lte(emailDeliveries.nextAttemptAt, new Date())
  ),
   failedAndDue = and(eq(emailDeliveries.status, "failed"), retryIsDue),
   dueDeliveries = await db
    .select({ id: emailDeliveries.id })
    .from(emailDeliveries)
    .where(failedAndDue)
    .limit(limit);

  let requeued = 0;
  for (const delivery of dueDeliveries) {
    try {
      await queue.send({ deliveryId: delivery.id }, { contentType: "json" });
      await db
        .update(emailDeliveries)
        .set({ error: null, nextAttemptAt: null, status: "queued" })
        .where(eq(emailDeliveries.id, delivery.id));
      requeued += 1;
    } catch (error) {
      logWarn({
        deliveryId: delivery.id,
        error: getErrorMessage(error),
        event: "email_queue_requeue_failed",
      });
    }
  }

  return { requeued };
};

export const deliverTransactionalEmail = async ({
  deliveryId,
}: EmailDeliveryQueueMessage) => {
  if (!isDatabaseConfigured()) {
    return { delivered: false, retryable: true };
  }

  const db = createDb(),
   [delivery] = await db
    .select()
    .from(emailDeliveries)
    .where(eq(emailDeliveries.id, deliveryId))
    .limit(1);

  if (
    !delivery ||
    delivery.status === "sent" ||
    delivery.status === "canceled"
  ) {
    return { delivered: true, retryable: false };
  }

  const attemptStartedAt = new Date();
  await db
    .update(emailDeliveries)
    .set({
      attempts: sql`${emailDeliveries.attempts} + 1`,
      error: null,
      lastAttemptAt: attemptStartedAt,
      status: "sending",
    })
    .where(eq(emailDeliveries.id, delivery.id));

  try {
    const payload = delivery.payload as {
      actionUrl: string;
      body?: string;
      ctaLabel?: string;
      eyebrow?: string;
      footerNote?: string;
      heading?: string;
      links?: {
        description?: string;
        href: string;
        label: string;
      }[];
      previewText?: string;
      recipientName: string;
      subject?: string;
      trackId?: string;
      trackTitle?: string;
    },
     result = await sendTransactionalEmail({
      idempotencyKey: delivery.idempotencyKey,
      payload,
      recipientEmail: delivery.recipientEmail,
      template: delivery.template as TransactionalEmailTemplate,
    });

    if (result.sent) {
      await db
        .update(emailDeliveries)
        .set({
          providerMessageId: result.emailId,
          sentAt: new Date(),
          status: "sent",
        })
        .where(eq(emailDeliveries.id, delivery.id));

      return { delivered: true, retryable: false };
    }

    const retryable = result.reason !== "resend_not_configured";
    await db
      .update(emailDeliveries)
      .set({
        error: result.reason,
        nextAttemptAt: retryable
          ? new Date(
              Date.now() + getRetryDelaySeconds(delivery.attempts + 1) * 1000
            )
          : null,
        status: "failed",
      })
      .where(eq(emailDeliveries.id, delivery.id));

    return { delivered: false, retryable };
  } catch (error) {
    const message = getErrorMessage(error);
    await db
      .update(emailDeliveries)
      .set({
        error: message,
        nextAttemptAt: new Date(
          Date.now() + getRetryDelaySeconds(delivery.attempts + 1) * 1000
        ),
        status: "failed",
      })
      .where(eq(emailDeliveries.id, delivery.id));

    logWarn({
      deliveryId: delivery.id,
      error: message,
      event: "email_delivery_failed",
      template: delivery.template,
    });

    return { delivered: false, retryable: true };
  }
};

export const handleEmailDeliveryQueue = async (
  batch: MessageBatch<EmailDeliveryQueueMessage>
) => {
  for (const message of batch.messages) {
    const result = await deliverTransactionalEmail(message.body);

    if (result.delivered || !result.retryable) {
      message.ack();
      continue;
    }

    message.retry({
      delaySeconds: getRetryDelaySeconds(message.attempts + 1),
    });
  }
};
