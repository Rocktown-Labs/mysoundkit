/* eslint-disable jsdoc/check-tag-names */
/** @jsxImportSource react */
import { TransactionalNotificationEmail } from "../src";

export default function WelcomeEmail() {
  const assetBaseUrl = "https://mysoundkit.com";

  return (
    <TransactionalNotificationEmail
      actionUrl={`${assetBaseUrl}/dashboard/tracks/new`}
      assetBaseUrl={assetBaseUrl}
      body="Your SoundKit account is ready. Start by adding the music, videos, and collaboration opportunities you want people to hear, watch, or join."
      ctaLabel="Upload your first track"
      eyebrow="Welcome"
      footerNote="You are receiving this because you created a SoundKit account."
      heading="Welcome to SoundKit"
      links={[
        {
          description:
            "Add audio, cover art, credits, and release details in one place.",
          href: `${assetBaseUrl}/dashboard/tracks/new`,
          label: "Upload your first track",
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
            "Find hooks, verses, and collaboration openings from other artists.",
          href: `${assetBaseUrl}/dashboard/open-verses`,
          label: "Browse open verses",
        },
      ]}
      previewText="Your SoundKit account is ready. Start with your first track."
      recipientName="there"
    />
  );
}
