/* eslint-disable complexity, default-case, no-nested-ternary, one-var, sort-vars */
export type ActivityEmailPreference =
  | "collaborations"
  | "comments"
  | "followers"
  | "live"
  | "messages"
  | "sales"
  | "trackProcessing";

interface NotificationEntity {
  id: string;
  type: string;
}

interface NotificationEventBase {
  actorUserId?: string | null;
  aggregationKey?: string | null;
  entity?: NotificationEntity | null;
  eventId: string;
  metadata?: Record<string, unknown>;
  recipientUserId: string;
}

export type NotificationEvent = NotificationEventBase &
  (
    | {
        data: {
          actionPath: string;
          body: string;
          heading: string;
          subject: string;
        };
        type: "account.billing_issue";
      }
    | {
        data: {
          actorName: string;
          conversationId: string;
          messageId: string;
          preview: string;
        };
        type: "message.received";
      }
    | {
        data: {
          actorAccountType: "artist" | "fan";
          actorName: string;
          actorUsername?: string | null;
        };
        type: "follow.created";
      }
    | {
        data: { actorName: string; requestId: string };
        type: "friend.requested" | "friend.accepted";
      }
    | {
        data: {
          actionPath: string;
          actorName: string;
          workTitle: string;
          workType: "project" | "track";
        };
        type:
          | "collaboration.accepted"
          | "collaboration.declined"
          | "collaboration.invited";
      }
    | {
        data: {
          actorName: string;
          challengeId: string;
          format?: string;
          genre?: string;
        };
        type:
          | "battle.challenge.accepted"
          | "battle.challenge.created"
          | "battle.challenge.declined";
      }
    | {
        data: {
          actorName: string;
          battleId: string;
          battleTitle: string;
        };
        type: "battle.ducked";
      }
    | {
        data: {
          affectedArtistName: string | null;
          affectedUserId: string | null;
          audience: "artist" | "viewer";
          battleId: string;
          battleTitle: string;
          kind: "canceled" | "ducked" | "forfeited";
          reason: string;
        };
        type: "battle.outcome";
      }
    | {
        data: {
          actorName: string;
          listingId: string;
          listingTitle: string;
        };
        type: "open_verse.published";
      }
    | {
        data: {
          actorName: string;
          listingId: string;
          listingTitle: string;
          requestId: string;
        };
        type:
          | "open_verse.access.approved"
          | "open_verse.access.declined"
          | "open_verse.access.requested";
      }
    | {
        data: {
          actorName: string;
          listingId: string;
          submissionId: string;
          trackTitle: string;
        };
        type:
          | "open_verse.submission.accepted"
          | "open_verse.submission.created";
      }
    | {
        data: {
          actorName: string;
          commentId: string;
          commentPreview: string;
          videoId: string;
          videoTitle: string;
        };
        type: "video.comment.created";
      }
    | {
        data: {
          artistName: string;
          contentId: string;
          contentTitle: string;
          contentType: "project" | "track" | "video";
        };
        type: "artist.release";
      }
    | {
        data: {
          artistName: string;
          experienceId: string;
          experienceTitle: string;
          href: string;
          kind: "battle" | "party" | "stream";
        };
        type: "artist.live" | "live.must_watch" | "live.scheduled";
      }
    | {
        data: {
          actionPath: string;
          actorName: string;
          trackId: string;
          trackTitle: string;
        };
        type: "track.collaborator.live";
      }
  );

export interface NotificationEmailCopy {
  body: string;
  ctaLabel: string;
  eyebrow: string;
  footerNote?: string;
  heading: string;
  previewText: string;
  subject: string;
  template?: "battle_outcome" | "follower" | "notification";
  battleOutcomeAudience?: "artist" | "viewer";
  battleOutcomeArtistName?: string | null;
  battleOutcomeKind?: "canceled" | "ducked" | "forfeited";
  battleOutcomeReason?: string;
  battleTitle?: string;
}

export interface NotificationEventDefinition {
  channels: {
    email: "delayed" | "immediate" | "none";
    inApp: boolean;
  };
  email?: NotificationEmailCopy;
  inApp: {
    link: string;
    message: string;
    title: string;
    type: string;
  };
  preference?: ActivityEmailPreference;
}

const messagePreview = (preview: string): string => {
    const normalized = preview.trim().replaceAll(/\s+/gu, " ");
    if (!normalized) {
      return "Sent an attachment";
    }
    return normalized.length > 160
      ? `${normalized.slice(0, 157)}…`
      : normalized;
  },
  collaborationResponse = (
    event: Extract<
      NotificationEvent,
      { data: { workType: "project" | "track" } }
    >
  ): NotificationEventDefinition => {
    const accepted = event.type === "collaboration.accepted",
      status = accepted ? "accepted" : "declined",
      { actionPath, actorName, workTitle } = event.data;
    return {
      channels: { email: "immediate", inApp: true },
      email: {
        body: `${actorName} ${status} your collaboration proposal for ${workTitle}.`,
        ctaLabel: accepted ? "Open workspace" : "Open messages",
        eyebrow: `Collaboration ${status}`,
        heading: `Collaboration proposal ${status}`,
        previewText: `${actorName} ${status} your collaboration proposal for ${workTitle}.`,
        subject: `${actorName} ${status} your collaboration: ${workTitle}`,
      },
      inApp: {
        link: actionPath,
        message: `${actorName} ${status} your collaboration proposal for “${workTitle}”.`,
        title: accepted ? "Collaboration Accepted" : "Collaboration Declined",
        type: accepted ? "collaborator_accepted" : "collaborator_declined",
      },
      preference: "collaborations",
    };
  },
  battleResponse = (
    event: Extract<NotificationEvent, { data: { challengeId: string } }>
  ): NotificationEventDefinition => {
    const accepted = event.type === "battle.challenge.accepted",
      status = accepted ? "accepted" : "declined";
    return {
      channels: { email: "immediate", inApp: true },
      email: {
        body: `${event.data.actorName} ${status} your SoundKit battle challenge. Open your live dashboard to review the matchup and next steps.`,
        ctaLabel: "Open live dashboard",
        eyebrow: `Challenge ${status}`,
        heading: `Your battle challenge was ${status}`,
        previewText: `${event.data.actorName} ${status} your battle challenge.`,
        subject: `Battle challenge ${status}`,
      },
      inApp: {
        link: "/dashboard/live",
        message: `${event.data.actorName} ${status} your battle challenge.`,
        title: `Battle Challenge ${accepted ? "Accepted" : "Declined"}`,
        type: `battle_challenge_${status}`,
      },
      preference: "collaborations",
    };
  },
  openVerseAccess = (
    event: Extract<
      NotificationEvent,
      { data: { listingId: string; requestId: string } }
    >
  ): NotificationEventDefinition => {
    const actionPath = "/dashboard/open-verses";
    if (event.type === "open_verse.access.requested") {
      return {
        channels: { email: "immediate", inApp: true },
        email: {
          body: `${event.data.actorName} requested access to ${event.data.listingTitle}. Open the request to review their profile and respond.`,
          ctaLabel: "Review request",
          eyebrow: "Open Verse access",
          heading: "You have a new Open Verse access request",
          previewText: `${event.data.actorName} requested Open Verse access.`,
          subject: `Open Verse access request from ${event.data.actorName}`,
        },
        inApp: {
          link: actionPath,
          message: `${event.data.actorName} requested access to your Open Verse.`,
          title: "Open Verse access request",
          type: "open_verse_access_requested",
        },
        preference: "collaborations",
      };
    }

    const approved = event.type === "open_verse.access.approved",
      status = approved ? "approved" : "declined";
    return {
      channels: { email: "immediate", inApp: true },
      email: {
        body: `Your access request for ${event.data.listingTitle} was ${status}. Open SoundKit to review the listing.`,
        ctaLabel: "Open listing",
        eyebrow: "Open Verse access",
        heading: `Your Open Verse access was ${status}`,
        previewText: `Your Open Verse access request was ${status}.`,
        subject: `Open Verse access ${status}`,
      },
      inApp: {
        link: actionPath,
        message: `Your Open Verse access request was ${status}.`,
        title: "Open Verse access updated",
        type: `open_verse_access_${status}`,
      },
      preference: "collaborations",
    };
  };

export const defineNotificationEvent = (
  event: NotificationEvent
): NotificationEventDefinition => {
  switch (event.type) {
    case "account.billing_issue": {
      return {
        channels: { email: "immediate", inApp: false },
        email: {
          body: event.data.body,
          ctaLabel: "Update billing",
          eyebrow: "Account action required",
          heading: event.data.heading,
          previewText: event.data.heading,
          subject: event.data.subject,
        },
        inApp: {
          link: event.data.actionPath,
          message: event.data.body,
          title: event.data.heading,
          type: "billing_issue",
        },
      };
    }
    case "message.received": {
      const preview = messagePreview(event.data.preview);
      return {
        channels: { email: "delayed", inApp: true },
        email: {
          body: `${event.data.actorName} sent you a message: “${preview}”`,
          ctaLabel: "Open conversation",
          eyebrow: "New message",
          heading: `New message from ${event.data.actorName}`,
          previewText: `New message from ${event.data.actorName}`,
          subject: `New message from ${event.data.actorName}`,
        },
        inApp: {
          link: `/dashboard/messages?conversationId=${encodeURIComponent(event.data.conversationId)}`,
          message: preview,
          title: `Message from ${event.data.actorName}`,
          type: "chat_message",
        },
        preference: "messages",
      };
    }
    case "follow.created": {
      const isFan = event.data.actorAccountType === "fan";
      return {
        channels: { email: "immediate", inApp: true },
        email: {
          body: isFan
            ? `${event.data.actorName} became a fan of your SoundKit profile.`
            : `${event.data.actorName} started following your SoundKit profile.`,
          ctaLabel: isFan ? "View fans" : "View artist",
          eyebrow: isFan ? "New fan" : "New follower",
          heading: isFan ? "You have a new fan" : "You have a new follower",
          previewText: `${event.data.actorName} ${isFan ? "became a fan" : "followed you"} on SoundKit.`,
          subject: `${event.data.actorName} ${isFan ? "became a fan" : "followed you"} on SoundKit`,
          template: "follower",
        },
        inApp: {
          link:
            event.data.actorUsername && !isFan
              ? `/artist/${event.data.actorUsername}`
              : "/dashboard/collaborators?tab=following",
          message: `${event.data.actorName} ${isFan ? "became a fan of" : "followed"} your SoundKit profile.`,
          title: isFan ? "New Fan" : "New Artist Follower",
          type: isFan ? "fan_follower" : "artist_follower",
        },
        preference: "followers",
      };
    }
    case "friend.requested": {
      return {
        channels: { email: "immediate", inApp: true },
        email: {
          body: `${event.data.actorName} sent you an artist friend request on SoundKit. Accept it to start messaging.`,
          ctaLabel: "Review request",
          eyebrow: "Friend request",
          heading: "You have a new artist friend request",
          previewText: `${event.data.actorName} wants to connect with you.`,
          subject: `${event.data.actorName} sent you a friend request`,
        },
        inApp: {
          link: "/dashboard/collaborators?tab=requests",
          message: `${event.data.actorName} sent you a friend request.`,
          title: "New Friend Request",
          type: "artist_friend_request",
        },
        preference: "collaborations",
      };
    }
    case "friend.accepted": {
      return {
        channels: { email: "immediate", inApp: true },
        email: {
          body: `${event.data.actorName} accepted your artist friend request. You can start a conversation now.`,
          ctaLabel: "Start chatting",
          eyebrow: "Friend request accepted",
          heading: "Your friend request was accepted",
          previewText: `${event.data.actorName} accepted your friend request.`,
          subject: `${event.data.actorName} accepted your friend request`,
        },
        inApp: {
          link: `/dashboard/messages?friendId=${encodeURIComponent(event.actorUserId ?? "")}`,
          message: `${event.data.actorName} accepted your friend request. You can start a chat now.`,
          title: "Friend Request Accepted",
          type: "artist_friend_accepted",
        },
        preference: "collaborations",
      };
    }
    case "collaboration.accepted":
    case "collaboration.declined": {
      return collaborationResponse(event);
    }
    case "collaboration.invited": {
      return {
        channels: { email: "immediate", inApp: true },
        email: {
          body: `${event.data.actorName} invited you to collaborate on ${event.data.workTitle}.`,
          ctaLabel: "Open invite",
          eyebrow: "Collaboration",
          heading: "You have a collaboration invite",
          previewText: `${event.data.actorName} invited you to collaborate on ${event.data.workTitle}.`,
          subject: `Collaboration invite: ${event.data.workTitle}`,
        },
        inApp: {
          link: event.data.actionPath,
          message: `${event.data.actorName} added you as a collaborator on ${event.data.workTitle}.`,
          title: "New Collaboration",
          type: "collaborator_invite",
        },
        preference: "collaborations",
      };
    }
    case "battle.challenge.created": {
      return {
        channels: { email: "immediate", inApp: true },
        email: {
          body: `${event.data.actorName} challenged you to a ${(event.data.format ?? "live").replaceAll("_", " ")} ${event.data.genre ?? "artist"} battle.`,
          ctaLabel: "Review challenge",
          eyebrow: "Battle invite",
          heading: "You have a new battle challenge",
          previewText: `${event.data.actorName} challenged you to a battle.`,
          subject: "You have a new battle challenge",
        },
        inApp: {
          link: "/dashboard/live/challenge",
          message: `${event.data.actorName} challenged you to a ${(event.data.format ?? "live").replaceAll("_", " ")} ${event.data.genre ?? "artist"} battle.`,
          title: "New Battle Challenge",
          type: "battle_challenge",
        },
        preference: "collaborations",
      };
    }
    case "battle.challenge.accepted":
    case "battle.challenge.declined": {
      return battleResponse(event);
    }
    case "battle.ducked": {
      const actionPath = `/live/battles/${encodeURIComponent(event.data.battleId)}`;
      return {
        channels: { email: "immediate", inApp: true },
        email: {
          body: `${event.data.actorName} marked you as ducked in “${event.data.battleTitle}” because you did not enter the waiting room. No rating was changed. If this was a mistake, open the battle to contact SoundKit support.`,
          ctaLabel: "Review battle",
          eyebrow: "Battle no-show",
          heading: "You were ducked in a battle",
          previewText: `You were marked as ducked in ${event.data.battleTitle}.`,
          subject: `You were ducked in ${event.data.battleTitle}`,
        },
        inApp: {
          link: actionPath,
          message: `${event.data.actorName} marked you as ducked in “${event.data.battleTitle}”. No rating was changed.`,
          title: "You were ducked",
          type: "battle_ducked",
        },
        preference: "live",
      };
    }
    case "battle.outcome": {
      const actionPath = `/live/battles/${encodeURIComponent(event.data.battleId)}`,
        isArtist = event.data.audience === "artist",
        isDucked = event.data.kind === "ducked",
        isForfeit = event.data.kind === "forfeited",
        isPlatformIssue =
          event.data.reason === "platform_issue" ||
          event.data.reason === "technical_issue",
        artistName = event.data.affectedArtistName ?? "One of the artists",
        body = isArtist
          ? isForfeit
            ? `We heard the news: you forfeited “${event.data.battleTitle}”. On SoundKit, stepping away from an active match is recorded as ducking the smoke. No rating was changed.`
            : `We heard the news: you were marked as the artist who ducked “${event.data.battleTitle}” because you did not show up in the waiting room. No rating was changed. If this was a mistake, contact SoundKit support.`
          : isDucked
            ? `Unfortunately, ${artistName} ducked the smoke in “${event.data.battleTitle}”, so the battle was canceled before a rated result. No ratings were changed.`
            : isForfeit
              ? `${artistName} forfeited “${event.data.battleTitle}”. The battle has ended, and no new audience votes or rating changes will be recorded.`
              : isPlatformIssue
                ? `SoundKit dropped the ball on “${event.data.battleTitle}”, so we canceled the battle before a rated result. We are sorry for the interruption. No ratings were changed.`
                : `“${event.data.battleTitle}” was canceled before a rated result was recorded. No ratings were changed.`,
        heading = isArtist
          ? "You Ducked the Smoke"
          : isForfeit
            ? "The battle ended by forfeit"
            : isPlatformIssue
              ? "SoundKit canceled the battle"
              : isDucked
                ? "The battle was ducked"
                : "The battle was canceled";
      return {
        channels: { email: "immediate", inApp: true },
        email: {
          battleOutcomeArtistName: event.data.affectedArtistName,
          battleOutcomeAudience: event.data.audience,
          battleOutcomeKind: event.data.kind,
          battleOutcomeReason: event.data.reason,
          battleTitle: event.data.battleTitle,
          body,
          ctaLabel: isArtist ? "Open artist battles" : "View battle outcome",
          eyebrow: isArtist
            ? isForfeit
              ? "Battle forfeit"
              : "Battle no-show"
            : isPlatformIssue
              ? "SoundKit platform issue"
              : isForfeit
                ? "Battle ended"
                : "Battle canceled",
          footerNote: isArtist
            ? "You are receiving this because an outcome was recorded for a battle involving your SoundKit artist account."
            : "You are receiving this because you joined or watched this SoundKit battle.",
          heading,
          previewText: isArtist
            ? isForfeit
              ? `Your forfeit ended ${event.data.battleTitle}.`
              : `You were marked as ducking ${event.data.battleTitle}.`
            : body,
          subject: isArtist
            ? "You Ducked the Smoke"
            : `${event.data.battleTitle} battle update`,
          template: "battle_outcome",
        },
        inApp: {
          link: actionPath,
          message: body,
          title: heading,
          type: isArtist ? "battle_outcome_artist" : "battle_outcome_viewer",
        },
        preference: "live",
      };
    }
    case "open_verse.published": {
      return {
        channels: { email: "immediate", inApp: true },
        email: {
          body: `${event.data.actorName} posted a new Open Verse opportunity: ${event.data.listingTitle}. Open it to hear the track and submit your verse.`,
          ctaLabel: "View Open Verse",
          eyebrow: "New Open Verse",
          heading: "A new collaboration opportunity is open",
          previewText: `${event.data.actorName} posted ${event.data.listingTitle}.`,
          subject: `New Open Verse from ${event.data.actorName}`,
        },
        inApp: {
          link: "/dashboard/open-verses",
          message: `${event.data.actorName} posted a new Open Verse: ${event.data.listingTitle}.`,
          title: "New Open Verse",
          type: "open_verse_published",
        },
        preference: "collaborations",
      };
    }
    case "open_verse.access.approved":
    case "open_verse.access.declined":
    case "open_verse.access.requested": {
      return openVerseAccess(event);
    }
    case "open_verse.submission.created": {
      return {
        channels: { email: "immediate", inApp: true },
        email: {
          body: `${event.data.actorName} submitted a verse for ${event.data.trackTitle}. Open it to listen and respond.`,
          ctaLabel: "Review submission",
          eyebrow: "Open Verse",
          heading: "You have a new Open Verse submission",
          previewText: `${event.data.actorName} submitted a verse for ${event.data.trackTitle}.`,
          subject: `New Open Verse submission for ${event.data.trackTitle}`,
        },
        inApp: {
          link: "/dashboard/open-verses",
          message: `${event.data.actorName} submitted a verse for ${event.data.trackTitle}.`,
          title: "New Open Verse submission",
          type: "open_verse_submission",
        },
        preference: "collaborations",
      };
    }
    case "open_verse.submission.accepted": {
      return {
        channels: { email: "immediate", inApp: true },
        email: {
          body: `Your verse for ${event.data.trackTitle} was accepted. Open the collaboration to review the track.`,
          ctaLabel: "Open collaboration",
          eyebrow: "Verse accepted",
          heading: "Your Open Verse was accepted",
          previewText: `Your verse for ${event.data.trackTitle} was accepted.`,
          subject: `Your verse for ${event.data.trackTitle} was accepted`,
        },
        inApp: {
          link: "/dashboard/open-verses",
          message: `Your verse for ${event.data.trackTitle} was accepted.`,
          title: "Open Verse accepted",
          type: "open_verse_accepted",
        },
        preference: "collaborations",
      };
    }
    case "video.comment.created": {
      return {
        channels: { email: "immediate", inApp: true },
        email: {
          body: `${event.data.actorName} commented on ${event.data.videoTitle}: “${messagePreview(event.data.commentPreview)}”`,
          ctaLabel: "View comment",
          eyebrow: "New comment",
          heading: "Someone commented on your content",
          previewText: `${event.data.actorName} commented on ${event.data.videoTitle}.`,
          subject: `New comment on ${event.data.videoTitle}`,
        },
        inApp: {
          link: `/videos/${event.data.videoId}#comments`,
          message: `${event.data.actorName} commented: “${messagePreview(event.data.commentPreview)}”`,
          title: "New comment",
          type: "video_comment",
        },
        preference: "comments",
      };
    }
    case "artist.release": {
      const contentPath =
        event.data.contentType === "project"
          ? `/projects/${event.data.contentId}`
          : event.data.contentType === "video"
            ? `/videos/${event.data.contentId}`
            : `/tracks/${event.data.contentId}`;
      return {
        channels: { email: "immediate", inApp: true },
        email: {
          body: `${event.data.artistName} just released ${event.data.contentTitle}. Listen or watch it now on SoundKit.`,
          ctaLabel:
            event.data.contentType === "video" ? "Watch now" : "Listen now",
          eyebrow: "New release",
          heading: `${event.data.artistName} just released ${event.data.contentTitle}`,
          previewText: `${event.data.artistName} just released ${event.data.contentTitle}.`,
          subject: `New from ${event.data.artistName}: ${event.data.contentTitle}`,
          template: "follower",
        },
        inApp: {
          link: contentPath,
          message: `“${event.data.contentTitle}” is now available.`,
          title: "New release available",
          type: `${event.data.contentType}_release`,
        },
        preference: "followers",
      };
    }
    case "live.scheduled": {
      return {
        channels: { email: "immediate", inApp: true },
        email: {
          body: `${event.data.artistName} scheduled ${event.data.experienceTitle}. Open SoundKit to view the event time and join when it starts.`,
          ctaLabel: "View event",
          eyebrow: "Live event scheduled",
          heading: `${event.data.artistName} scheduled a live ${event.data.kind}`,
          previewText: `${event.data.experienceTitle} is scheduled on SoundKit.`,
          subject: `${event.data.artistName} scheduled ${event.data.experienceTitle}`,
          template: "follower",
        },
        inApp: {
          link: event.data.href,
          message: `${event.data.artistName} scheduled ${event.data.experienceTitle}.`,
          title: "Live event scheduled",
          type: `${event.data.kind}_scheduled`,
        },
        preference: "followers",
      };
    }
    case "artist.live": {
      return {
        channels: { email: "immediate", inApp: true },
        email: {
          body: `${event.data.artistName} is live with ${event.data.experienceTitle}. Tap in to watch, chat, and react.`,
          ctaLabel: "Join live room",
          eyebrow: "Live now",
          heading: `${event.data.artistName} is live`,
          previewText: `${event.data.experienceTitle} is live on SoundKit.`,
          subject: `${event.data.artistName} is live on SoundKit`,
          template: "follower",
        },
        inApp: {
          link: event.data.href,
          message: `${event.data.experienceTitle} is live. Tap in to watch, chat, and react.`,
          title: `${event.data.experienceTitle} is live`,
          type: `live_${event.data.kind}_live`,
        },
        preference: "live",
      };
    }
    case "live.must_watch": {
      return {
        channels: { email: "none", inApp: true },
        inApp: {
          link: event.data.href,
          message: `${event.data.experienceTitle} is live. Premium watchers get the full Must Watch room.`,
          title: `Must Watch: ${event.data.experienceTitle} is live`,
          type: `live_${event.data.kind}_must_watch`,
        },
      };
    }
    case "track.collaborator.live": {
      return {
        channels: { email: "immediate", inApp: true },
        email: {
          body: `${event.data.actorName} published ${event.data.trackTitle}, a track you collaborated on. Open it to review the live release.`,
          ctaLabel: "Open track",
          eyebrow: "Collaboration release",
          heading: "Your collaboration is live",
          previewText: `${event.data.trackTitle} is now live on SoundKit.`,
          subject: `Your collaboration is live: ${event.data.trackTitle}`,
        },
        inApp: {
          link: event.data.actionPath,
          message: `“${event.data.trackTitle}” is live on SoundKit.`,
          title: "Your collaboration is live",
          type: "collaborator_track_live",
        },
        preference: "collaborations",
      };
    }
  }
};
