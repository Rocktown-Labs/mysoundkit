import { env } from "@soundkit/env/server";

import { logWarn } from "@/middleware/structured-logging";

type EmailSendResult =
  | { emailId: string | null; sent: true }
  | { reason: string; sent: false };

export type TransactionalEmailTemplate =
  | "artist_monthly_digest"
  | "artist_weekly_digest"
  | "fan_digest"
  | "battle_challenge"
  | "battle_reminder"
  | "battle_results"
  | "battle_outcome"
  | "billing_issue"
  | "collaborator_invite"
  | "earnings_halfway"
  | "first_stream_earning"
  | "follower"
  | "friend_request"
  | "notification"
  | "open_verse_accepted"
  | "open_verse_closed"
  | "open_verse_closing"
  | "open_verse_submitted"
  | "org_invite"
  | "platform_invite"
  | "purchase_receipt"
  | "sale_notification"
  | "track_ready"
  | "track_processing_ready"
  | "welcome"
  | "welcome_premium";

export interface SendTransactionalEmailOptions {
  idempotencyKey: string;
  payload: {
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
    battleOutcomeAudience?: "artist" | "viewer";
    battleOutcomeArtistName?: string | null;
    battleOutcomeKind?: "canceled" | "ducked" | "forfeited";
    battleOutcomeReason?: string;
    battleTitle?: string;
    trackId?: string;
    trackTitle?: string;
  };
  recipientEmail: string;
  template: TransactionalEmailTemplate;
}

const getEnvValue = (key: string) =>
  (env as unknown as Record<string, string | undefined>)[key]?.trim() ?? "";

export const getPublicSiteUrl = () =>
  getEnvValue("SOUNDKIT_PUBLIC_URL") ||
  getEnvValue("CORS_ORIGIN") ||
  "https://mysoundkit.com";

const getEmailFrom = () =>
    getEnvValue("SOUNDKIT_EMAIL_FROM") ||
    "SoundKit <noreply@news.mysoundkit.com>",
  getEmailReplyTo = () => getEnvValue("SOUNDKIT_EMAIL_REPLY_TO") || null,
  getResendApiKey = () => getEnvValue("RESEND_API_KEY");

export const isTransactionalEmailConfigured = () => Boolean(getResendApiKey());

export const verifyResendWebhook = async ({
  headers,
  payload,
}: {
  headers: Headers;
  payload: string;
}) => {
  const secret = getEnvValue("RESEND_WEBHOOK_SECRET"),
    apiKey = getResendApiKey();

  if (!apiKey || !secret) {
    return null;
  }

  const { Resend } = await import("resend"),
    resend = new Resend(apiKey);

  return resend.webhooks.verify({
    headers: {
      id: headers.get("svix-id") ?? "",
      signature: headers.get("svix-signature") ?? "",
      timestamp: headers.get("svix-timestamp") ?? "",
    },
    payload,
    webhookSecret: secret,
  });
};

const getEmailSubject = ({
    payload,
    template,
  }: Pick<SendTransactionalEmailOptions, "payload" | "template">) => {
    if (payload.subject) {
      return payload.subject;
    }

    if (template === "track_processing_ready") {
      return `${payload.trackTitle} is ready to review`;
    }

    return `${payload.trackTitle} is ready`;
  },
  getEmailTags = ({
    payload,
    template,
  }: Pick<SendTransactionalEmailOptions, "payload" | "template">) => [
    { name: "email_type", value: template },
    ...(payload.trackId ? [{ name: "track_id", value: payload.trackId }] : []),
  ];

export const sendTransactionalEmail = async ({
  idempotencyKey,
  payload,
  recipientEmail,
  template,
}: SendTransactionalEmailOptions): Promise<EmailSendResult> => {
  const apiKey = getResendApiKey();

  if (!apiKey) {
    return { reason: "resend_not_configured", sent: false };
  }

  const publicSiteUrl = getPublicSiteUrl(),
    [
      {
        renderBattleOutcomeEmail,
        renderTrackLifecycleEmail,
        renderTransactionalNotificationEmail,
      },
      { Resend },
    ] = await Promise.all([
      import("@soundkit/transactional"),
      import("resend"),
    ]),
    emailContent =
      template === "track_ready" || template === "track_processing_ready"
        ? await renderTrackLifecycleEmail({
            actionUrl: payload.actionUrl,
            artistName: payload.recipientName,
            assetBaseUrl: publicSiteUrl,
            eventType: template,
            trackTitle: payload.trackTitle ?? "Your track",
          })
        : template === "battle_outcome"
          ? await renderBattleOutcomeEmail({
              actionUrl: payload.actionUrl,
              affectedArtistName: payload.battleOutcomeArtistName,
              assetBaseUrl: publicSiteUrl,
              audience: payload.battleOutcomeAudience ?? "viewer",
              battleTitle: payload.battleTitle ?? "your SoundKit battle",
              kind: payload.battleOutcomeKind ?? "canceled",
              reason: payload.battleOutcomeReason ?? "other",
              recipientName: payload.recipientName,
              subject: getEmailSubject({ payload, template }),
            })
          : await renderTransactionalNotificationEmail({
              actionUrl: payload.actionUrl,
              assetBaseUrl: publicSiteUrl,
              body:
                payload.body ?? "Open SoundKit to review the latest update.",
              ctaLabel: payload.ctaLabel ?? "Open SoundKit",
              eyebrow: payload.eyebrow ?? "SoundKit",
              footerNote:
                payload.footerNote ??
                "You are receiving this because this email is related to your SoundKit account.",
              heading: payload.heading ?? "You have a SoundKit update",
              links: payload.links,
              previewText:
                payload.previewText ??
                "Open SoundKit to review the latest update.",
              recipientName: payload.recipientName,
              subject: getEmailSubject({ payload, template }),
            }),
    subject = getEmailSubject({ payload, template }),
    resend = new Resend(apiKey),
    replyTo = getEmailReplyTo(),
    { data, error } = await resend.emails.send(
      {
        from: getEmailFrom(),
        html: emailContent.html,
        replyTo: replyTo ? [replyTo] : undefined,
        subject,
        tags: getEmailTags({ payload, template }),
        text: emailContent.text,
        to: [recipientEmail],
      },
      { idempotencyKey }
    );

  if (error) {
    logWarn({
      error: error.message,
      event: "resend_email_failed",
      name: error.name,
      recipientEmail,
      template,
      trackId: payload.trackId,
    });

    return { reason: error.message, sent: false };
  }

  return { emailId: data?.id ?? null, sent: true };
};
