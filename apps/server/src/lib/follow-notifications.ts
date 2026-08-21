/* eslint-disable one-var */
import type { EmailDeliveryQueueMessage } from "@/lib/email-delivery";
import type { NotificationEvent } from "@/lib/notification-events";
import { notify } from "@/lib/notifications";

interface FollowNotificationInput {
  actorAccountType: "artist" | "fan";
  actorName: string;
  actorUserId: string;
  actorUsername?: string | null;
  emailQueue?: Queue<EmailDeliveryQueueMessage> | null;
  recipientUserId: string;
}

export const buildFollowNotificationEvent = ({
  actorAccountType,
  actorName,
  actorUserId,
  actorUsername,
  recipientUserId,
}: Omit<FollowNotificationInput, "emailQueue">): Extract<
  NotificationEvent,
  { type: "follow.created" }
> => ({
  actorUserId,
  aggregationKey: `followers:${recipientUserId}`,
  data: {
    actorAccountType,
    actorName,
    actorUsername,
  },
  entity: { id: actorUserId, type: "user" },
  eventId: `${actorUserId}:${recipientUserId}`,
  recipientUserId,
  type: "follow.created",
});

export const notifyFollowCreated = ({
  emailQueue,
  ...input
}: FollowNotificationInput) =>
  notify(buildFollowNotificationEvent(input), { emailQueue });
