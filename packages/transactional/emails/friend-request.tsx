/* eslint-disable jsdoc/check-tag-names */
/** @jsxImportSource react */
import { TransactionalNotificationEmail } from "../src";

export default function FriendRequestEmail() {
  const assetBaseUrl = "https://mysoundkit.com";

  return (
    <TransactionalNotificationEmail
      actionUrl={`${assetBaseUrl}/dashboard/collaborators`}
      assetBaseUrl={assetBaseUrl}
      body="Jordan sent you an artist friend request on SoundKit. Accept it to add them to your friends list and start messaging when you are ready."
      ctaLabel="Review request"
      eyebrow="Friend request"
      footerNote="You are receiving this because collaboration emails are turned on for your SoundKit account."
      heading="You have a new artist friend request"
      previewText="Jordan wants to connect with you on SoundKit."
      recipientName="Maya"
    />
  );
}
