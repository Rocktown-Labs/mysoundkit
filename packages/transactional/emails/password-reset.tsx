/* eslint-disable jsdoc/check-tag-names */
/** @jsxImportSource react */
import { TransactionalNotificationEmail } from "../src";

export default function PasswordResetEmail() {
  const assetBaseUrl = "https://mysoundkit.com";

  return (
    <TransactionalNotificationEmail
      actionUrl={`${assetBaseUrl}/auth/reset-password?token=preview`}
      assetBaseUrl={assetBaseUrl}
      body="We received a request to reset your SoundKit password. Use the secure link below to choose a new one."
      ctaLabel="Reset password"
      eyebrow="Account security"
      footerNote="If you did not request this, you can ignore this email and your password will stay the same."
      heading="Reset your SoundKit password"
      previewText="Use this secure link to reset your SoundKit password."
      recipientName="there"
    />
  );
}
