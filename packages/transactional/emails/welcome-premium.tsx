/* eslint-disable jsdoc/check-tag-names */
/** @jsxImportSource react */
import { TransactionalNotificationEmail } from "../src";

export default function WelcomePremiumEmail() {
  const assetBaseUrl = "https://mysoundkit.com";

  return (
    <TransactionalNotificationEmail
      actionUrl={`${assetBaseUrl}/dashboard/live`}
      assetBaseUrl={assetBaseUrl}
      body="Your premium access is active. You can keep building your catalog, publish videos and open verses, join live rooms, and participate in battles when you are ready."
      ctaLabel="Open live dashboard"
      eyebrow="Premium active"
      footerNote="You are receiving this because SoundKit Premium is active on your account."
      heading="Welcome to SoundKit Premium"
      links={[
        {
          description:
            "Add audio, cover art, credits, and release details in one place.",
          href: `${assetBaseUrl}/dashboard/tracks/new`,
          label: "Upload a track",
        },
        {
          description:
            "Group multiple songs, assets, and notes into a release workspace.",
          href: `${assetBaseUrl}/dashboard/projects/new`,
          label: "Create a project",
        },
        {
          description:
            "Share visuals, performances, or music videos with your audience.",
          href: `${assetBaseUrl}/dashboard/videos/new`,
          label: "Upload a video",
        },
        {
          description:
            "Post a track section for other artists to write and submit to.",
          href: `${assetBaseUrl}/dashboard/open-verses/new`,
          label: "Create an open verse",
        },
        {
          description:
            "Choose the songs you want ready when a live battle starts.",
          href: `${assetBaseUrl}/dashboard/live/my-kit`,
          label: "Build your battle kit",
        },
        {
          description:
            "Watch live battles, parties, and streams from the SoundKit community.",
          href: `${assetBaseUrl}/live/battles`,
          label: "Watch live battles",
        },
        {
          description:
            "Send or respond to battle challenges when you are ready to compete.",
          href: `${assetBaseUrl}/dashboard/live/challenge`,
          label: "Open battle challenges",
        },
      ]}
      previewText="Your premium access is active. Build your catalog and open the live tools when you are ready."
      recipientName="there"
    />
  );
}
