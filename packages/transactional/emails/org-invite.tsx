import { TransactionalNotificationEmail } from "../src/index";
import type { TransactionalNotificationEmailProps } from "../src/index";

const OrgInviteEmail =
  TransactionalNotificationEmail as typeof TransactionalNotificationEmail & {
    PreviewProps: TransactionalNotificationEmailProps;
  };

OrgInviteEmail.PreviewProps = {
  actionUrl: "https://mysoundkit.com/invite/demo",
  assetBaseUrl: "https://mysoundkit.com",
  body: "MetroFlow invited you to join their SoundKit workspace. Accept the invite to help manage music, releases, and team activity.",
  ctaLabel: "Accept invite",
  eyebrow: "Workspace invite",
  footerNote:
    "You are receiving this because someone invited this email address to a SoundKit workspace.",
  heading: "You are invited to SoundKit",
  previewText: "MetroFlow invited you to join their SoundKit workspace.",
  recipientName: "there",
} satisfies TransactionalNotificationEmailProps;

export default OrgInviteEmail;
