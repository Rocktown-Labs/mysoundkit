import { TransactionalNotificationEmail } from "../src/index";
import type { TransactionalNotificationEmailProps } from "../src/index";

const CollaboratorInviteEmail =
  TransactionalNotificationEmail as typeof TransactionalNotificationEmail & {
    PreviewProps: TransactionalNotificationEmailProps;
  };

CollaboratorInviteEmail.PreviewProps = {
  actionUrl: "https://mysoundkit.com/dashboard/tracks/demo-track",
  assetBaseUrl: "https://mysoundkit.com",
  body: "MetroFlow invited you to collaborate on Midnight Bounce. Open the invite to review your role and join the track workspace.",
  ctaLabel: "Open invite",
  eyebrow: "Collaboration",
  footerNote:
    "You are receiving this because someone invited this email address to collaborate on SoundKit.",
  heading: "You have a collaboration invite",
  previewText: "MetroFlow invited you to collaborate on Midnight Bounce.",
  recipientName: "there",
} satisfies TransactionalNotificationEmailProps;

export default CollaboratorInviteEmail;
