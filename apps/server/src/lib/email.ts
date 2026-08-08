import { env } from "@soundkit/env/server";

import { logWarn } from "@/middleware/structured-logging";

type EmailSendResult =
  | { emailId: string | null; sent: true }
  | { reason: string; sent: false };

const getEnvValue = (key: string) =>
  (env as unknown as Record<string, string | undefined>)[key]?.trim() ?? "";

const getPublicSiteUrl = () =>
  getEnvValue("SOUNDKIT_PUBLIC_URL") ||
  getEnvValue("CORS_ORIGIN") ||
  "https://mysoundkit.com";

const getEmailFrom = () =>
  getEnvValue("SOUNDKIT_EMAIL_FROM") ||
  "SoundKit <notifications@mysoundkit.com>";

const getEmailReplyTo = () => getEnvValue("SOUNDKIT_EMAIL_REPLY_TO") || null;

const getResendApiKey = () => getEnvValue("RESEND_API_KEY");

export const isTransactionalEmailConfigured = () => Boolean(getResendApiKey());

export const verifyResendWebhook = async ({
  headers,
  payload,
}: {
  headers: Headers;
  payload: string;
}) => {
  const secret = getEnvValue("RESEND_WEBHOOK_SECRET");
  const apiKey = getResendApiKey();

  if (!apiKey || !secret) {
    return null;
  }

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

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

export const sendTrackLifecycleEmail = async ({
  idempotencyKey,
  processingComplete = false,
  recipientEmail,
  recipientName,
  trackId,
  trackTitle,
}: {
  idempotencyKey: string;
  processingComplete?: boolean;
  recipientEmail: string;
  recipientName: string;
  trackId: string;
  trackTitle: string;
}): Promise<EmailSendResult> => {
  const apiKey = getResendApiKey();

  if (!apiKey) {
    return { reason: "resend_not_configured", sent: false };
  }

  const publicSiteUrl = getPublicSiteUrl();
  const actionUrl = `${publicSiteUrl.replace(/\/$/u, "")}/dashboard/tracks/${trackId}`;
  const [{ renderTrackLifecycleEmail }, { Resend }] = await Promise.all([
    import("@soundkit/transactional"),
    import("resend"),
  ]);
  const { html, text } = await renderTrackLifecycleEmail({
    actionUrl,
    artistName: recipientName,
    assetBaseUrl: publicSiteUrl,
    processingComplete,
    trackTitle,
  });
  const resend = new Resend(apiKey);
  const subject = processingComplete
    ? `${trackTitle} finished premium processing`
    : `${trackTitle} is live on SoundKit`;
  const replyTo = getEmailReplyTo();
  const { data, error } = await resend.emails.send(
    {
      from: getEmailFrom(),
      html,
      replyTo: replyTo ? [replyTo] : undefined,
      subject,
      tags: [
        { name: "email_type", value: "track_lifecycle" },
        {
          name: "lifecycle_event",
          value: processingComplete ? "processing_complete" : "track_live",
        },
        { name: "track_id", value: trackId },
      ],
      text,
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
      trackId,
    });

    return { reason: error.message, sent: false };
  }

  return { emailId: data?.id ?? null, sent: true };
};
