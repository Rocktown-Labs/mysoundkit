/* eslint-disable complexity, unicorn/max-nested-calls, sort-vars, one-var, no-nested-ternary, unicorn/no-nested-ternary, unicorn/no-await-expression-member, unicorn/no-negated-condition, unicorn/prefer-number-properties, unicorn/prefer-ternary */
import { createDb, isDatabaseConfigured } from "@soundkit/db";
import {
  artistFollows,
  notificationSettings,
  openVerseListings,
  orderItems,
  orders,
  battles,
  purchases,
  trackAssets,
  tracks,
  userFollows,
  userNotifications,
  userProfiles,
} from "@soundkit/db/schema/app";
import { user as authUser, subscription } from "@soundkit/db/schema/auth";
import { communitySubscriptions } from "@soundkit/db/schema/communities";
import { and, eq, inArray, or, sql } from "drizzle-orm";

import { createSignedMediaSourceUrl } from "@/lib/media-signing";
import { enqueueTransactionalEmail } from "@/lib/email-delivery";
import type { EmailDeliveryQueueMessage } from "@/lib/email-delivery";

type EmailPreference = "collaborations" | "followers" | "sales";

interface Recipient {
  email: string;
  name: string;
  userId: string;
}

const accountFooter =
    "You are receiving this because this email is about billing or account access.",
  collaborationFooter =
    "You are receiving this because collaboration emails are turned on for your SoundKit account.",
  followerFooter =
    "You are receiving this because follower emails are turned on for your SoundKit account.",
  salesFooter =
    "You are receiving this because sales emails are turned on for your SoundKit account.",
  formatBattleFormat = (format: string) => format.replaceAll("_", " "),
  formatMoney = (amountCents: number | null | undefined) =>
    typeof amountCents === "number"
      ? new Intl.NumberFormat("en-US", {
          currency: "USD",
          style: "currency",
        }).format(amountCents / 100)
      : "the order total",
  getUserRecipient = async (userId: string): Promise<Recipient | null> => {
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

    return recipient
      ? {
          email: recipient.email,
          name: recipient.name ?? "there",
          userId: recipient.userId,
        }
      : null;
  },
  shouldSendEmail = async ({
    preference,
    userId,
  }: {
    preference?: EmailPreference;
    userId?: string | null;
  }) => {
    if (!(preference && userId && isDatabaseConfigured())) {
      return true;
    }

    const [settings] = await createDb()
      .select({
        emailCollaborations: notificationSettings.emailCollaborations,
        emailFollowers: notificationSettings.emailFollowers,
        emailSales: notificationSettings.emailSales,
      })
      .from(notificationSettings)
      .where(eq(notificationSettings.userId, userId))
      .limit(1);

    if (preference === "sales") {
      return settings?.emailSales ?? true;
    }

    if (preference === "followers") {
      return settings?.emailFollowers ?? true;
    }

    return settings?.emailCollaborations ?? true;
  },
  enqueueForRecipient = async ({
    actionPath,
    body,
    ctaLabel,
    eyebrow,
    footerNote,
    heading,
    idempotencyKey,
    links,
    preference,
    previewText,
    queue,
    recipient,
    subject,
    template,
  }: {
    actionPath: string;
    body: string;
    ctaLabel: string;
    eyebrow: string;
    footerNote: string;
    heading: string;
    idempotencyKey: string;
    links?: {
      description?: string;
      href: string;
      label: string;
    }[];
    preference?: EmailPreference;
    previewText: string;
    queue?: Queue<EmailDeliveryQueueMessage> | null;
    recipient: Recipient;
    subject: string;
    template:
      | "artist_monthly_digest"
      | "artist_weekly_digest"
      | "fan_digest"
      | "battle_challenge"
      | "battle_reminder"
      | "battle_results"
      | "billing_issue"
      | "collaborator_invite"
      | "earnings_halfway"
      | "first_stream_earning"
      | "follower"
      | "friend_request"
      | "open_verse_accepted"
      | "open_verse_closed"
      | "open_verse_closing"
      | "open_verse_submitted"
      | "purchase_receipt"
      | "sale_notification";
  }) => {
    if (!(await shouldSendEmail({ preference, userId: recipient.userId }))) {
      return { enqueued: false, reason: "preference_disabled" as const };
    }

    return enqueueTransactionalEmail({
      actionPath,
      idempotencyKey,
      payload: {
        body,
        ctaLabel,
        eyebrow,
        footerNote,
        heading,
        links,
        previewText,
        subject,
      },
      queue,
      recipientEmail: recipient.email,
      recipientName: recipient.name,
      template,
      userId: recipient.userId,
    });
  },
  notifyBattleRecipients = async ({
    battleId,
    idempotencyPrefix,
    queue,
    resultsSummary,
    type,
  }: {
    battleId: string;
    idempotencyPrefix: string;
    queue?: Queue<EmailDeliveryQueueMessage> | null;
    resultsSummary?: string | null;
    type: "reminder" | "results";
  }) => {
    const [battle] = await createDb()
      .select({
        challengerArtistUserId: battles.challengerArtistUserId,
        id: battles.id,
        opponentArtistUserId: battles.opponentArtistUserId,
        replayVideoId: battles.replayVideoId,
        title: battles.title,
      })
      .from(battles)
      .where(
        or(eq(battles.id, battleId), eq(battles.externalBattleId, battleId))
      )
      .limit(1);

    if (!battle) {
      return { enqueued: false, reason: "battle_not_found" as const };
    }

    const participantUserIds = [
        battle.challengerArtistUserId,
        battle.opponentArtistUserId,
      ].filter((userId): userId is string => Boolean(userId)),
      followerUserIds = new Set<string>();

    if (type === "results" && participantUserIds.length > 0) {
      const [artistFollowerRows, profileFollowerRows] = await Promise.all([
        createDb()
          .select({ userId: artistFollows.followerUserId })
          .from(artistFollows)
          .where(inArray(artistFollows.artistUserId, participantUserIds)),
        createDb()
          .select({ userId: userFollows.followerUserId })
          .from(userFollows)
          .where(inArray(userFollows.targetUserId, participantUserIds)),
      ]);

      for (const follower of [
        ...artistFollowerRows,
        ...profileFollowerRows,
      ]) {
        followerUserIds.add(follower.userId);
      }
    }

    const recipientUserIds = [
        ...new Set([...participantUserIds, ...followerUserIds]),
      ],
      replayPath = battle.replayVideoId
        ? `/videos/${battle.replayVideoId}`
        : `/live/battles/${battle.id}`,
      deliveries = [];

    for (const recipientUserId of recipientUserIds) {
      if (type === "reminder") {
        await createDb()
          .insert(userNotifications)
          .values({
            id: `battle_reminder:${battle.id}:${recipientUserId}`,
            link: `/live/battles/${battle.id}`,
            message: `"${battle.title}" starts soon! Enter the room now to check your audio.`,
            title: "Battle Starting Soon",
            type: "battle_starting",
            userId: recipientUserId,
          })
          .onConflictDoNothing();

        deliveries.push(
          await notifyBattleReminderEmail({
            battleId: battle.id,
            battleTitle: battle.title,
            idempotencyScope: idempotencyPrefix,
            queue,
            recipientUserId,
          })
        );
      } else {
        await createDb()
          .insert(userNotifications)
          .values({
            id: `battle_results:${battle.id}:${recipientUserId}`,
            link: replayPath,
            message: `"${battle.title}" is complete. Review your final round scores and voting breakdown.`,
            title: "Battle Results Ready",
            type: "battle_results",
            userId: recipientUserId,
          })
          .onConflictDoNothing();

        deliveries.push(
          await notifyBattleResultsEmail({
            battleId: battle.id,
            battleTitle: battle.title,
            idempotencyScope: idempotencyPrefix,
            preference: followerUserIds.has(recipientUserId)
              ? "followers"
              : "collaborations",
            queue,
            recipientUserId,
            replayPath,
            resultsSummary:
              resultsSummary ??
              "The final round data has been saved to your dashboard.",
          })
        );
      }
    }

    return {
      deliveries,
      enqueued: deliveries.length > 0,
      idempotencyPrefix,
    };
  };

export const notifyBattleChallengeEmail = async ({
  battleFormat,
  challengerName,
  challengeId,
  genre,
  opponentUserId,
  queue,
}: {
  battleFormat: string;
  challengerName: string;
  challengeId: string;
  genre: string;
  opponentUserId: string;
  queue?: Queue<EmailDeliveryQueueMessage> | null;
}) => {
  const recipient = await getUserRecipient(opponentUserId);

  if (!recipient) {
    return { enqueued: false, reason: "recipient_not_found" as const };
  }

  return enqueueForRecipient({
    actionPath: "/dashboard/live/challenge",
    body: `${challengerName} challenged you to a ${formatBattleFormat(battleFormat)} ${genre} battle. Open the challenge to review the details and respond when you are ready.`,
    ctaLabel: "Review challenge",
    eyebrow: "Battle invite",
    footerNote: collaborationFooter,
    heading: "You have a new battle challenge",
    idempotencyKey: `battle-challenge/${challengeId}/${opponentUserId}`,
    preference: "collaborations",
    previewText: `${challengerName} challenged you to a battle on SoundKit.`,
    queue,
    recipient,
    subject: "You have a new battle challenge",
    template: "battle_challenge",
  });
};

export const notifyBattleReminderEmail = async ({
  battleId,
  battleTitle,
  idempotencyScope,
  recipientUserId,
  queue,
}: {
  battleId: string;
  battleTitle: string;
  idempotencyScope?: string;
  recipientUserId: string;
  queue?: Queue<EmailDeliveryQueueMessage> | null;
}) => {
  const recipient = await getUserRecipient(recipientUserId);

  if (!recipient) {
    return { enqueued: false, reason: "recipient_not_found" as const };
  }

  return enqueueForRecipient({
    actionPath: "/dashboard/live",
    body: `${battleTitle} starts soon. Open the room to make sure your tracks, chat, and battle setup are ready before listeners arrive.`,
    ctaLabel: "Open battle room",
    eyebrow: "Starts soon",
    footerNote: collaborationFooter,
    heading: "Your battle is coming up",
    idempotencyKey: `battle-reminder/${idempotencyScope ?? battleId}/${recipientUserId}`,
    preference: "collaborations",
    previewText: `${battleTitle} starts soon.`,
    queue,
    recipient,
    subject: `${battleTitle} starts soon`,
    template: "battle_reminder",
  });
};

export const notifyBattleResultsEmail = async ({
  battleId,
  battleTitle,
  idempotencyScope,
  preference = "collaborations",
  recipientUserId,
  replayPath,
  resultsSummary,
  queue,
}: {
  battleId: string;
  battleTitle: string;
  idempotencyScope?: string;
  preference?: EmailPreference;
  recipientUserId: string;
  replayPath: string;
  resultsSummary: string;
  queue?: Queue<EmailDeliveryQueueMessage> | null;
}) => {
  const recipient = await getUserRecipient(recipientUserId);

  if (!recipient) {
    return { enqueued: false, reason: "recipient_not_found" as const };
  }

  return enqueueForRecipient({
    actionPath: replayPath,
    body: `${battleTitle} is complete. ${resultsSummary} Open the replay to review the battle.`,
    ctaLabel: "Watch replay",
    eyebrow: "Battle replay",
    footerNote:
      preference === "followers" ? followerFooter : collaborationFooter,
    heading: "The battle replay is ready",
    idempotencyKey: `battle-results/${idempotencyScope ?? battleId}/${recipientUserId}`,
    preference,
    previewText: `${battleTitle} replay is ready.`,
    queue,
    recipient,
    subject: `${battleTitle} replay is ready`,
    template: "battle_results",
  });
};

export const notifyBattleReminderEmailsForBattle = ({
  battleId,
  eventId,
  queue,
}: {
  battleId: string;
  eventId: string;
  queue?: Queue<EmailDeliveryQueueMessage> | null;
}) =>
  notifyBattleRecipients({
    battleId,
    idempotencyPrefix: `battle-reminder-event/${eventId}`,
    queue,
    type: "reminder",
  });

export const notifyBattleResultsEmailsForBattle = ({
  battleId,
  eventId,
  queue,
  resultsSummary,
}: {
  battleId: string;
  eventId: string;
  queue?: Queue<EmailDeliveryQueueMessage> | null;
  resultsSummary?: string | null;
}) =>
  notifyBattleRecipients({
    battleId,
    idempotencyPrefix: `battle-results-event/${eventId}`,
    queue,
    resultsSummary,
    type: "results",
  });

export const notifyOpenVerseSubmittedEmail = async ({
  listingId,
  queue,
  submissionId,
  submitterName,
}: {
  listingId: string;
  queue?: Queue<EmailDeliveryQueueMessage> | null;
  submissionId: string;
  submitterName: string;
}) => {
  const [listing] = await createDb()
    .select({
      ownerUserId: openVerseListings.ownerUserId,
      title: openVerseListings.title,
      trackTitle: tracks.title,
    })
    .from(openVerseListings)
    .innerJoin(tracks, eq(tracks.id, openVerseListings.trackId))
    .where(eq(openVerseListings.id, listingId))
    .limit(1);

  if (!listing) {
    return { enqueued: false, reason: "listing_not_found" as const };
  }

  const recipient = await getUserRecipient(listing.ownerUserId);

  if (!recipient) {
    return { enqueued: false, reason: "recipient_not_found" as const };
  }

  return enqueueForRecipient({
    actionPath: "/dashboard/open-verses",
    body: `${submitterName} submitted a verse for ${listing.trackTitle}. Open the submission to listen, review the message, and decide whether it fits the track.`,
    ctaLabel: "Review submission",
    eyebrow: "Open verse",
    footerNote: collaborationFooter,
    heading: "You have a new open verse submission",
    idempotencyKey: `open-verse-submitted/${submissionId}`,
    preference: "collaborations",
    previewText: `${submitterName} submitted a verse for ${listing.trackTitle}.`,
    queue,
    recipient,
    subject: `New open verse submission for ${listing.trackTitle}`,
    template: "open_verse_submitted",
  });
};

export const notifyOpenVerseAcceptedEmail = async ({
  listingId,
  queue,
  submissionId,
  submitterUserId,
}: {
  listingId: string;
  queue?: Queue<EmailDeliveryQueueMessage> | null;
  submissionId: string;
  submitterUserId: string;
}) => {
  const [listing] = await createDb()
      .select({
        trackTitle: tracks.title,
      })
      .from(openVerseListings)
      .innerJoin(tracks, eq(tracks.id, openVerseListings.trackId))
      .where(eq(openVerseListings.id, listingId))
      .limit(1),
    recipient = await getUserRecipient(submitterUserId);

  if (!(listing && recipient)) {
    return { enqueued: false, reason: "recipient_not_found" as const };
  }

  return enqueueForRecipient({
    actionPath: "/dashboard/open-verses",
    body: `Your verse for ${listing.trackTitle} was accepted. You have been added to the track credits so the artist can keep building from there.`,
    ctaLabel: "Open collaboration",
    eyebrow: "Verse accepted",
    footerNote: collaborationFooter,
    heading: "Your open verse was accepted",
    idempotencyKey: `open-verse-accepted/${submissionId}`,
    preference: "collaborations",
    previewText: `Your verse for ${listing.trackTitle} was accepted.`,
    queue,
    recipient,
    subject: `Your verse for ${listing.trackTitle} was accepted`,
    template: "open_verse_accepted",
  });
};

const PURCHASE_LINK_TTL_SECONDS = 72 * 60 * 60;

type SoundKitDb = ReturnType<typeof createDb>;

// Resolve each purchased track to its download-quality derivative (falling
// back to streaming) and mint a signed 72h URL for the buyer email.
const buildPurchaseDownloadLinks = async (
    db: SoundKitDb,
    trackIds: (null | string)[]
  ): Promise<
    { description?: string; href: string; label: string }[]
  > => {
    const links: { description?: string; href: string; label: string }[] = [];

    for (const trackId of trackIds.filter((id): id is string => Boolean(id))) {
      const [row] = await db
        .select({
          assetId: trackAssets.id,
          title: tracks.title,
        })
        .from(trackAssets)
        .innerJoin(tracks, eq(tracks.id, trackAssets.trackId))
        .where(
          and(
            eq(trackAssets.trackId, trackId),
            eq(trackAssets.isCurrent, true),
            or(
              eq(trackAssets.purpose, "download"),
              eq(trackAssets.purpose, "streaming")
            )
          )
        )
        .orderBy(
          sql`case when ${trackAssets.purpose} = 'download' then 0 else 1 end`
        )
        .limit(1);

      if (!row) {
        continue;
      }

      const href = await createSignedMediaSourceUrl({
        assetId: row.assetId,
        ttlSeconds: PURCHASE_LINK_TTL_SECONDS,
        trackId,
      });

      links.push({
        description: "Direct download link, valid for 72 hours",
        href,
        label: `Download ${row.title}`,
      });
    }

    return links;
  };

export const notifyPurchaseEmails = async ({
  orderId,
  queue,
}: {
  orderId: string;
  queue?: Queue<EmailDeliveryQueueMessage> | null;
}) => {
  const db = createDb(),
    [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

  if (!order) {
    return { enqueued: false, reason: "order_not_found" as const };
  }

  const [buyer, seller, items] = await Promise.all([
      getUserRecipient(order.buyerUserId),
      order.sellerUserId ? getUserRecipient(order.sellerUserId) : null,
      db.select().from(orderItems).where(eq(orderItems.orderId, order.id)),
    ]),
    itemTitle = items[0]?.titleSnapshot ?? "your purchase",
    itemSummary =
      items.length > 1
        ? `${itemTitle} and ${items.length - 1} more`
        : itemTitle,
    amount = formatMoney(order.totalCents),
    firstPurchase = await db
      .select({ id: purchases.id })
      .from(purchases)
      .innerJoin(orderItems, eq(orderItems.id, purchases.orderItemId))
      .where(eq(orderItems.orderId, order.id))
      .limit(1),
    purchasePath = firstPurchase[0]?.id
      ? `/library/purchased/${firstPurchase[0].id}`
      : "/library/purchased",
    // Direct download links (72h signed URLs) let the buyer grab files
    // without logging in; the library CTA stays the permanent path.
    downloadLinks = await buildPurchaseDownloadLinks(
      db,
      items.map((item) => item.trackId)
    ),
    deliveries = [];

  if (buyer) {
    deliveries.push(
      await enqueueForRecipient({
        actionPath: purchasePath,
        body: `Your purchase is complete. ${itemSummary} is now in your SoundKit library, and your files are ready when you are.`,
        ctaLabel: "Open purchase",
        eyebrow: "Receipt",
        footerNote: salesFooter,
        heading: "Your purchase is ready",
        idempotencyKey: `purchase-receipt/${order.id}/${buyer.userId}`,
        links: downloadLinks,
        preference: "sales",
        previewText: "Your SoundKit purchase is ready.",
        queue,
        recipient: buyer,
        subject: "Your SoundKit purchase is ready",
        template: "purchase_receipt",
      })
    );
  }

  if (seller) {
    deliveries.push(
      await enqueueForRecipient({
        actionPath: "/dashboard/career/payments",
        body: `${buyer?.name ?? "Someone"} bought ${itemSummary} for ${amount}. Open your dashboard to review the order and keep an eye on your sales activity.`,
        ctaLabel: "View sale",
        eyebrow: "New sale",
        footerNote: salesFooter,
        heading: "You made a sale",
        idempotencyKey: `sale-notification/${order.id}/${seller.userId}`,
        preference: "sales",
        previewText: `${buyer?.name ?? "Someone"} bought ${itemSummary}.`,
        queue,
        recipient: seller,
        subject: `New sale: ${itemSummary}`,
        template: "sale_notification",
      })
    );
  }

  return { deliveries, enqueued: deliveries.length > 0 };
};

export const notifyBillingIssueEmail = async ({
  queue,
  stripeCustomerId,
  stripeSubscriptionId,
  userId,
}: {
  queue?: Queue<EmailDeliveryQueueMessage> | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  userId?: string | null;
}) => {
  let resolvedUserId = userId ?? null;

  if (!(resolvedUserId || stripeCustomerId || stripeSubscriptionId)) {
    return { enqueued: false, reason: "billing_identity_missing" as const };
  }

  if (!resolvedUserId) {
    const [communitySubscription] = await createDb()
      .select({ userId: communitySubscriptions.userId })
      .from(communitySubscriptions)
      .where(
        or(
          stripeCustomerId
            ? eq(communitySubscriptions.stripeCustomerId, stripeCustomerId)
            : undefined,
          stripeSubscriptionId
            ? eq(
                communitySubscriptions.stripeSubscriptionId,
                stripeSubscriptionId
              )
            : undefined
        )
      )
      .limit(1);

    resolvedUserId = communitySubscription?.userId ?? null;
  }

  if (!resolvedUserId) {
    const [platformSubscription] = await createDb()
      .select({ referenceId: subscription.referenceId })
      .from(subscription)
      .where(
        or(
          stripeCustomerId
            ? eq(subscription.stripeCustomerId, stripeCustomerId)
            : undefined,
          stripeSubscriptionId
            ? eq(subscription.stripeSubscriptionId, stripeSubscriptionId)
            : undefined
        )
      )
      .limit(1);

    resolvedUserId = platformSubscription?.referenceId ?? null;
  }

  const recipient = resolvedUserId
    ? await getUserRecipient(resolvedUserId)
    : null;

  if (!recipient) {
    return { enqueued: false, reason: "recipient_not_found" as const };
  }

  return enqueueForRecipient({
    actionPath: "/library/settings",
    body: "We could not complete your latest SoundKit payment. Update your billing details to keep your plan and account access current.",
    ctaLabel: "Update billing",
    eyebrow: "Billing",
    footerNote: accountFooter,
    heading: "Your payment needs attention",
    idempotencyKey: `billing-issue/${stripeCustomerId ?? stripeSubscriptionId ?? recipient.userId}`,
    previewText: "Update your billing details to keep SoundKit current.",
    queue,
    recipient,
    subject: "Your SoundKit payment needs attention",
    template: "billing_issue",
  });
};

export const notifyCollaboratorInviteEmail = ({
  actionPath,
  inviterName,
  inviteEmail,
  inviteId,
  queue,
  workTitle,
  workType,
}: {
  actionPath: string;
  inviterName: string;
  inviteEmail: string;
  inviteId: string;
  queue?: Queue<EmailDeliveryQueueMessage> | null;
  workTitle: string;
  workType: "project" | "track";
}) =>
  enqueueTransactionalEmail({
    actionPath,
    idempotencyKey: `collaborator-invite/${inviteId}`,
    payload: {
      body: `${inviterName} invited you to collaborate on ${workTitle}. Open the invite to review your role and join the ${workType} workspace.`,
      ctaLabel: "Open invite",
      eyebrow: "Collaboration",
      footerNote:
        "You are receiving this because someone invited this email address to collaborate on SoundKit.",
      heading: "You have a collaboration invite",
      previewText: `${inviterName} invited you to collaborate on ${workTitle}.`,
      subject: `Collaboration invite: ${workTitle}`,
    },
    queue,
    recipientEmail: inviteEmail,
    recipientName: "there",
    template: "collaborator_invite",
  });

export const notifyCollaboratorAcceptedEmail = async ({
  actionPath,
  collaboratorName,
  ownerUserId,
  queue,
  workTitle,
  workType,
}: {
  actionPath: string;
  collaboratorName: string;
  ownerUserId: string;
  queue?: Queue<EmailDeliveryQueueMessage> | null;
  workTitle: string;
  workType: "project" | "track";
}) => {
  const recipient = await getUserRecipient(ownerUserId);

  if (!recipient) {
    return { enqueued: false, reason: "recipient_not_found" as const };
  }

  return enqueueForRecipient({
    actionPath,
    body: `${collaboratorName} accepted your collaboration proposal for ${workTitle}. The shared ${workType} workspace is unlocked and ready for you to build together.`,
    ctaLabel: "Open workspace",
    eyebrow: "Collaboration accepted",
    footerNote: collaborationFooter,
    heading: "Collaboration proposal accepted",
    idempotencyKey: `collaborator-accepted/${ownerUserId}/${workTitle}/${Date.now()}`,
    preference: "collaborations",
    previewText: `${collaboratorName} accepted your collaboration proposal for ${workTitle}.`,
    queue,
    recipient,
    subject: `${collaboratorName} joined your collaboration: ${workTitle}`,
    template: "collaborator_invite",
  });
};

export const notifyPayoutFailedEmail = async ({
  failureReason,
  queue,
  recipientUserId,
}: {
  failureReason?: string | null;
  queue?: Queue<EmailDeliveryQueueMessage> | null;
  recipientUserId: string;
}) => {
  const recipient = await getUserRecipient(recipientUserId);

  if (!recipient) {
    return { enqueued: false, reason: "recipient_not_found" as const };
  }

  return enqueueForRecipient({
    actionPath: "/dashboard/career/payments",
    body: `A scheduled payout could not be completed.${failureReason ? ` Reason: ${failureReason}.` : ""} Please open your payments dashboard and review your connected Stripe account details.`,
    ctaLabel: "Review payments",
    eyebrow: "Payout action required",
    footerNote: accountFooter,
    heading: "Payout action required",
    idempotencyKey: `payout-failed/${recipientUserId}/${Date.now()}`,
    previewText: "Your SoundKit payout requires attention.",
    queue,
    recipient,
    subject: "Action required: SoundKit payout issue",
    template: "billing_issue",
  });
};

export const notifyLiveEventScheduledEmail = async ({
  eventId,
  eventTitle,
  eventType,
  hostName,
  queue,
  recipientUserId,
}: {
  eventId: string;
  eventTitle: string;
  eventType: "battle" | "party" | "stream";
  hostName: string;
  queue?: Queue<EmailDeliveryQueueMessage> | null;
  recipientUserId: string;
}) => {
  const recipient = await getUserRecipient(recipientUserId);
  if (!recipient) {
    return { enqueued: false, reason: "recipient_not_found" as const };
  }
  const actionPath =
    eventType === "party"
      ? `/live/parties/${eventId}`
      : eventType === "stream"
        ? `/live/streams/${eventId}`
        : `/live/battles/${eventId}`;
  return enqueueForRecipient({
    actionPath,
    body: `${hostName} scheduled ${eventTitle}. Open SoundKit to view the event time and join when it starts.`,
    ctaLabel: "View event",
    eyebrow: "Live event scheduled",
    footerNote: followerFooter,
    heading: `${hostName} scheduled a live ${eventType}`,
    idempotencyKey: `live-scheduled/${eventType}/${eventId}/${recipientUserId}`,
    preference: "followers",
    previewText: `${eventTitle} is scheduled on SoundKit.`,
    queue,
    recipient,
    subject: `${hostName} scheduled ${eventTitle}`,
    template: "follower",
  });
};

export const notifyArtistReleaseEmail = async ({
  artistName,
  contentId,
  contentTitle,
  contentType,
  queue,
  recipientUserId,
}: {
  artistName: string;
  contentId: string;
  contentTitle: string;
  contentType: "project" | "track" | "video";
  queue?: Queue<EmailDeliveryQueueMessage> | null;
  recipientUserId: string;
}) => {
  const recipient = await getUserRecipient(recipientUserId);
  if (!recipient) {
    return { enqueued: false, reason: "recipient_not_found" as const };
  }

  const contentPath =
    contentType === "project"
      ? `/projects/${contentId}`
      : contentType === "video"
        ? `/videos/${contentId}`
        : `/tracks/${contentId}`;
  return enqueueForRecipient({
    actionPath: contentPath,
    body: `${artistName} just released ${contentType === "project" ? "a project" : `a ${contentType}`}: ${contentTitle}. Listen or watch it now on SoundKit.`,
    ctaLabel: contentType === "video" ? "Watch now" : "Listen now",
    eyebrow: "New release",
    footerNote: followerFooter,
    heading: `${artistName} just released ${contentTitle}`,
    idempotencyKey: `artist-release/${contentType}/${contentId}/${recipientUserId}`,
    preference: "followers",
    previewText: `${artistName} just released ${contentTitle}.`,
    queue,
    recipient,
    subject: `New from ${artistName}: ${contentTitle}`,
    template: "follower",
  });
};

export const notifyFollowerEmail = async ({
  artistUserId,
  followerName,
  followerType = "artist",
  followerUsername,
  queue,
}: {
  artistUserId: string;
  followerName: string;
  followerType?: "artist" | "fan";
  followerUsername?: string | null;
  queue?: Queue<EmailDeliveryQueueMessage> | null;
}) => {
  const recipient = await getUserRecipient(artistUserId);

  if (!recipient) {
    return { enqueued: false, reason: "recipient_not_found" as const };
  }

  const isFan = followerType === "fan";

  return enqueueForRecipient({
    actionPath:
      followerUsername && !isFan
        ? `/artist/${followerUsername}`
        : "/dashboard/collaborators?tab=following",
    body: isFan
      ? `${followerName} became a fan of your SoundKit profile. Open your collaborators dashboard to see the fan and keep building your audience.`
      : `${followerName} started following your SoundKit profile. Open their artist page to see what they are building.`,
    ctaLabel: isFan ? "View fan" : "View artist",
    eyebrow: isFan ? "New fan" : "New follower",
    footerNote: followerFooter,
    heading: isFan ? "You have a new fan" : "You have a new follower",
    idempotencyKey: `follower/${artistUserId}/${followerType}/${followerUsername ?? followerName}`,
    preference: "followers",
    previewText: isFan
      ? `${followerName} became a fan of your SoundKit profile.`
      : `${followerName} started following your SoundKit profile.`,
    queue,
    recipient,
    subject: isFan
      ? `${followerName} became a fan on SoundKit`
      : `${followerName} followed you on SoundKit`,
    template: "follower",
  });
};

export const notifyFriendRequestEmail = async ({
  recipientUserId,
  requestId,
  requesterName,
  queue,
}: {
  queue?: Queue<EmailDeliveryQueueMessage> | null;
  recipientUserId: string;
  requestId: string;
  requesterName: string;
}) => {
  const recipient = await getUserRecipient(recipientUserId);

  if (!recipient) {
    return { enqueued: false, reason: "recipient_not_found" as const };
  }

  return enqueueForRecipient({
    actionPath: "/dashboard/collaborators?tab=requests",
    body: `${requesterName} sent you an artist friend request on SoundKit. Accept it to add them to your friends list and start messaging when you are ready.`,
    ctaLabel: "Review request",
    eyebrow: "Friend request",
    footerNote: collaborationFooter,
    heading: "You have a new artist friend request",
    idempotencyKey: `friend-request/${requestId}`,
    preference: "collaborations",
    previewText: `${requesterName} wants to connect with you on SoundKit.`,
    queue,
    recipient,
    subject: `${requesterName} sent you a friend request`,
    template: "friend_request",
  });
};

export const getDisplayNameForUser = async (userId: string) => {
  if (!isDatabaseConfigured()) {
    return "Someone";
  }

  const [profile] = await createDb()
    .select({
      displayName: userProfiles.displayName,
      username: userProfiles.username,
    })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  return profile?.displayName ?? profile?.username ?? "Someone";
};

export {
  collaborationFooter,
  enqueueForRecipient,
  getUserRecipient,
};
