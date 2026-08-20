import type { LiveExperienceKind } from "@/lib/live-experience";
import { fanoutGoLiveNotifications } from "@/lib/live-experience-events";

export interface LiveNotificationQueueMessage {
  creatorUserId: string;
  experienceId: string;
  eventType: "live_started";
  kind: LiveExperienceKind;
  title: string;
}

export const LIVE_NOTIFICATION_QUEUE_NAME = "live-notifications";

export const enqueueLiveStartedNotification = async ({
  creatorUserId,
  experienceId,
  kind,
  queue,
  title,
}: LiveNotificationQueueMessage & {
  queue?: Queue<LiveNotificationQueueMessage>;
}) => {
  if (!queue) {
    return false;
  }

  await queue.send({
    creatorUserId,
    eventType: "live_started",
    experienceId,
    kind,
    title,
  });
  return true;
};

export const handleLiveNotificationQueue = async (
  batch: MessageBatch<LiveNotificationQueueMessage>
) => {
  for (const message of batch.messages) {
    if (message.body.eventType !== "live_started") {
      message.ack();
      continue;
    }

    try {
      await fanoutGoLiveNotifications(message.body);
      message.ack();
    } catch (error) {
      console.error("Live notification queue delivery failed", {
        error: error instanceof Error ? error.message : String(error),
        experienceId: message.body.experienceId,
        messageId: message.id,
      });
      message.retry({ delaySeconds: Math.min(300, 2 ** message.attempts) });
    }
  }
};
