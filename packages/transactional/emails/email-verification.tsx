/* eslint-disable jsdoc/check-tag-names */
/** @jsxImportSource react */
import { TransactionalNotificationEmail } from "../src";

export default function EmailVerificationEmail() {
  const assetBaseUrl = "https://mysoundkit.com";

  return (
    <TransactionalNotificationEmail
      actionUrl={`${assetBaseUrl}/auth/verify-email?token=preview`}
      assetBaseUrl={assetBaseUrl}
      body="Confirm this email address so SoundKit can keep your account secure and send the account updates you ask for."
      ctaLabel="Verify email"
      eyebrow="Verify email"
      footerNote="You are receiving this because this email address was used for a SoundKit account."
      heading="Verify your SoundKit email"
      previewText="Confirm your SoundKit email address."
      recipientName="there"
    />
  );
}
