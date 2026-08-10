/* eslint-disable jsdoc/check-tag-names */
/** @jsxImportSource react */
import { TransactionalNotificationEmail } from "../src";

export default function NewFollowerEmail() {
  const assetBaseUrl = "https://mysoundkit.com";

  return (
    <TransactionalNotificationEmail
      actionUrl={`${assetBaseUrl}/dashboard/collaborators`}
      assetBaseUrl={assetBaseUrl}
      body="Jordan became a fan of your SoundKit profile. Open your collaborators dashboard to see the fan and keep building your audience."
      ctaLabel="View fan"
      eyebrow="New fan"
      footerNote="You are receiving this because follower emails are turned on for your SoundKit account."
      heading="You have a new fan"
      previewText="Jordan became a fan of your SoundKit profile."
      recipientName="Maya"
    />
  );
}
