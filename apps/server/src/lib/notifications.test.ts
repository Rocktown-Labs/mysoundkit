/* eslint-disable sort-vars */
import { describe, expect, it } from "vitest";

import type { EnqueueTransactionalEmailOptions } from "./email-delivery";
import { buildFollowNotificationEvent } from "./follow-notifications";
import type { NotificationEvent } from "./notification-events";
import { defineNotificationEvent } from "./notification-events";
import {
  createMissedMessageProcessor,
  createNotificationDispatcher,
} from "./notifications";
import type {
  NotificationDispatcherDependencies,
  NotificationPreferences,
  NotificationQueueMessage,
  PersistInAppInput,
} from "./notifications";

const enabledPreferences: NotificationPreferences = {
    emailCollaborations: true,
    emailComments: true,
    emailFollowers: true,
    emailLive: true,
    emailMessages: true,
    emailSales: true,
    emailTrackProcessing: true,
  },
  messageEvent: Extract<NotificationEvent, { type: "message.received" }> = {
    actorUserId: "sender_1",
    data: {
      actorName: "Luna",
      conversationId: "conversation_1",
      messageId: "message_1",
      preview: "Can you review this mix?",
    },
    entity: { id: "conversation_1", type: "conversation" },
    eventId: "message_1",
    recipientUserId: "recipient_1",
    type: "message.received",
  },
  createHarness = (
    preferences: NotificationPreferences = enabledPreferences
  ) => {
    const deliveries = new Map<string, EnqueueTransactionalEmailOptions>(),
      emailAttempts: EnqueueTransactionalEmailOptions[] = [],
      inApp: PersistInAppInput[] = [],
      notificationIds = new Set<string>(),
      dependencies: NotificationDispatcherDependencies = {
        enqueueEmail: (options) => {
          emailAttempts.push(options);
          deliveries.set(options.idempotencyKey, options);
          return Promise.resolve({ enqueued: true });
        },
        getPreferences: () => Promise.resolve(preferences),
        getRecipient: (userId) =>
          Promise.resolve({
            email: `${userId}@soundkit.test`,
            name: "Recipient",
            userId,
          }),
        persistInApp: (input) => {
          inApp.push(input);
          const created = !notificationIds.has(input.notificationId);
          notificationIds.add(input.notificationId);
          return Promise.resolve(created);
        },
      };

    return {
      deliveries,
      dispatch: createNotificationDispatcher(dependencies),
      emailAttempts,
      inApp,
    };
  };

describe("notification product-event policy", () => {
  it("preserves in-app comments when the email preference is disabled", async () => {
    const harness = createHarness({
        ...enabledPreferences,
        emailComments: false,
      }),
      result = await harness.dispatch({
        actorUserId: "commenter_1",
        data: {
          actorName: "Mika",
          commentId: "comment_1",
          commentPreview: "The visual is incredible",
          videoId: "video_1",
          videoTitle: "Midnight Visual",
        },
        entity: { id: "video_1", type: "video" },
        eventId: "comment_1",
        recipientUserId: "creator_1",
        type: "video.comment.created",
      });

    expect(result).toEqual({
      email: "preference_disabled",
      inApp: "created",
    });
    expect(harness.inApp[0]?.definition.inApp).toMatchObject({
      link: "/videos/video_1#comments",
      type: "video_comment",
    });
    expect(harness.deliveries.size).toBe(0);
  });

  it("suppresses every channel for self-notifications", async () => {
    const harness = createHarness(),
      result = await harness.dispatch({
        actorUserId: "same_user",
        data: {
          actorName: "Self",
          commentId: "comment_self",
          commentPreview: "My own comment",
          videoId: "video_self",
          videoTitle: "My Video",
        },
        eventId: "comment_self",
        recipientUserId: "same_user",
        type: "video.comment.created",
      });

    expect(result).toEqual({
      email: "self_notification_suppressed",
      inApp: "self_notification_suppressed",
    });
    expect(harness.inApp).toHaveLength(0);
    expect(harness.emailAttempts).toHaveLength(0);
  });

  it("uses deterministic IDs so retried events do not duplicate delivery", async () => {
    const harness = createHarness(),
      event: NotificationEvent = {
        actorUserId: "artist_2",
        data: { actorName: "Nova", requestId: "request_1" },
        eventId: "request_1",
        recipientUserId: "artist_1",
        type: "friend.accepted",
      },
      first = await harness.dispatch(event),
      retry = await harness.dispatch(event);

    expect(first.inApp).toBe("created");
    expect(retry.inApp).toBe("duplicate");
    expect(harness.inApp[0]?.notificationId).toBe(
      harness.inApp[1]?.notificationId
    );
    expect(harness.emailAttempts).toHaveLength(2);
    expect(harness.deliveries.size).toBe(1);
  });

  it("maps important request responses to in-app and email channels", async () => {
    const events: NotificationEvent[] = [
        {
          actorUserId: "friend_2",
          data: { actorName: "Nova", requestId: "friend_request" },
          eventId: "friend_request",
          recipientUserId: "recipient_friend",
          type: "friend.accepted",
        },
        {
          actorUserId: "collaborator_2",
          data: {
            actionPath: "/dashboard/messages",
            actorName: "Nova",
            workTitle: "After Dark",
            workType: "project",
          },
          eventId: "collaboration_1",
          recipientUserId: "recipient_collaboration",
          type: "collaboration.declined",
        },
        {
          actorUserId: "opponent_2",
          data: { actorName: "Nova", challengeId: "challenge_1" },
          eventId: "challenge_1",
          recipientUserId: "recipient_battle",
          type: "battle.challenge.accepted",
        },
        {
          actorUserId: "owner_2",
          data: {
            actorName: "Nova",
            listingId: "listing_1",
            listingTitle: "Open Mic",
            requestId: "access_1",
          },
          eventId: "access_1",
          recipientUserId: "recipient_open_verse",
          type: "open_verse.access.approved",
        },
        {
          actorUserId: "owner_3",
          data: {
            actionPath: "/tracks/track_1",
            actorName: "Nova",
            trackId: "track_1",
            trackTitle: "After Dark",
          },
          eventId: "track_1",
          recipientUserId: "recipient_collaborator",
          type: "track.collaborator.live",
        },
      ],
      harness = createHarness();

    for (const event of events) {
      await harness.dispatch(event);
    }

    expect(harness.inApp).toHaveLength(events.length);
    expect(harness.deliveries.size).toBe(events.length);
    expect(harness.inApp.map(({ event }) => event.recipientUserId)).toEqual(
      events.map(({ recipientUserId }) => recipientUserId)
    );
  });

  it("keeps account-critical email independent of activity preferences", async () => {
    const disabledPreferences = Object.fromEntries(
        Object.keys(enabledPreferences).map((key) => [key, false])
      ) as unknown as NotificationPreferences,
      harness = createHarness(disabledPreferences),
      result = await harness.dispatch({
        data: {
          actionPath: "/dashboard/settings/billing",
          body: "Your latest payment could not be completed.",
          heading: "Your payment needs attention",
          subject: "SoundKit payment issue",
        },
        eventId: "invoice_1",
        recipientUserId: "billing_user",
        type: "account.billing_issue",
      });

    expect(result.email).toBe("enqueued");
    expect(result.inApp).toBe("not_requested");
    expect(harness.deliveries.size).toBe(1);
  });

  it("creates immediate in-app messages and schedules one delayed evaluation", async () => {
    const harness = createHarness(),
      scheduled: {
        body: NotificationQueueMessage;
        delaySeconds?: number;
      }[] = [],
      notificationQueue = {
        send: (
          body: NotificationQueueMessage,
          options?: { delaySeconds?: number }
        ) => {
          scheduled.push({ body, delaySeconds: options?.delaySeconds });
          return Promise.resolve();
        },
      } as unknown as Queue<NotificationQueueMessage>,
      result = await harness.dispatch(messageEvent, { notificationQueue });

    expect(result).toEqual({ email: "scheduled", inApp: "created" });
    expect(scheduled).toEqual([
      {
        body: { event: messageEvent, kind: "evaluate_missed_message" },
        delaySeconds: 600,
      },
    ]);
    expect(harness.emailAttempts).toHaveLength(0);
  });

  it("emails live followers but keeps Premium Must Watch activity in-app only", async () => {
    const harness = createHarness(),
      sharedData = {
        artistName: "Luna",
        experienceId: "live_1",
        experienceTitle: "Studio Session",
        href: "/live/streams/live_1",
        kind: "stream" as const,
      };

    await harness.dispatch({
      actorUserId: "artist_live",
      data: sharedData,
      eventId: "live_1",
      recipientUserId: "follower_1",
      type: "artist.live",
    });
    await harness.dispatch({
      actorUserId: "artist_live",
      data: sharedData,
      eventId: "live_1",
      recipientUserId: "premium_not_follower",
      type: "live.must_watch",
    });

    expect(harness.inApp).toHaveLength(2);
    expect(harness.deliveries.size).toBe(1);
    expect([...harness.deliveries.values()][0]?.userId).toBe("follower_1");
    expect(
      defineNotificationEvent({
        actorUserId: "artist_live",
        data: sharedData,
        eventId: "live_1",
        recipientUserId: "premium_not_follower",
        type: "live.must_watch",
      }).channels.email
    ).toBe("none");
  });

  it("builds the same follow event for either valid follow route", () => {
    const input = {
        actorAccountType: "fan" as const,
        actorName: "Mika",
        actorUserId: "fan_1",
        actorUsername: "mika",
        recipientUserId: "artist_1",
      },
      profileFollowEvent = buildFollowNotificationEvent(input),
      artistFollowEvent = buildFollowNotificationEvent(input);

    expect(profileFollowEvent).toEqual(artistFollowEvent);
    expect(profileFollowEvent.eventId).toBe("fan_1:artist_1");
  });
});

describe("missed-message evaluation", () => {
  it("suppresses email after the conversation is read", async () => {
    let claimed = 0,
      delivered = 0;
    const process = createMissedMessageProcessor({
      claimCooldown: () => {
        claimed += 1;
        return Promise.resolve(true);
      },
      deliverEmail: () => {
        delivered += 1;
        return Promise.resolve();
      },
      isRecipientActive: () => Promise.resolve(false),
      isStillMissed: () => Promise.resolve(false),
    });

    await expect(process(messageEvent)).resolves.toEqual({
      email: "already_read",
    });
    expect(claimed).toBe(0);
    expect(delivered).toBe(0);
  });

  it("suppresses active recipients and enforces the conversation cooldown", async () => {
    let delivered = 0;
    const activeProcessor = createMissedMessageProcessor({
        claimCooldown: () => Promise.resolve(true),
        deliverEmail: () => {
          delivered += 1;
          return Promise.resolve();
        },
        isRecipientActive: () => Promise.resolve(true),
        isStillMissed: () => Promise.resolve(true),
      }),
      cooldownProcessor = createMissedMessageProcessor({
        claimCooldown: () => Promise.resolve(false),
        deliverEmail: () => {
          delivered += 1;
          return Promise.resolve();
        },
        isRecipientActive: () => Promise.resolve(false),
        isStillMissed: () => Promise.resolve(true),
      }),
      deliveryProcessor = createMissedMessageProcessor({
        claimCooldown: () => Promise.resolve(true),
        deliverEmail: () => {
          delivered += 1;
          return Promise.resolve();
        },
        isRecipientActive: () => Promise.resolve(false),
        isStillMissed: () => Promise.resolve(true),
      });

    await expect(activeProcessor(messageEvent)).resolves.toEqual({
      email: "recipient_active",
    });
    await expect(cooldownProcessor(messageEvent)).resolves.toEqual({
      email: "cooldown_active",
    });
    await expect(deliveryProcessor(messageEvent)).resolves.toEqual({
      email: "enqueued",
    });
    expect(delivered).toBe(1);
  });
});
